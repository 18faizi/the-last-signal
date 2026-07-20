/**
 * Authored-data validation for the threat domain (Milestone 0.9).
 *
 * Runs at scene creation in development builds (mirrors AntennaValidation/
 * PowerValidation) and is unit-tested directly. Returns human-readable
 * problem strings; the scene throws when any exist.
 */
import {
  validateThreatNavGraph,
  getNode,
  type ThreatNavGraph,
} from './behavior/ThreatSearchPattern';
import type { ThreatDefinition } from './ThreatDefinition';

export interface ThreatValidationContext {
  readonly graph: ThreatNavGraph;
  readonly zoneIds: readonly string[];
  readonly safeZoneIds: readonly string[];
  readonly hidingSpotIds: readonly string[];
  readonly checkpointIds: readonly string[];
  readonly doorIds: readonly string[];
}

export function validateThreatDefinition(
  def: ThreatDefinition,
  ctx: ThreatValidationContext,
): string[] {
  const problems: string[] = [];
  const prefix = `threat "${def.id}"`;

  problems.push(...validateThreatNavGraph(ctx.graph).map((p) => `${prefix}: ${p}`));

  if (getNode(ctx.graph, def.homeNodeId) === undefined) {
    problems.push(`${prefix}: homeNodeId "${def.homeNodeId}" is not a nav node`);
  }
  for (const zoneId of def.allowedZoneIds) {
    if (!ctx.zoneIds.includes(zoneId)) {
      problems.push(`${prefix}: allowed zone "${zoneId}" is not a registered zone`);
    }
  }
  for (const safeZoneId of def.safeZoneIds) {
    if (!ctx.safeZoneIds.includes(safeZoneId)) {
      problems.push(`${prefix}: safe zone "${safeZoneId}" is not registered`);
    }
  }
  for (const node of ctx.graph.nodes) {
    if (!def.allowedZoneIds.includes(node.zoneId)) {
      problems.push(
        `${prefix}: nav node "${node.id}" sits in zone "${node.zoneId}" outside the allowed set`,
      );
    }
    if (node.requiresDoorId !== undefined && !ctx.doorIds.includes(node.requiresDoorId)) {
      problems.push(
        `${prefix}: nav node "${node.id}" requires unknown door "${node.requiresDoorId}"`,
      );
    }
  }

  const v = def.vision;
  if (v.maxViewDistance <= 0) problems.push(`${prefix}: maxViewDistance must be positive`);
  if (v.horizontalFovDeg <= 0 || v.horizontalFovDeg > 360) {
    problems.push(`${prefix}: horizontalFovDeg must be in (0, 360]`);
  }
  if (v.falloffStartDistance < 0 || v.falloffStartDistance > v.maxViewDistance) {
    problems.push(`${prefix}: falloffStartDistance must be within [0, maxViewDistance]`);
  }
  if (!(v.sprintMultiplier >= v.walkMultiplier && v.walkMultiplier >= v.crouchMultiplier)) {
    problems.push(`${prefix}: movement multipliers must order sprint >= walk >= crouch`);
  }
  for (const [name, value] of [
    ['peripheralPenalty', v.peripheralPenalty],
    ['behindMultiplier', v.behindMultiplier],
  ] as const) {
    if (value < 0 || value > 1) problems.push(`${prefix}: ${name} must be within [0, 1]`);
  }

  const s = def.suspicion;
  if (!(s.suspiciousThreshold > 0 && s.suspiciousThreshold < s.investigateThreshold)) {
    problems.push(`${prefix}: suspicion thresholds must order 0 < suspicious < investigate`);
  }
  if (s.investigateThreshold > 1) problems.push(`${prefix}: investigateThreshold must be <= 1`);
  if (!(s.relaxThreshold >= 0 && s.relaxThreshold < s.suspiciousThreshold)) {
    problems.push(`${prefix}: relaxThreshold must be within [0, suspiciousThreshold)`);
  }
  for (const [name, value] of [
    ['suspicionGainPerSecond', s.suspicionGainPerSecond],
    ['suspicionDecayPerSecond', s.suspicionDecayPerSecond],
    ['detectionGainPerSecond', s.detectionGainPerSecond],
    ['detectionDecayPerSecond', s.detectionDecayPerSecond],
    ['detectionDecayAfterLosBreakPerSecond', s.detectionDecayAfterLosBreakPerSecond],
  ] as const) {
    if (value <= 0) problems.push(`${prefix}: ${name} must be positive`);
  }
  if (s.detectionDecayAfterLosBreakPerSecond > s.detectionDecayPerSecond) {
    problems.push(
      `${prefix}: post-LOS-break detection decay must be slower (smaller) than in-LOS decay`,
    );
  }
  if (s.detectionVisionFloor <= 0 || s.detectionVisionFloor >= 1) {
    problems.push(`${prefix}: detectionVisionFloor must be within (0, 1)`);
  }

  const m = def.movement;
  for (const [name, value] of [
    ['moveSpeed', m.moveSpeed],
    ['pursuitSpeed', m.pursuitSpeed],
    ['investigationPauseSeconds', m.investigationPauseSeconds],
    ['searchNodePauseSeconds', m.searchNodePauseSeconds],
    ['searchTimeoutSeconds', m.searchTimeoutSeconds],
    ['pursuitLosLossSeconds', m.pursuitLosLossSeconds],
    ['captureRadius', m.captureRadius],
  ] as const) {
    if (value <= 0) problems.push(`${prefix}: ${name} must be positive`);
  }

  return problems;
}
