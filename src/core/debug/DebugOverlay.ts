import type { Disposable } from '../../app/lifecycle/Disposable';
import type { DebugStateProvider } from './DebugState';

const FIELD_LABELS = [
  'FPS',
  'Lifecycle',
  'Scene',
  'Backend',
  'Resolution',
  'HW scaling',
  'Physics',
  'Meshes',
  'Camera',
  'Pointer lock',
  'Keys',
  'Build',
] as const;

/**
 * Development-only diagnostic overlay.
 *
 * Only constructed when the app runs in development mode, so production
 * bundles never show it. Updates on a timer (not per frame) and mutates
 * `textContent` of pre-built rows, so a refresh costs a handful of DOM text
 * updates and no reflows of the page structure.
 */
export class DebugOverlay implements Disposable {
  private readonly root: HTMLElement;
  private readonly provider: DebugStateProvider;
  private readonly valueCells: HTMLElement[] = [];
  private readonly extraValueCells: HTMLElement[] = [];
  private extraList: HTMLElement | null = null;
  private extraLabelsKey = '';
  private intervalId: number | null = null;
  private readonly updateIntervalMs: number;
  private visible = false;

  constructor(root: HTMLElement, provider: DebugStateProvider, updateIntervalMs: number) {
    this.root = root;
    this.provider = provider;
    this.updateIntervalMs = updateIntervalMs;
    this.buildDom();
  }

  toggle(): void {
    this.setVisible(!this.visible);
  }

  isVisible(): boolean {
    return this.visible;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.root.hidden = !visible;
    if (visible) {
      this.refresh();
      this.intervalId ??= window.setInterval(() => this.refresh(), this.updateIntervalMs);
    } else if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  dispose(): void {
    this.setVisible(false);
    this.root.replaceChildren();
    this.valueCells.length = 0;
    this.extraValueCells.length = 0;
    this.extraList = null;
    this.extraLabelsKey = '';
  }

  private buildDom(): void {
    const list = document.createElement('dl');
    list.className = 'debug-list';
    for (const label of FIELD_LABELS) {
      const term = document.createElement('dt');
      term.textContent = label;
      const value = document.createElement('dd');
      value.textContent = '—';
      list.append(term, value);
      this.valueCells.push(value);
    }
    this.root.replaceChildren(list);
  }

  private refresh(): void {
    const state = this.provider();
    const values: string[] = [
      state.fps.toFixed(0),
      state.lifecycle,
      state.activeScene,
      state.renderingBackend,
      `${state.renderWidth}x${state.renderHeight}`,
      state.hardwareScalingLevel.toFixed(2),
      state.physicsStatus,
      String(state.meshCount),
      state.activeCameraName,
      state.pointerLocked ? 'locked' : 'unlocked',
      state.pressedKeys.slice(0, 6).join(' ') || 'none',
      state.buildMode,
    ];
    for (let i = 0; i < values.length; i += 1) {
      const cell = this.valueCells[i];
      const value = values[i];
      if (cell !== undefined && value !== undefined && cell.textContent !== value) {
        cell.textContent = value;
      }
    }
    this.refreshExtraRows(state.extra);
  }

  /**
   * Scene-contributed rows. The DOM structure is rebuilt only when the set
   * of labels changes (e.g. a scene transition); steady-state refreshes just
   * update text content like the fixed rows above.
   */
  private refreshExtraRows(extra: ReadonlyArray<readonly [string, string]>): void {
    const labels = extra.map(([label]) => label).join('|');
    if (labels !== this.extraLabelsKey) {
      this.extraLabelsKey = labels;
      this.extraValueCells.length = 0;
      this.extraList?.remove();
      this.extraList = null;
      if (extra.length > 0) {
        const list = document.createElement('dl');
        list.className = 'debug-list debug-list-extra';
        for (const [label] of extra) {
          const term = document.createElement('dt');
          term.textContent = label;
          const value = document.createElement('dd');
          value.textContent = '—';
          list.append(term, value);
          this.extraValueCells.push(value);
        }
        this.root.append(list);
        this.extraList = list;
      }
    }
    for (let i = 0; i < extra.length; i += 1) {
      const cell = this.extraValueCells[i];
      const value = extra[i]?.[1];
      if (cell !== undefined && value !== undefined && cell.textContent !== value) {
        cell.textContent = value;
      }
    }
  }
}
