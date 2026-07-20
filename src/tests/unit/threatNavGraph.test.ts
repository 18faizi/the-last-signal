import { describe, expect, it } from 'vitest';
import {
  findRoute,
  nearestNode,
  orderSearchNodes,
  validateThreatNavGraph,
  type ThreatNavGraph,
} from '../../game/threat/behavior/ThreatSearchPattern';
import {
  FACILITY_THREAT_GRAPH,
  TNODE_CTRL_SOUTH,
  TNODE_RELAY_EAST,
  TNODE_STAIR_BOTTOM,
} from '../../scenes/facility-greybox/threat/facilityThreatDefinitions';

const GRAPH: ThreatNavGraph = {
  nodes: [
    {
      id: 'a',
      position: { x: 0, y: 0, z: 0 },
      adjacency: ['b'],
      zoneId: 'z1',
      searchPriority: 1,
    },
    {
      id: 'b',
      position: { x: 4, y: 0, z: 0 },
      adjacency: ['a', 'c', 'd'],
      zoneId: 'z1',
      searchPriority: 2,
    },
    {
      id: 'c',
      position: { x: 8, y: 0, z: 0 },
      adjacency: ['b'],
      zoneId: 'z1',
      searchPriority: 3,
    },
    {
      id: 'd',
      position: { x: 4, y: 0, z: 4 },
      adjacency: ['b'],
      zoneId: 'z2',
      searchPriority: 3,
      requiresDoorId: 'door-1',
    },
  ],
};

describe('validateThreatNavGraph', () => {
  it('accepts the authored facility graph', () => {
    expect(validateThreatNavGraph(FACILITY_THREAT_GRAPH)).toEqual([]);
  });

  it('rejects duplicate ids, unknown links, self links and orphans', () => {
    const problems = validateThreatNavGraph({
      nodes: [
        {
          id: 'a',
          position: { x: 0, y: 0, z: 0 },
          adjacency: ['ghost', 'a'],
          zoneId: 'z',
          searchPriority: 1,
        },
        {
          id: 'a',
          position: { x: 1, y: 0, z: 0 },
          adjacency: ['a'],
          zoneId: 'z',
          searchPriority: 1,
        },
        { id: 'b', position: { x: 2, y: 0, z: 0 }, adjacency: [], zoneId: 'z', searchPriority: 1 },
      ],
    });
    expect(problems.some((p) => p.includes('duplicate'))).toBe(true);
    expect(problems.some((p) => p.includes('unknown node "ghost"'))).toBe(true);
    expect(problems.some((p) => p.includes('links to itself'))).toBe(true);
    expect(problems.some((p) => p.includes('orphan'))).toBe(true);
  });
});

describe('findRoute — BFS over authored adjacency', () => {
  it('finds the shortest hop path inclusive of both endpoints', () => {
    expect(findRoute(GRAPH, 'a', 'c')).toEqual(['a', 'b', 'c']);
  });

  it('returns a single-node route for from === to', () => {
    expect(findRoute(GRAPH, 'b', 'b')).toEqual(['b']);
  });

  it('returns null for unknown endpoints', () => {
    expect(findRoute(GRAPH, 'a', 'ghost')).toBeNull();
    expect(findRoute(GRAPH, 'ghost', 'a')).toBeNull();
  });

  it('respects closed doors — a door-gated node is unreachable until passable', () => {
    expect(findRoute(GRAPH, 'a', 'd', () => false)).toBeNull();
    expect(findRoute(GRAPH, 'a', 'd', (doorId) => doorId === 'door-1')).toEqual(['a', 'b', 'd']);
  });

  it('routes across the real facility graph: relay east to the lobby doorway', () => {
    const route = findRoute(FACILITY_THREAT_GRAPH, TNODE_RELAY_EAST, TNODE_CTRL_SOUTH);
    expect(route).not.toBeNull();
    expect(route?.[0]).toBe(TNODE_RELAY_EAST);
    expect(route?.[route.length - 1]).toBe(TNODE_CTRL_SOUTH);
    expect(route).toContain(TNODE_STAIR_BOTTOM); // must use the stairwell
  });
});

describe('orderSearchNodes — deterministic sweep ordering', () => {
  it('orders by priority desc, then distance to last-known asc, then id', () => {
    const order = orderSearchNodes(GRAPH, 'a', { x: 8, y: 0, z: 0 }, () => true);
    // c and d share priority 3; c is nearer the last-known position (8,0,0).
    expect(order).toEqual(['c', 'd', 'b']);
  });

  it('is reproducible — repeated calls give the identical order', () => {
    const first = orderSearchNodes(FACILITY_THREAT_GRAPH, TNODE_RELAY_EAST, { x: -4, y: 0, z: 18 });
    const second = orderSearchNodes(FACILITY_THREAT_GRAPH, TNODE_RELAY_EAST, {
      x: -4,
      y: 0,
      z: 18,
    });
    expect(first).toEqual(second);
    expect(first.length).toBe(FACILITY_THREAT_GRAPH.nodes.length - 1);
  });

  it('excludes door-blocked nodes from the sweep', () => {
    const order = orderSearchNodes(GRAPH, 'a', { x: 0, y: 0, z: 0 }, () => false);
    expect(order).not.toContain('d');
  });
});

describe('nearestNode', () => {
  it('returns the node closest to a world position', () => {
    expect(nearestNode(GRAPH, { x: 7.5, y: 0, z: 0.5 })?.id).toBe('c');
    expect(nearestNode({ nodes: [] }, { x: 0, y: 0, z: 0 })).toBeNull();
  });
});
