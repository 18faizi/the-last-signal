/**
 * Collision filter groups (bitmasks) shared by the player and world geometry.
 *
 * Havok filters pass when `shapeA.filterMembershipMask & shapeB.filterCollideMask`
 * is non-zero (and vice versa). Scene builders assign WORLD membership to
 * static geometry; the player capsule is PLAYER membership and collides with
 * WORLD only, so player-owned probe raycasts can target WORLD without ever
 * hitting the player's own capsule.
 */
export const FILTER_GROUP_WORLD = 1 << 0;
export const FILTER_GROUP_PLAYER = 1 << 1;
