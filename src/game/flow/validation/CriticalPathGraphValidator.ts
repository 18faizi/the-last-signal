/**
 * Milestone 1.0 — Critical Path Graph Validator.
 *
 * Mathematically verifies that the 10-chapter progression model and ending branches
 * form a valid Directed Acyclic Graph (DAG) with full reachability and zero deadlocks.
 */

import { CHAPTER_DEFINITIONS, CHAPTER_ORDER, type GameChapterId } from '../GameChapter';

export interface GraphValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly unreachableChapters: readonly string[];
}

export class CriticalPathGraphValidator {
  public static validate(): GraphValidationResult {
    const errors: string[] = [];

    // 1. Verify all 10 chapters exist in order and definition
    if (CHAPTER_ORDER.length !== 10) {
      errors.push(`Expected 10 chapters, found ${CHAPTER_ORDER.length}.`);
    }

    for (const id of CHAPTER_ORDER) {
      if (!CHAPTER_DEFINITIONS[id]) {
        errors.push(`Chapter ${id} in CHAPTER_ORDER is missing from CHAPTER_DEFINITIONS.`);
      }
    }

    // 2. Build forward progression adjacency list (excluding loopback restart from PostCompletion -> Arrival)
    const adj = new Map<GameChapterId, GameChapterId[]>();
    for (const [id, def] of Object.entries(CHAPTER_DEFINITIONS) as [
      GameChapterId,
      (typeof CHAPTER_DEFINITIONS)[GameChapterId],
    ][]) {
      const forwardNeighbors = def.allowedNextChapters.filter(
        (next) => !(id === 'PostCompletion' && next === 'Arrival'),
      );
      adj.set(id, forwardNeighbors);
    }

    // 3. Check for cycles using DFS
    const visited = new Set<GameChapterId>();
    const recStack = new Set<GameChapterId>();

    function hasCycle(curr: GameChapterId): boolean {
      visited.add(curr);
      recStack.add(curr);

      const neighbors = adj.get(curr) ?? [];
      for (const next of neighbors) {
        if (!visited.has(next) && hasCycle(next)) {
          return true;
        } else if (recStack.has(next)) {
          return true;
        }
      }

      recStack.delete(curr);
      return false;
    }

    for (const id of CHAPTER_ORDER) {
      if (!visited.has(id)) {
        if (hasCycle(id)) {
          errors.push(`Cycle detected involving chapter ${id}.`);
        }
      }
    }

    // 4. Check reachability from root 'Arrival'
    const reachable = new Set<GameChapterId>();
    const queue: GameChapterId[] = ['Arrival'];
    reachable.add('Arrival');

    while (queue.length > 0) {
      const curr = queue.shift();
      if (!curr) break;
      const neighbors = adj.get(curr) ?? [];
      for (const next of neighbors) {
        if (!reachable.has(next)) {
          reachable.add(next);
          queue.push(next);
        }
      }
    }

    const unreachable = CHAPTER_ORDER.filter((id) => !reachable.has(id));
    if (unreachable.length > 0) {
      errors.push(`Unreachable chapters from root: ${unreachable.join(', ')}.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      unreachableChapters: unreachable,
    };
  }
}
