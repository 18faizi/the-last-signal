import { describe, expect, it } from 'vitest';
import { formatPrompt } from '../../game/interaction/InteractionPromptFormat';

const SPEC = { verb: 'USE', label: 'SWITCH' };

describe('formatPrompt', () => {
  it('formats an immediate prompt with the key hint', () => {
    const display = formatPrompt(SPEC, { status: 'available' }, 'immediate', 'E');
    expect(display).toEqual({ keyHint: '[E]', text: 'USE SWITCH', disabled: false });
  });

  it('formats hold prompts with HOLD', () => {
    const display = formatPrompt(
      { verb: 'RESET', label: 'BREAKER' },
      { status: 'available' },
      'hold',
      'E',
    );
    expect(display.keyHint).toBe('[HOLD E]');
    expect(display.text).toBe('RESET BREAKER');
  });

  it('never shows a key for disabled targets', () => {
    const display = formatPrompt(
      SPEC,
      { status: 'disabled', reason: 'REQUIRES POWER' },
      'immediate',
      'E',
    );
    expect(display.keyHint).toBe('');
    expect(display.text).toBe('REQUIRES POWER');
    expect(display.disabled).toBe(true);
  });

  it('disabled-kind targets are disabled even when availability is available', () => {
    const display = formatPrompt(SPEC, { status: 'available' }, 'disabled', 'E');
    expect(display.disabled).toBe(true);
    expect(display.keyHint).toBe('');
  });

  it('busy targets show a waiting text without a key', () => {
    const display = formatPrompt(SPEC, { status: 'busy' }, 'immediate', 'E');
    expect(display.keyHint).toBe('');
    expect(display.text).toBe('SWITCH…');
    expect(display.disabled).toBe(true);
  });
});
