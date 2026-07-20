/**
 * Threat locomotion + investigation/search/pursuit behavior (Milestone 0.9).
 *
 * Owns the actor's LOGICAL position and facing — plain numbers, no Babylon.
 * Movement is frame-rate independent (distance covered is exactly
 * speed * dt, arrival snaps to the waypoint — same guarantee as
 * AntennaController.tickAxis) and always follows the authored nav graph;
 * pursuit is the one sanctioned exception, translating directly toward the
 * last-known player position INSIDE the encounter area at an authored speed
 * that never outruns the player's sprint. The scene adapter applies the
 * resulting ThreatMovementIntent as a kinematic transform: the actor never
 * teleports while active (position only ever integrates continuously) and
 * has no rigid body to tumble.
 */
import type { Point3 } from '../../facility/FacilityZone';
import type { ThreatMovementConfig } from '../ThreatDefinition';
import type { ThreatNodeId } from '../ThreatId';
import type { ThreatMovementIntent } from './ThreatMovementIntent';
import {
  distanceBetween,
  findRoute,
  getNode,
  orderSearchNodes,
  type ThreatNavGraph,
} from './ThreatSearchPattern';

export type ThreatBehaviorMode =
  'idle' | 'route' | 'investigate' | 'search' | 'pursue' | 'withdraw';

export interface ThreatBehaviorEvents {
  onNodeReached?(nodeId: ThreatNodeId): void;
  /** Investigation point reached and the authored pause has elapsed. */
  onInvestigationComplete?(): void;
  /** Every search node visited (or the search budget spent). */
  onSearchExhausted?(): void;
  /** Withdraw path finished — actor is back at its resolution node. */
  onWithdrawArrived?(): void;
}

export interface ThreatBehaviorDeps {
  readonly graph: ThreatNavGraph;
  readonly movement: ThreatMovementConfig;
  readonly isDoorPassable: (doorId: string) => boolean;
  readonly events: ThreatBehaviorEvents;
}

const ARRIVAL_EPSILON = 0.05;
/** Matches the established 0.1 s delta clamp precedent. */
export const MAX_BEHAVIOR_DT_SECONDS = 0.1;

export class ThreatBehaviorController {
  private mode: ThreatBehaviorMode = 'idle';
  private readonly position: { x: number; y: number; z: number };
  private facingYaw = 0;
  private movedThisTick = false;

  /** Remaining waypoints (world positions) for the current leg. */
  private waypoints: Point3[] = [];
  private waypointNodeIds: (ThreatNodeId | null)[] = [];
  private currentNodeId: ThreatNodeId | null = null;

  private pauseRemaining = 0;
  private searchQueue: ThreatNodeId[] = [];
  private searchElapsed = 0;
  private pursuitTarget: Point3 | null = null;

  constructor(
    private readonly deps: ThreatBehaviorDeps,
    startNodeId: ThreatNodeId,
  ) {
    const start = getNode(deps.graph, startNodeId);
    this.position = start !== undefined ? { ...start.position } : { x: 0, y: 0, z: 0 };
    this.currentNodeId = start?.id ?? null;
  }

  get behaviorMode(): ThreatBehaviorMode {
    return this.mode;
  }

  get currentPosition(): Readonly<Point3> {
    return this.position;
  }

  get currentFacingYaw(): number {
    return this.facingYaw;
  }

  get nearestNodeId(): ThreatNodeId | null {
    return this.currentNodeId;
  }

  get remainingSearchNodes(): readonly ThreatNodeId[] {
    return this.searchQueue;
  }

  getMovementIntent(): ThreatMovementIntent {
    return {
      position: { ...this.position },
      facingYaw: this.facingYaw,
      moving: this.movedThisTick,
    };
  }

  /** Instantly place the actor at a node (activation/reset only — never mid-encounter while visible). */
  placeAtNode(nodeId: ThreatNodeId): void {
    const node = getNode(this.deps.graph, nodeId);
    if (node === undefined) return;
    this.position.x = node.position.x;
    this.position.y = node.position.y;
    this.position.z = node.position.z;
    this.currentNodeId = node.id;
    this.stop();
  }

  /** Restores an exact position (confinement revert) without touching mode. */
  placeAtPosition(x: number, y: number, z: number): void {
    this.position.x = x;
    this.position.y = y;
    this.position.z = z;
  }

  faceToward(target: Point3): void {
    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    if (Math.hypot(dx, dz) > 1e-4) {
      this.facingYaw = Math.atan2(dx, dz);
    }
  }

  stop(): void {
    this.mode = 'idle';
    this.waypoints = [];
    this.waypointNodeIds = [];
    this.pauseRemaining = 0;
    this.searchQueue = [];
    this.searchElapsed = 0;
    this.pursuitTarget = null;
  }

  /** Walks the graph route to `targetNodeId`; false when unreachable. */
  startRouteTo(targetNodeId: ThreatNodeId): boolean {
    return this.beginGraphLeg(targetNodeId, 'route');
  }

  /**
   * Investigation: route to the graph node nearest the stimulus, then pause
   * (authored investigationPauseSeconds) while "observing", then report.
   */
  startInvestigation(stimulusPosition: Point3): boolean {
    const targetNode = this.nearestReachableNode(stimulusPosition);
    if (targetNode === null) return false;
    const ok = this.beginGraphLeg(targetNode, 'investigate');
    if (ok && this.waypoints.length === 0) {
      // Already at the investigation node: begin the pause immediately.
      this.pauseRemaining = this.deps.movement.investigationPauseSeconds;
      this.faceToward(stimulusPosition);
    }
    return ok;
  }

  /** Deterministic search sweep from the last-known player position. */
  startSearch(lastKnownPosition: Point3): boolean {
    const startId = this.currentNodeId;
    if (startId === null) return false;
    this.stop();
    this.mode = 'search';
    this.searchElapsed = 0;
    this.searchQueue = orderSearchNodes(
      this.deps.graph,
      startId,
      lastKnownPosition,
      this.deps.isDoorPassable,
    );
    this.advanceSearchLeg();
    return true;
  }

  /** Pursuit toward a continuously-updated last-known player position. */
  startPursuit(target: Point3): void {
    this.stop();
    this.mode = 'pursue';
    this.pursuitTarget = { ...target };
  }

  updatePursuitTarget(target: Point3): void {
    if (this.mode !== 'pursue') return;
    this.pursuitTarget = { ...target };
  }

  startWithdraw(homeNodeId: ThreatNodeId): boolean {
    const ok = this.beginGraphLeg(homeNodeId, 'withdraw');
    if (ok && this.waypoints.length === 0) {
      this.deps.events.onWithdrawArrived?.();
      this.mode = 'idle';
    }
    return ok;
  }

  update(deltaSecondsRaw: number): void {
    const dt = Math.min(Math.max(deltaSecondsRaw, 0), MAX_BEHAVIOR_DT_SECONDS);
    this.movedThisTick = false;

    switch (this.mode) {
      case 'idle':
        return;
      case 'route': {
        if (this.stepAlongWaypoints(this.deps.movement.moveSpeed, dt)) {
          this.mode = 'idle';
        }
        return;
      }
      case 'investigate': {
        if (this.waypoints.length > 0) {
          if (this.stepAlongWaypoints(this.deps.movement.moveSpeed, dt)) {
            this.pauseRemaining = this.deps.movement.investigationPauseSeconds;
          }
          return;
        }
        this.pauseRemaining -= dt;
        if (this.pauseRemaining <= 0) {
          this.mode = 'idle';
          this.deps.events.onInvestigationComplete?.();
        }
        return;
      }
      case 'search': {
        this.searchElapsed += dt;
        if (this.searchElapsed >= this.deps.movement.searchTimeoutSeconds) {
          this.searchQueue = [];
          this.mode = 'idle';
          this.deps.events.onSearchExhausted?.();
          return;
        }
        if (this.waypoints.length > 0) {
          if (this.stepAlongWaypoints(this.deps.movement.moveSpeed, dt)) {
            this.pauseRemaining = this.deps.movement.searchNodePauseSeconds;
          }
          return;
        }
        this.pauseRemaining -= dt;
        if (this.pauseRemaining <= 0) {
          if (this.searchQueue.length === 0) {
            this.mode = 'idle';
            this.deps.events.onSearchExhausted?.();
          } else {
            this.advanceSearchLeg();
          }
        }
        return;
      }
      case 'pursue': {
        const target = this.pursuitTarget;
        if (target === null) return;
        this.moveDirectlyToward(target, this.deps.movement.pursuitSpeed, dt);
        return;
      }
      case 'withdraw': {
        if (this.stepAlongWaypoints(this.deps.movement.moveSpeed, dt)) {
          this.mode = 'idle';
          this.deps.events.onWithdrawArrived?.();
        }
        return;
      }
    }
  }

  // ----- private ---------------------------------------------------------

  private nearestReachableNode(position: Point3): ThreatNodeId | null {
    const startId = this.currentNodeId;
    if (startId === null) return null;
    let best: ThreatNodeId | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const node of this.deps.graph.nodes) {
      const d = distanceBetween(node.position, position);
      if (d >= bestDistance) continue;
      if (findRoute(this.deps.graph, startId, node.id, this.deps.isDoorPassable) === null) continue;
      best = node.id;
      bestDistance = d;
    }
    return best;
  }

  private beginGraphLeg(targetNodeId: ThreatNodeId, mode: ThreatBehaviorMode): boolean {
    const startId = this.currentNodeId;
    if (startId === null) return false;
    const route = findRoute(this.deps.graph, startId, targetNodeId, this.deps.isDoorPassable);
    if (route === null) return false;
    this.stop();
    this.mode = mode;
    // Skip the start node itself (we are standing on it).
    const legIds = route.slice(1);
    this.waypoints = [];
    this.waypointNodeIds = [];
    for (const id of legIds) {
      const node = getNode(this.deps.graph, id);
      if (node !== undefined) {
        this.waypoints.push({ ...node.position });
        this.waypointNodeIds.push(id);
      }
    }
    return true;
  }

  private advanceSearchLeg(): void {
    while (this.searchQueue.length > 0) {
      const nextId = this.searchQueue.shift() as ThreatNodeId;
      const startId = this.currentNodeId;
      if (startId === null) break;
      const route = findRoute(this.deps.graph, startId, nextId, this.deps.isDoorPassable);
      if (route === null) continue; // Door closed since ordering — skip node.
      const legIds = route.slice(1);
      this.waypoints = [];
      this.waypointNodeIds = [];
      for (const id of legIds) {
        const node = getNode(this.deps.graph, id);
        if (node !== undefined) {
          this.waypoints.push({ ...node.position });
          this.waypointNodeIds.push(id);
        }
      }
      if (this.waypoints.length === 0) {
        this.pauseRemaining = this.deps.movement.searchNodePauseSeconds;
      }
      return;
    }
    // Nothing reachable left: finish the sweep on the next tick.
    this.waypoints = [];
    this.waypointNodeIds = [];
    this.pauseRemaining = 0;
  }

  /** Returns true when the final waypoint of the leg was reached this tick. */
  private stepAlongWaypoints(speed: number, dt: number): boolean {
    let budget = Math.max(speed, 0) * dt;
    while (budget > 0 && this.waypoints.length > 0) {
      const target = this.waypoints[0];
      if (target === undefined) break;
      const dx = target.x - this.position.x;
      const dy = target.y - this.position.y;
      const dz = target.z - this.position.z;
      const remaining = Math.hypot(dx, dy, dz);
      if (remaining <= budget + ARRIVAL_EPSILON) {
        this.position.x = target.x;
        this.position.y = target.y;
        this.position.z = target.z;
        budget -= remaining;
        this.waypoints.shift();
        const reachedId = this.waypointNodeIds.shift() ?? null;
        if (reachedId !== null) {
          this.currentNodeId = reachedId;
          this.deps.events.onNodeReached?.(reachedId);
        }
        this.movedThisTick = true;
      } else {
        const inv = 1 / remaining;
        this.position.x += dx * inv * budget;
        this.position.y += dy * inv * budget;
        this.position.z += dz * inv * budget;
        this.faceToward(target);
        this.movedThisTick = true;
        budget = 0;
      }
    }
    return this.waypoints.length === 0;
  }

  private moveDirectlyToward(target: Point3, speed: number, dt: number): void {
    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    const dz = target.z - this.position.z;
    const remaining = Math.hypot(dx, dy, dz);
    if (remaining < ARRIVAL_EPSILON) return;
    const step = Math.min(Math.max(speed, 0) * dt, remaining);
    const inv = 1 / remaining;
    this.position.x += dx * inv * step;
    this.position.y += dy * inv * step;
    this.position.z += dz * inv * step;
    this.faceToward(target);
    this.movedThisTick = true;
  }
}
