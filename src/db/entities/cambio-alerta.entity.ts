import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { decimalToNumber } from '../transformers';

/** Um sinal que virou aviso. Serve de memoria para nao repetir o mesmo aviso toda hora. */
@Entity('cambio_alertas')
@Index(['ativo', 'enviado_em'])
export class CambioAlerta {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 10 })
  ativo: string;

  @Column({ type: 'varchar', length: 20 })
  sinal: string;

  @Column({ type: 'decimal', precision: 10, scale: 4, transformer: decimalToNumber })
  cotacao: number;

  @Column({ type: 'varchar', length: 255 })
  motivo: string;

  @Column({ type: 'datetime', precision: 3 })
  enviado_em: Date;
}
