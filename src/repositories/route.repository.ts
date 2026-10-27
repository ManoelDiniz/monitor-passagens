import { AppDataSource } from '../db/data-source';
import { Route } from '../db/entities/route.entity';
import type { RouteCreateInput, RouteUpdateInput } from '../domain/route-input';

/** Lista branca do que um UPDATE pode tocar. */
const EDITABLE = [
  'origin',
  'destination',
  'depart_date',
  'return_date',
  'adults',
  'price_limit',
  'max_stops',
  'require_checked_bag',
  'notes',
  'active',
] as const;

export class RouteRepository {
  /* Getter e nao campo: o DataSource so existe depois do initialize(), e os
     repositorios sao importados antes disso. */
  private get repo() {
    return AppDataSource.getRepository(Route);
  }

  findAll(): Promise<Route[]> {
    return this.repo.find({ order: { active: 'DESC', id: 'DESC' } });
  }

  findActive(): Promise<Route[]> {
    return this.repo.find({ where: { active: 1 }, order: { id: 'ASC' } });
  }

  findById(id: number): Promise<Route | null> {
    return this.repo.findOne({ where: { id } });
  }

  async insert(input: RouteCreateInput): Promise<number> {
    const saved = await this.repo.save(this.repo.create(input));
    return saved.id;
  }

  async update(id: number, patch: RouteUpdateInput): Promise<void> {
    const changes: Record<string, unknown> = {};
    for (const field of EDITABLE) {
      if (field in patch) changes[field] = (patch as Record<string, unknown>)[field];
    }
    if (Object.keys(changes).length === 0) return;

    await this.repo.update({ id }, changes);
  }

  async remove(id: number): Promise<void> {
    await this.repo.delete({ id });
  }
}

export const routeRepository = new RouteRepository();
