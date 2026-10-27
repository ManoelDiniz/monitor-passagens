import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { dateOnly, decimalToNumber } from '../transformers';

/**
 * Um trecho monitorado. Os nomes das propriedades sao snake_case de proposito:
 * a entidade e serializada direto para o painel, e este e o contrato da API.
 */
@Entity('routes')
@Index(['active'])
export class Route {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'char', length: 3 })
  origin: string;

  @Column({ type: 'char', length: 3 })
  destination: string;

  @Column({ type: 'date', transformer: dateOnly })
  depart_date: string;

  @Column({ type: 'date', nullable: true, transformer: dateOnly })
  return_date: string | null;

  /**
   * Quantos dias para cada lado da ida tambem sao consultados. 0 = data fixa,
   * que e como toda rota nasceu antes de existir janela.
   *
   * A volta nao tem campo proprio: ela desliza junto com a ida mantendo as
   * noites que ja estao implicitas em (return_date - depart_date).
   */
  @Column({ type: 'int', default: 0 })
  depart_window_days: number;

  @Column({ type: 'int', default: 1 })
  adults: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: decimalToNumber })
  price_limit: number | null;

  @Column({ type: 'int', default: 2 })
  max_stops: number;

  @Column({ type: 'tinyint', default: 0 })
  require_checked_bag: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;

  @Column({ type: 'tinyint', default: 1 })
  active: number;

  /* Precisao 6: o TypeORM gera DEFAULT CURRENT_TIMESTAMP(6), e o MySQL exige
     que a precisao do default bata com a da coluna. */
  @CreateDateColumn({ type: 'datetime', precision: 6 })
  created_at: Date;
}

/* As relacoes inversas (route.checks, route.offers) ficaram de fora de proposito:
   nada no codigo carrega uma rota com os filhos juntos, e "checks" ja significa
   outra coisa no resumo que vai para a tela — la e a contagem de leituras. */
