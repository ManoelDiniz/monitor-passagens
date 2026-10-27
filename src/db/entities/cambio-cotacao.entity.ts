import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { dateOnly, decimalToNumber } from '../transformers';

/**
 * Fechamento de um dia, em reais por unidade: dolar e euro pela PTAX, o ETF
 * pelo pregao da B3.
 *
 * Dia passado e PTAX do Banco Central (oficial, com anos de historico). O dia
 * de hoje entra antes como "ao_vivo" e e trocado pela PTAX de fechamento
 * quando ela sai, por volta das 13h.
 */
@Entity('cambio_cotacoes')
@Index(['ativo', 'dia'], { unique: true })
export class CambioCotacao {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 10 })
  ativo: string;

  @Column({ type: 'date', transformer: dateOnly })
  dia: string;

  @Column({ type: 'decimal', precision: 10, scale: 4, transformer: decimalToNumber })
  valor: number;

  @Column({ type: 'varchar', length: 10 })
  fonte: 'ptax' | 'ao_vivo' | 'b3' | 'mb';

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  atualizado_em: Date;
}
