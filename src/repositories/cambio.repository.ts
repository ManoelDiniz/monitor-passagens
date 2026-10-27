import { LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { AppDataSource } from '../db/data-source';
import { CambioAlerta } from '../db/entities/cambio-alerta.entity';
import { CambioCotacao } from '../db/entities/cambio-cotacao.entity';
import { CambioOperacao } from '../db/entities/cambio-operacao.entity';
import type { Ponto } from '../domain/cambio';

export interface NovaOperacao {
  ativo: string;
  tipo: 'compra' | 'venda';
  dia: string;
  valor_brl: number;
  quantidade: number;
  plataforma: string | null;
  notas: string | null;
}

const LOTE = 500;

export class CambioRepository {
  private get cotacoes() {
    return AppDataSource.getRepository(CambioCotacao);
  }

  private get operacoes() {
    return AppDataSource.getRepository(CambioOperacao);
  }

  private get alertas() {
    return AppDataSource.getRepository(CambioAlerta);
  }

  /** Serie do ativo, do dia mais antigo para o mais novo. */
  async serie(ativo: string, desde?: string): Promise<Ponto[]> {
    const rows = await this.cotacoes.find({
      where: desde ? { ativo, dia: MoreThanOrEqual(desde) } : { ativo },
      order: { dia: 'ASC' },
      select: { dia: true, valor: true },
    });
    return rows.map((r) => ({ dia: r.dia, valor: r.valor }));
  }

  /** Fechamento do dia, ou do ultimo pregao antes dele (fim de semana, feriado). */
  async precoEm(ativo: string, dia: string): Promise<number | null> {
    const row = await this.cotacoes.findOne({
      where: { ativo, dia: LessThanOrEqual(dia) },
      order: { dia: 'DESC' },
      select: { valor: true },
    });
    return row?.valor ?? null;
  }

  async ultimoDia(ativo: string, fonte?: CambioCotacao['fonte']): Promise<string | null> {
    const row = await this.cotacoes.findOne({
      where: fonte ? { ativo, fonte } : { ativo },
      order: { dia: 'DESC' },
      select: { dia: true },
    });
    return row?.dia ?? null;
  }

  /**
   * Grava ou substitui o dia. INSERT ... ON DUPLICATE KEY UPDATE escrito a mao:
   * o `upsert` do TypeORM tenta voltar a entidade depois de atualizar e falha
   * ("entity id is not set") quando a linha ja existia.
   */
  async salvar(ativo: string, pontos: Ponto[], fonte: CambioCotacao['fonte']): Promise<void> {
    const rows = pontos.map((p) => ({ ativo, dia: p.dia, valor: p.valor, fonte }));
    for (let i = 0; i < rows.length; i += LOTE) {
      await this.cotacoes
        .createQueryBuilder()
        .insert()
        .into(CambioCotacao)
        .values(rows.slice(i, i + LOTE))
        .orUpdate(['valor', 'fonte'], ['ativo', 'dia'])
        .updateEntity(false)
        .execute();
    }
  }

  /**
   * O preco de agora so ocupa o dia enquanto a PTAX de fechamento nao sai.
   * Depois dela, uma cotacao ao vivo sobrescreveria o numero oficial com um
   * numero de mercado — e o historico passaria a misturar as duas regras.
   */
  async salvarAoVivo(ativo: string, ponto: Ponto): Promise<void> {
    const existente = await this.cotacoes.findOne({ where: { ativo, dia: ponto.dia } });
    if (existente?.fonte === 'ptax') return;
    await this.salvar(ativo, [ponto], 'ao_vivo');
  }

  listarOperacoes(): Promise<CambioOperacao[]> {
    return this.operacoes.find({ order: { dia: 'ASC', id: 'ASC' } });
  }

  async inserirOperacao(op: NovaOperacao): Promise<CambioOperacao> {
    return this.operacoes.save(this.operacoes.create(op));
  }

  async removerOperacao(id: number): Promise<boolean> {
    const r = await this.operacoes.delete({ id });
    return (r.affected ?? 0) > 0;
  }

  ultimoAlerta(ativo: string): Promise<CambioAlerta | null> {
    return this.alertas.findOne({ where: { ativo }, order: { enviado_em: 'DESC' } });
  }

  async registrarAlerta(alerta: Omit<CambioAlerta, 'id'>): Promise<void> {
    await this.alertas.save(this.alertas.create(alerta));
  }

  alertasRecentes(limite: number): Promise<CambioAlerta[]> {
    return this.alertas.find({ order: { enviado_em: 'DESC' }, take: limite });
  }
}

export const cambioRepository = new CambioRepository();
