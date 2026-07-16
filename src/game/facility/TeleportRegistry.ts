/**
 * Registry of development teleport positions.
 *
 * Registered at scene-creation time; cleared on dispose.  Babylon-free.
 */
import { validateTeleportDefinition, type TeleportDefinition } from './TeleportDefinition';

export class TeleportRegistry {
  private readonly teleports = new Map<string, TeleportDefinition>();

  register(definition: TeleportDefinition): void {
    const problems = validateTeleportDefinition(definition);
    if (problems.length > 0) {
      throw new Error(`Invalid teleport '${definition.id}': ${problems.join('; ')}`);
    }
    if (this.teleports.has(definition.id)) {
      throw new Error(`TeleportRegistry: duplicate teleport id "${definition.id}"`);
    }
    this.teleports.set(definition.id, definition);
  }

  get(id: string): TeleportDefinition | undefined {
    return this.teleports.get(id);
  }

  getAll(): readonly TeleportDefinition[] {
    return [...this.teleports.values()];
  }

  clear(): void {
    this.teleports.clear();
  }

  get count(): number {
    return this.teleports.size;
  }
}
