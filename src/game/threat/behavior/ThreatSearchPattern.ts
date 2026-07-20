/**
 * Authored threat nav graph + deterministic route/search selection
 * (Milestone 0.9).
 *
 * The threat NEVER pathfinds over scene geometry — it moves along a small,
 * hand-authored node graph covering only the encounter-approved area
 * (control-building upper corridor, stairwell, control-room side corridor,
 * service corridor, safe-zone boundary). Route selection is BFS shortest
 * path over adjacency; search ordering is fully deterministic (priority
 * desc, then distance from the last-known position asc, then id asc) so
 * threat-timing tests are authored-timeline reproducible.
 */
import type { Point3 } from '../../facility/FacilityZone';
import type { ThreatNodeId } from '../ThreatId';

export interface ThreatNavNode {
  readonly id: ThreatNodeId;
  readonly position: Point3;
  /** Ids of directly-walkable neighbour nodes. */
  readonly adjacency: readonly ThreatNodeId[];
  readonly zoneId: string;
  /** Higher = searched earlier when the threat sweeps the area. */
  readonly searchPriority: number;
  /** True when the node is a good vantage point (authoring metadata). */
  readonly visibility?: 'open' | 'obscured';
  /** Traversal beyond this node requires this door to be passable. */
  readonly requiresDoorId?: string;
}

export interface ThreatNavGraph {
  readonly nodes: readonly ThreatNavNode[];
}

/** Structural validation: unique ids, known + symmetric-enough links, no orphans. */
export function validateThreatNavGraph(graph: ThreatNavGraph): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (ids.has(node.id)) problems.push(`duplicate nav node id "${node.id}"`);
    ids.add(node.id);
  }
  for (const node of graph.nodes) {
    if (node.adjacency.length === 0) {
      problems.push(`nav node "${node.id}" has no adjacency (orphan)`);
    }
    for (const link of node.adjacency) {
      if (!ids.has(link)) {
        problems.push(`nav node "${node.id}" links to unknown node "${link}"`);
      }
      if (link === node.id) {
        problems.push(`nav node "${node.id}" links to itself`);
      }
    }
    if (!Number.isFinite(node.searchPriority)) {
      problems.push(`nav node "${node.id}" has a non-finite searchPriority`);
    }
  }
  return problems;
}

export function getNode(graph: ThreatNavGraph, id: ThreatNodeId): ThreatNavNode | undefined {
  return graph.nodes.find((n) => n.id === id);
}

export function distanceBetween(a: Point3, b: Point3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Node closest to a world position (deterministic tie-break by id). */
export function nearestNode(graph: ThreatNavGraph, position: Point3): ThreatNavNode | null {
  let best: ThreatNavNode | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const node of graph.nodes) {
    const d = distanceBetween(node.position, position);
    if (d < bestDistance || (d === bestDistance && best !== null && node.id < best.id)) {
      best = node;
      bestDistance = d;
    }
  }
  return best;
}

/**
 * BFS shortest path (by hop count) from `fromId` to `toId`, inclusive of
 * both endpoints. `isDoorPassable` prunes edges gated by a closed/locked
 * door. Returns null when unreachable. Deterministic: neighbours expand in
 * authored adjacency order.
 */
export function findRoute(
  graph: ThreatNavGraph,
  fromId: ThreatNodeId,
  toId: ThreatNodeId,
  isDoorPassable: (doorId: string) => boolean = () => true,
): ThreatNodeId[] | null {
  if (getNode(graph, fromId) === undefined || getNode(graph, toId) === undefined) return null;
  const enterable = (id: ThreatNodeId): boolean => {
    const node = getNode(graph, id);
    if (node === undefined) return false;
    return node.requiresDoorId === undefined || isDoorPassable(node.requiresDoorId);
  };
  if (fromId === toId) return [fromId];
  if (!enterable(toId)) return null;
  const cameFrom = new Map<ThreatNodeId, ThreatNodeId>();
  const queue: ThreatNodeId[] = [fromId];
  const visited = new Set<ThreatNodeId>([fromId]);
  while (queue.length > 0) {
    const current = queue.shift() as ThreatNodeId;
    const node = getNode(graph, current);
    if (node === undefined) continue;
    for (const next of node.adjacency) {
      if (visited.has(next) || !enterable(next)) continue;
      visited.add(next);
      cameFrom.set(next, current);
      if (next === toId) {
        const path: ThreatNodeId[] = [toId];
        let step: ThreatNodeId = toId;
        while (step !== fromId) {
          step = cameFrom.get(step) as ThreatNodeId;
          path.unshift(step);
        }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

/**
 * Deterministic search ordering from a last-known position: search priority
 * descending, then distance to the last-known position ascending, then id
 * ascending. Only nodes reachable from `startId` are included.
 */
export function orderSearchNodes(
  graph: ThreatNavGraph,
  startId: ThreatNodeId,
  lastKnownPosition: Point3,
  isDoorPassable: (doorId: string) => boolean = () => true,
): ThreatNodeId[] {
  const reachable = graph.nodes.filter(
    (n) => n.id !== startId && findRoute(graph, startId, n.id, isDoorPassable) !== null,
  );
  return reachable
    .slice()
    .sort((a, b) => {
      if (a.searchPriority !== b.searchPriority) return b.searchPriority - a.searchPriority;
      const da = distanceBetween(a.position, lastKnownPosition);
      const db = distanceBetween(b.position, lastKnownPosition);
      if (da !== db) return da - db;
      return a.id < b.id ? -1 : 1;
    })
    .map((n) => n.id);
}
