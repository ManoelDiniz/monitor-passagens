import { AppDataSource } from '../db/data-source';
import { Offer } from '../db/entities/offer.entity';
import { dateOnly } from '../db/transformers';
import { checkRepository } from './check.repository';

/** Uma oferta pronta para gravar: sem id, com a elegibilidade ja decidida. */
export interface NewOffer {
  check_id: number;
  route_id: number;
  price: number;
  currency: string;
  airline: string | null;
  cabin: string | null;
  checked_bags: number | null;
  stops_out: number | null;
  stops_ret: number | null;
  depart_at: Date | null;
  return_at: Date | null;
  link: string | null;
  eligible: number;
  source: string | null;
}

/** O que a interface mostra de uma oferta — sem o payload bruto do provedor. */
export interface OfferView {
  price: number;
  currency: string;
  airline: string | null;
  cabin: string | null;
  checked_bags: number | null;
  stops_out: number | null;
  stops_ret: number | null;
  depart_at: string | null;
  return_at: string | null;
  link: string | null;
  source: string | null;
}

/** Menor preco elegivel de um dia de ida, dentro da janela da rota. */
export interface DayPrice {
  /** YYYY-MM-DD */
  date: string;
  price: number;
}

/**
 * Colunas que a tela precisa. Explicito porque `find` sem `select` traz tudo, e
 * a tabela de ofertas e a maior do banco — nao ha por que carregar coluna que
 * ninguem mostra.
 */
const COLUNAS_DA_VIEW = {
  price: true,
  currency: true,
  airline: true,
  cabin: true,
  checked_bags: true,
  stops_out: true,
  stops_ret: true,
  depart_at: true,
  return_at: true,
  link: true,
  source: true,
} as const;

const iso = (value: Date | null) => (value ? value.toISOString() : null);

function toView(offer: Offer): OfferView {
  return {
    price: offer.price,
    currency: offer.currency,
    airline: offer.airline,
    cabin: offer.cabin,
    checked_bags: offer.checked_bags,
    stops_out: offer.stops_out,
    stops_ret: offer.stops_ret,
    depart_at: iso(offer.depart_at),
    return_at: iso(offer.return_at),
    link: offer.link,
    source: offer.source,
  };
}

export class OfferRepository {
  private get repo() {
    return AppDataSource.getRepository(Offer);
  }

  /** Melhor oferta elegivel da ultima consulta bem-sucedida. */
  async findBest(routeId: number): Promise<OfferView | null> {
    const checkId = await checkRepository.lastOkId(routeId);
    if (checkId === null) return null;

    const offer = await this.repo.findOne({
      where: { check_id: checkId, eligible: 1 },
      order: { price: 'ASC' },
      select: COLUNAS_DA_VIEW,
    });

    return offer ? toView(offer) : null;
  }

  async findTop(routeId: number, limit = 8): Promise<OfferView[]> {
    const checkId = await checkRepository.lastOkId(routeId);
    if (checkId === null) return [];

    const offers = await this.repo.find({
      where: { check_id: checkId, eligible: 1 },
      order: { price: 'ASC' },
      take: limit,
      select: COLUNAS_DA_VIEW,
    });

    return offers.map(toView);
  }

  /**
   * Menor preco por dia de ida na ultima consulta bem-sucedida — a leitura que a
   * janela existe para produzir: qual dia do periodo esta mais barato agora.
   *
   * Oferta sem `depart_at` fica de fora porque nao da para dizer a que dia ela
   * pertence, e chutar a data-ancora inventaria um preco que ninguem viu.
   */
  async bestByDate(routeId: number): Promise<DayPrice[]> {
    const checkId = await checkRepository.lastOkId(routeId);
    if (checkId === null) return [];

    const rows = await this.repo
      .createQueryBuilder('o')
      .select('DATE(o.depart_at)', 'date')
      .addSelect('MIN(o.price)', 'price')
      .where('o.check_id = :checkId AND o.eligible = 1 AND o.depart_at IS NOT NULL', { checkId })
      .groupBy('DATE(o.depart_at)')
      .orderBy('DATE(o.depart_at)', 'ASC')
      .getRawMany<{ date: Date | string; price: string }>();

    return rows.map((row) => ({
      // Mesma conversao das colunas DATE das entidades, para o dia nao escorregar.
      date: dateOnly.from(row.date) as string,
      price: Number(row.price),
    }));
  }

  /** Menor preco elegivel de toda a historia da rota. */
  async allTimeLow(routeId: number): Promise<number | null> {
    const row = await this.repo
      .createQueryBuilder('o')
      .select('MIN(o.price)', 'price')
      .where('o.route_id = :routeId AND o.eligible = 1', { routeId })
      .getRawOne<{ price: string | null }>();

    return row?.price == null ? null : Number(row.price);
  }

  /**
   * Poda: consultas com mais de `dias` ficam apenas com a melhor oferta.
   *
   * O que a tela mostra de historico e o MIN(price) elegivel de cada consulta —
   * exatamente a linha preservada aqui. Menor, maior, media, variacao e menor
   * historico continuam com o mesmo valor depois da limpeza; o que se perde e a
   * lista completa de ofertas de consultas antigas, que nenhuma tela abre (o
   * botao "ver ofertas" le so a ultima consulta).
   *
   * O criterio de "melhor" repete a ordem da propria interface: elegivel antes
   * de inelegivel, menor preco antes, e o id mais baixo como desempate para o
   * resultado nao depender da ordem em que o MySQL varreu a tabela.
   */
  async pruneOld(dias: number): Promise<number> {
    if (dias <= 0) return 0;

    const limite = new Date(Date.now() - dias * 86_400_000);

    const resultado: { affectedRows?: number } = await this.repo.query(
      `DELETE FROM offers WHERE id IN (
         SELECT id FROM (
           SELECT o.id,
                  ROW_NUMBER() OVER (
                    PARTITION BY o.check_id
                    ORDER BY o.eligible DESC, o.price ASC, o.id ASC
                  ) AS posicao
           FROM offers o
           JOIN checks c ON c.id = o.check_id
           WHERE c.checked_at < ?
         ) AS ranqueadas
         WHERE ranqueadas.posicao > 1
       )`,
      [limite],
    );

    return resultado.affectedRows ?? 0;
  }

  /** Quantas linhas a poda apagaria — para conferir antes de apagar. */
  async contarPodaveis(dias: number): Promise<number> {
    if (dias <= 0) return 0;

    const limite = new Date(Date.now() - dias * 86_400_000);
    const [linha] = await this.repo.query(
      `SELECT COUNT(*) AS n FROM (
         SELECT ROW_NUMBER() OVER (
                  PARTITION BY o.check_id
                  ORDER BY o.eligible DESC, o.price ASC, o.id ASC
                ) AS posicao
         FROM offers o
         JOIN checks c ON c.id = o.check_id
         WHERE c.checked_at < ?
       ) AS ranqueadas
       WHERE ranqueadas.posicao > 1`,
      [limite],
    );

    return Number(linha?.n ?? 0);
  }

  /**
   * InnoDB nao devolve ao disco o espaco de linha apagada — ele fica reservado
   * para reuso dentro do arquivo. Sem este rebuild, apagar 90% das linhas nao
   * muda o tamanho em disco, que e justamente o que se quer resolver aqui.
   */
  async compactarTabela(): Promise<void> {
    await this.repo.query('OPTIMIZE TABLE offers');
  }

  /**
   * Tamanho real da tabela em disco, para medir o efeito da limpeza.
   *
   * O ANALYZE nao e enfeite: o MySQL 8 serve information_schema.tables de um
   * cache que so expira em 24h (information_schema_stats_expiry). Sem ele, a
   * consulta logo depois de uma limpeza devolve o tamanho de ontem e parece que
   * nada aconteceu. Nao da para trocar a variavel de sessao no lugar disso
   * porque a proxima consulta pode sair por outra conexao do pool.
   */
  async tamanho(): Promise<{ linhas: number; bytes: number }> {
    await this.repo.query('ANALYZE TABLE offers');

    const [linhas] = await this.repo.query<Array<{ n: string }>>(
      'SELECT COUNT(*) AS n FROM offers',
    );
    const [tamanho] = await this.repo.query<Array<{ bytes: string | null }>>(
      `SELECT data_length + index_length AS bytes
       FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'offers'`,
    );

    return { linhas: Number(linhas?.n ?? 0), bytes: Number(tamanho?.bytes ?? 0) };
  }
}

export const offerRepository = new OfferRepository();
