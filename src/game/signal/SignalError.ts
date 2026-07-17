/** Typed error/rejection codes used throughout the signal domain (mirrors PowerError.ts). */
export type SignalErrorCode =
  'unknown-signal' | 'duplicate-id' | 'invalid-definition' | 'missing-transcript';

export class SignalError extends Error {
  readonly code: SignalErrorCode;

  constructor(code: SignalErrorCode, message: string) {
    super(message);
    this.name = 'SignalError';
    this.code = code;
  }
}
