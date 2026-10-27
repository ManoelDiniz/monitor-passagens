import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { dateOnly, decimalToNumber } from '../transformers';

/**
 * Uma compra ou venda feita de verdade, lancada a mao. Guarda o que saiu e o
 * que entrou de cada lado: a taxa efetiva (com IOF e spread embutidos) sai da
 * divisao, e e ela que diz quanto a plataforma realmente cobrou.
 */
@Entity('cambio_operacoes')
@Index(['ativo', 'dia'])
export class CambioOperacao {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 10 })
  ativo: string;

  @Column({ type: 'varchar', length: 6 })
  tipo: 'compra' | 'venda';

  @Column({ type: 'date', transformer: dateOnly })
  dia: string;

  /** Reais que sairam (compra) ou entraram (venda), ja com todos os custos. */
  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: decimalToNumber })
  valor_brl: number;

  /** Moeda ou cotas que entraram (compra) ou sairam (venda). */
  @Column({ type: 'decimal', precision: 12, scale: 4, transformer: decimalToNumber })
  quantidade: number;

  @Column({ type: 'varchar', length: 40, nullable: true })
  plataforma: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notas: string | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  criado_em: Date;
}
