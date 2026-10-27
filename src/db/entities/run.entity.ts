import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Um horario agendado que ja rodou, tipo "2026-08-05 14:00". Serve para o
 * app recuperar as consultas perdidas enquanto o PC estava desligado sem
 * repetir a mesma recuperacao a cada reinicio.
 */
@Entity('runs')
export class Run {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  slot_key: string;

  @Column({ type: 'datetime', precision: 3 })
  ran_at: Date;
}
