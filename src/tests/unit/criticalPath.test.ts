/**
 * Unit tests for CriticalPathGraphValidator.
 */

import { describe, expect, it } from 'vitest';
import { CriticalPathGraphValidator } from '../../game/flow/validation/CriticalPathGraphValidator';

describe('CriticalPathGraphValidator', () => {
  it('validates the complete 10-chapter game flow without cycles or unreachable nodes', () => {
    const result = CriticalPathGraphValidator.validate();
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.unreachableChapters).toEqual([]);
  });
});
