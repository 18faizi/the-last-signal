/** Anything owning browser listeners, observers, intervals or subscriptions. */
export interface Disposable {
  dispose(): void;
}

/**
 * Collects disposables (or plain cleanup functions) so an owner can release
 * everything it registered in one deterministic call. Disposal runs in
 * reverse registration order and is idempotent.
 */
export class DisposableBag implements Disposable {
  private readonly entries: Array<() => void> = [];
  private disposed = false;

  add(entry: Disposable | (() => void)): void {
    if (this.disposed) {
      throw new Error('Cannot add to a disposed DisposableBag');
    }
    this.entries.push(typeof entry === 'function' ? entry : () => entry.dispose());
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (let i = this.entries.length - 1; i >= 0; i -= 1) {
      this.entries[i]?.();
    }
    this.entries.length = 0;
  }
}
