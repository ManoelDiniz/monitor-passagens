import { AppDataSource } from '../db/data-source';
import { CriptoOperacao } from '../db/entities/cripto-operacao.entity';

export type NovaOperacaoCripto = Omit<CriptoOperacao, 'id' | 'criado_em'>;

export class CriptoRepository {
  private get repo() {
    return AppDataSource.getRepository(CriptoOperacao);
  }

  listar(): Promise<CriptoOperacao[]> {
    return this.repo.find({ order: { dia: 'ASC', id: 'ASC' } });
  }

  buscar(id: number): Promise<CriptoOperacao | null> {
    return this.repo.findOne({ where: { id } });
  }

  inserir(op: NovaOperacaoCripto): Promise<CriptoOperacao> {
    return this.repo.save(this.repo.create(op));
  }

  /**
   * Apagar uma compra leva junto a venda que a fechou: uma venda sem a compra
   * dela seria lucro sem custo, e o resultado da carteira passaria a mentir.
   */
  async remover(id: number): Promise<boolean> {
    return AppDataSource.transaction(async (manager) => {
      const repo = manager.getRepository(CriptoOperacao);
      await repo.delete({ lote_id: id });
      const r = await repo.delete({ id });
      return (r.affected ?? 0) > 0;
    });
  }
}

export const criptoRepository = new CriptoRepository();
