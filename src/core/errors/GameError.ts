/**
 * Typed error kinds for every failure class the application distinguishes.
 * The kind drives both the user-facing message on the fatal-error screen and
 * where the error is reported.
 */
export type GameErrorKind =
  'engine-init' | 'physics-init' | 'scene-create' | 'asset-load' | 'unexpected';

const USER_MESSAGES: Readonly<Record<GameErrorKind, string>> = {
  'engine-init':
    'The 3D renderer could not be started. Your browser may not support WebGL or WebGPU.',
  'physics-init': 'The physics system failed to load.',
  'scene-create': 'A scene failed to load.',
  'asset-load': 'A required asset failed to load.',
  unexpected: 'An unexpected error occurred.',
};

export class GameError extends Error {
  readonly kind: GameErrorKind;
  /** Message safe to show to a player, without technical detail. */
  readonly userMessage: string;

  constructor(kind: GameErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'GameError';
    this.kind = kind;
    this.userMessage = USER_MESSAGES[kind];
  }

  /** Wraps an arbitrary thrown value, preserving it as `cause`. */
  static wrap(kind: GameErrorKind, thrown: unknown, contextMessage: string): GameError {
    if (thrown instanceof GameError) {
      return thrown;
    }
    const detail = thrown instanceof Error ? thrown.message : String(thrown);
    return new GameError(kind, `${contextMessage}: ${detail}`, { cause: thrown });
  }
}
