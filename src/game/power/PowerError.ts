/** Typed error/rejection codes used throughout the power domain. */
export type PowerErrorCode =
  | 'unknown-source'
  | 'unknown-circuit'
  | 'unknown-load'
  | 'duplicate-id'
  | 'source-unavailable'
  | 'source-ineligible'
  | 'insufficient-capacity'
  | 'invalid-definition';

export class PowerError extends Error {
  readonly code: PowerErrorCode;

  constructor(code: PowerErrorCode, message: string) {
    super(message);
    this.name = 'PowerError';
    this.code = code;
  }
}
