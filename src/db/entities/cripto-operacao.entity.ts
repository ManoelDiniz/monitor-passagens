import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { dateOnly, decimalToNumber } from '../transformers';

/**
 * Compra ou venda de cripto lancada a mao. Cada compra e uma "parte" da grade
 * e vive sozinha: tem preco proprio, alvo proprio e stop proprio. A venda
 * aponta para a compra que ela fecha (`lote_id`) — e assim que se sabe quais
 * partes continuam abertas.
 */
@Entity('cripto_operacoes')
@Index(['moeda', 'dia'])
export class CriptoOperacao {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 10 })
  moeda: string;

  @Column({ type: 'varchar', length: 6 })
  tipo: 'compra' | 'venda';

  @Column({ type: 'date', transformer: dateOnly })
  dia: string;

  /** Reais que sairam (compra) ou entraram (venda), com as taxas. */
  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: decimalToNumber })
  valor_brl: number;

  @Column({ type: 'decimal', precision: 20, scale: 10, transformer: decimalToNumber })
  quantidade: number;

  /** Na venda, a compra que ela fecha. */
  @Column({ type: 'int', nullable: true })
  lote_id: number | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  plataforma: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notas: string | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  criado_em: Date;
}
