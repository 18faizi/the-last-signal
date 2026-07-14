import { describe, expect, it, vi } from 'vitest';
import { ErrorReporter } from '../../core/errors/ErrorReporter';
import { GameError } from '../../core/errors/GameError';

describe('GameError', () => {
  it('carries kind and a user-facing message', () => {
    const error = new GameError('engine-init', 'WebGL context lost');
    expect(error.kind).toBe('engine-init');
    expect(error.name).toBe('GameError');
    expect(error.userMessage).toMatch(/renderer/i);
    expect(error.message).toBe('WebGL context lost');
  });

  it('preserves the cause chain when wrapping', () => {
    const original = new Error('wasm fetch failed');
    const wrapped = GameError.wrap('physics-init', original, 'Havok load');
    expect(wrapped.kind).toBe('physics-init');
    expect(wrapped.cause).toBe(original);
    expect(wrapped.message).toContain('wasm fetch failed');
  });

  it('does not double-wrap an existing GameError', () => {
    const original = new GameError('scene-create', 'scene blew up');
    const wrapped = GameError.wrap('unexpected', original, 'outer context');
    expect(wrapped).toBe(original);
    expect(wrapped.kind).toBe('scene-create');
  });

  it('stringifies non-Error thrown values', () => {
    const wrapped = GameError.wrap('asset-load', 'plain string failure', 'loading thing');
    expect(wrapped.message).toContain('plain string failure');
  });
});

describe('ErrorReporter', () => {
  it('notifies the fatal listener', () => {
    const reporter = new ErrorReporter({ mode: 'test', isDevelopment: false, isProduction: false });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const listener = vi.fn();
    reporter.onFatal(listener);

    const error = new GameError('unexpected', 'boom');
    reporter.reportFatal(error);
    expect(listener).toHaveBeenCalledWith(error);
  });

  it('does not throw when no fatal listener is registered', () => {
    const reporter = new ErrorReporter({ mode: 'test', isDevelopment: false, isProduction: false });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => reporter.reportFatal(new GameError('unexpected', 'boom'))).not.toThrow();
  });
});
