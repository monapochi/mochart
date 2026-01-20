import type { IndicatorDefinition } from './indicatorTypes';

export interface IndicatorRegistry {
  register(indicator: IndicatorDefinition<any, any>): void;
  get(id: string): IndicatorDefinition | undefined;
  listAll(): IndicatorDefinition[];
  listByCategory(category: IndicatorDefinition['category']): IndicatorDefinition[];
  listGPUEnabled(): IndicatorDefinition[];
  resolveDependencies(ids: string[]): IndicatorDefinition[];
}

export class InMemoryIndicatorRegistry implements IndicatorRegistry {
  private defs = new Map<string, IndicatorDefinition>();

  register(definition: IndicatorDefinition<any, any>): void {
    this.defs.set(definition.id, definition);
  }

  get(id: string): IndicatorDefinition | undefined {
    return this.defs.get(id);
  }

  listAll(): IndicatorDefinition[] {
    return Array.from(this.defs.values());
  }

  listByCategory(category: IndicatorDefinition['category']): IndicatorDefinition[] {
    return this.listAll().filter((def) => def.category === category);
  }

  listGPUEnabled(): IndicatorDefinition[] {
    return this.listAll().filter((def) => Boolean(def.calculateGPU || def.wgslSource));
  }

  resolveDependencies(ids: string[]): IndicatorDefinition[] {
    const resolved: IndicatorDefinition[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (id: string) => {
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        throw new Error(`Circular dependency detected for indicator: ${id}`);
      }

      const def = this.get(id);
      if (!def) {
        throw new Error(`Indicator not found: ${id}`);
      }

      visiting.add(id);
      for (const dep of def.dependencies ?? []) {
        visit(dep);
      }
      visiting.delete(id);
      visited.add(id);
      resolved.push(def);
    };

    ids.forEach(visit);
    return resolved;
  }
}
