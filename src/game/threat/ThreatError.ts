/**
 * Typed threat-domain error (mirrors AntennaError exactly).
 */
export type ThreatErrorCode =
  | 'duplicate-id'
  | 'unknown-id'
  | 'invalid-transition'
  | 'invalid-definition'
  | 'invalid-graph'
  | 'not-active';

export class ThreatError extends Error {
  readonly code: ThreatErrorCode;

  constructor(code: ThreatErrorCode, message: string) {
    super(message);
    this.name = 'ThreatError';
    this.code = code;
  }
}
