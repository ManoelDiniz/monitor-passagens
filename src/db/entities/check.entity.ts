import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Route } from './route.entity';

export type CheckStatus = 'ok' | 'empty' | 'error';

/** Uma consulta a rota: quando rodou, por qual provedor e como terminou. */
@Entity('checks')
@Index(['route_id', 'checked_at'])
export class Check {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  route_id: number;

  @ManyToOne(() => Route, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'route_id' })
  route: Route;

  @Column({ type: 'datetime', precision: 3 })
  checked_at: Date;

  @Column({ type: 'varchar', length: 40, nullable: true })
  provider: string | null;

  @Column({ type: 'varchar', length: 10 })
  status: CheckStatus;

  @Column({ type: 'int', nullable: true })
  duration_ms: number | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;
}
