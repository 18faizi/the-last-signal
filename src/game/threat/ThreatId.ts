/**
 * Threat identifiers (Milestone 0.9).
 *
 * Plain string aliases, mirroring AntennaArrayId/SignalId: strong enough for
 * signatures and registries, cheap enough for plain-data snapshots.
 */
export type ThreatId = string;

/** Authored nav-graph node id, e.g. 'fg-tnode-stairwell-top'. */
export type ThreatNodeId = string;

/** Authored encounter id, e.g. 'fg-encounter-first-contact'. */
export type EncounterId = string;

/** Authored manifestation id, e.g. 'fg-manifest-stairwell-silhouette'. */
export type ManifestationId = string;

/** Authored hiding spot id, e.g. 'fg-hide-control-cabinet'. */
export type HidingSpotId = string;

/** Authored safe zone id, e.g. 'fg-safezone-control-room'. */
export type SafeZoneId = string;
