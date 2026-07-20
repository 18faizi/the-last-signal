/**
 * Authored-event validation (Milestone 0.9): duplicate ids, unknown/self/
 * circular dependencies, negative delays, empty action lists. Runs at scene
 * creation in dev builds (mirrors the other domain validators).
 */
import type { EventDefinition } from './EventDefinition';

export function validateEventDefinitions(events: readonly EventDefinition[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const event of events) {
    if (ids.has(event.id)) problems.push(`duplicate event id "${event.id}"`);
    ids.add(event.id);
  }

  for (const event of events) {
    if (event.delaySeconds < 0) {
      problems.push(`event "${event.id}": delaySeconds must be >= 0`);
    }
    if (event.actions.length === 0) {
      problems.push(`event "${event.id}": must author at least one action`);
    }
    for (const dep of event.dependencies) {
      if (dep === event.id) {
        problems.push(`event "${event.id}": depends on itself`);
      } else if (!ids.has(dep)) {
        problems.push(`event "${event.id}": unknown dependency "${dep}"`);
      }
    }
    for (const condition of event.conditions) {
      if (
        (condition.kind === 'time-since-event' || condition.kind === 'event-completed') &&
        !ids.has(condition.eventId)
      ) {
        problems.push(
          `event "${event.id}": condition references unknown event "${condition.eventId}"`,
        );
      }
    }
  }

  // Circular dependency detection (iterative DFS over the dep graph).
  const byId = new Map(events.map((e) => [e.id, e]));
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (id: string, stack: string[]): void => {
    if (done.has(id)) return;
    if (visiting.has(id)) {
      problems.push(`circular event dependency: ${[...stack, id].join(' -> ')}`);
      return;
    }
    visiting.add(id);
    const event = byId.get(id);
    if (event !== undefined) {
      for (const dep of event.dependencies) {
        if (byId.has(dep)) visit(dep, [...stack, id]);
      }
    }
    visiting.delete(id);
    done.add(id);
  };
  for (const event of events) {
    visit(event.id, []);
  }

  return problems;
}
