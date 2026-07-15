/**
 * Scene-scoped registry of DoorController instances.
 *
 * Allows the debug view and test bridge to enumerate and inspect doors without
 * holding scene-specific references.
 */
import type { DoorController } from './DoorController';

export class DoorRegistry {
  private readonly doors = new Map<string, DoorController>();

  register(controller: DoorController): void {
    if (this.doors.has(controller.id)) {
      throw new Error(`DoorRegistry: duplicate door id "${controller.id}"`);
    }
    this.doors.set(controller.id, controller);
  }

  get(id: string): DoorController | undefined {
    return this.doors.get(id);
  }

  getAll(): readonly DoorController[] {
    return [...this.doors.values()];
  }

  clear(): void {
    this.doors.clear();
  }
}
