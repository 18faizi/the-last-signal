/**
 * Token-based gameplay-input suspension (pure).
 *
 * Multiple systems (inspection, document reading, future cutscenes/menus)
 * can each hold a lock; gameplay input resumes only when every token has
 * been released. Tokens are unique objects, so releasing one system's lock
 * can never accidentally release another's, and double-release is a no-op.
 */
export type InputSuspensionReason =
  'inspection' | 'document' | 'transition' | 'inventory' | 'power-panel';

export interface InputLockToken {
  readonly reason: InputSuspensionReason;
}

export class InputLockSet {
  private readonly tokens = new Set<InputLockToken>();

  acquire(reason: InputSuspensionReason): InputLockToken {
    const token: InputLockToken = { reason };
    this.tokens.add(token);
    return token;
  }

  release(token: InputLockToken): void {
    this.tokens.delete(token);
  }

  get isLocked(): boolean {
    return this.tokens.size > 0;
  }

  get count(): number {
    return this.tokens.size;
  }

  get reasons(): readonly InputSuspensionReason[] {
    return [...this.tokens].map((token) => token.reason);
  }

  clear(): void {
    this.tokens.clear();
  }
}
