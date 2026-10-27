import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { decimalToNumber } from '../transformers';
import { Check } from './check.entity';
import { Route } from './route.entity';

/**
 * Uma oferta retornada por um provedor. Guardamos todas, inclusive as que nao
 * passam nos filtros da rota (eligible = 0), para dar para auditar depois por
 * que um preco entrou ou nao entrou na comparacao.
 *
 * Sao ~120 ofertas por consulta, 24 consultas por dia, por rota — o volume nao
 * cabe "para sempre". Consultas antigas ficam so com a melhor oferta elegivel
 * (ver OfferRepository.pruneOld), o que preserva o historico de precos inteiro:
 * a serie do painel e o MIN por consulta, e o MIN e justamente o que fica.
 */
@Entity('offers')
@Index(['route_id', 'eligible', 'price'])
export class Offer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  check_id: number;

  @ManyToOne(() => Check, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'check_id' })
  check: Check;

  @Column({ type: 'int' })
  route_id: number;

  @ManyToOne(() => Route, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'route_id' })
  route: Route;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: decimalToNumber })
  price: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  airline: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  cabin: string | null;

  /** NULL = provedor nao informa; nao da para excluir a oferta com certeza. */
  @Column({ type: 'tinyint', nullable: true })
  checked_bags: number | null;

  @Column({ type: 'int', nullable: true })
  stops_out: number | null;

  @Column({ type: 'int', nullable: true })
  stops_ret: number | null;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  depart_at: Date | null;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  return_at: Date | null;

  @Column({ type: 'text', nullable: true })
  link: string | null;

  @Column({ type: 'tinyint', default: 1 })
  eligible: number;

  @Column({ type: 'varchar', length: 40, nullable: true })
  source: string | null;
}
