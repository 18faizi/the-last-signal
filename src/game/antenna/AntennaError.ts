/** Typed error/rejection codes used throughout the antenna domain (mirrors SignalError.ts/PowerError.ts). */
export type AntennaErrorCode =
  'unknown-array' | 'duplicate-id' | 'invalid-definition' | 'no-array-selected';

export class AntennaError extends Error {
  readonly code: AntennaErrorCode;

  constructor(code: AntennaErrorCode, message: string) {
    super(message);
    this.name = 'AntennaError';
    this.code = code;
  }
}
