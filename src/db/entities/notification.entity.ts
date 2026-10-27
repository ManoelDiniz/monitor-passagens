import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { decimalToNumber } from '../transformers';
import { Route } from './route.entity';

/** Alerta ja disparado. Tambem e a base do cooldown entre avisos. */
@Entity('notifications')
@Index(['route_id', 'sent_at'])
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  route_id: number;

  @ManyToOne(() => Route, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'route_id' })
  route: Route;

  @Column({ type: 'datetime', precision: 3 })
  sent_at: Date;

  /** Motivos separados por virgula: queda, abaixo_do_limite, menor_preco_historico. */
  @Column({ type: 'varchar', length: 120 })
  reason: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: decimalToNumber })
  price: number;

  @Column({ type: 'text' })
  message: string;
}
