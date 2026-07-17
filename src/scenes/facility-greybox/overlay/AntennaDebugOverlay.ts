/**
 * Development-only F2 antenna/bearing debug overlay.
 *
 * Mirrors SignalDebugOverlay's (F11) pattern exactly: a DOM text panel
 * refreshed at a reduced rate, dev-only, hidden by default, disposed
 * cleanly, and never constructed in production. F2 was chosen specifically
 * because F12 conflicts with browser devtools (see InputAction.ts).
 */
import type { Disposable } from '../../../app/lifecycle/Disposable';
import type { AntennaController } from '../../../game/antenna/AntennaController';
import type { WaveguideController } from '../../../game/waveguide/WaveguideController';
import type { SourceAnalysisController } from '../../../game/source-analysis/SourceAnalysisController';
import type { AntennaArrayDefinition } from '../../../game/antenna/AntennaArrayDefinition';
import { formatAntennaDebugFields } from '../../../game/antenna/AntennaDebugView';

export class AntennaDebugOverlay implements Disposable {
  private readonly root: HTMLElement;
  private readonly content: HTMLElement;
  private visible = false;
  private frameCounter = 0;
  private readonly UPDATE_INTERVAL = 15;

  constructor(
    parent: HTMLElement,
    private readonly antenna: AntennaController,
    private readonly waveguide: WaveguideController,
    private readonly sourceAnalysis: SourceAnalysisController,
    private readonly getDefinition: (id: string) => AntennaArrayDefinition | undefined,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'antenna-debug-overlay';
    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-label', 'Antenna debug info');
    this.root.hidden = true;
    Object.assign(this.root.style, {
      position: 'fixed',
      bottom: '16px',
      left: '16px',
      width: '360px',
      maxHeight: 'calc(100vh - 80px)',
      overflowY: 'auto',
      background: 'rgba(10, 14, 20, 0.92)',
      border: '1px solid #3a5a4a',
      borderRadius: '4px',
      padding: '10px',
      zIndex: '8960',
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#aaffcc',
      boxSizing: 'border-box',
    });

    const header = document.createElement('div');
    header.textContent = 'ANTENNA DEBUG — F2 to close';
    Object.assign(header.style, {
      color: '#c8fff0',
      marginBottom: '8px',
      borderBottom: '1px solid #3a5a4a',
      paddingBottom: '6px',
    });
    this.root.append(header);

    this.content = document.createElement('pre');
    Object.assign(this.content.style, {
      margin: '0',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      fontSize: '10px',
      color: '#aaffcc',
    });
    this.root.append(this.content);
    parent.append(this.root);
  }

  get isVisible(): boolean {
    return this.visible;
  }

  show(): void {
    this.visible = true;
    this.root.hidden = false;
    this.refresh();
  }

  hide(): void {
    this.visible = false;
    this.root.hidden = true;
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  /** Call from onBeforeRenderObservable each frame. */
  tick(): void {
    if (!this.visible) return;
    this.frameCounter++;
    if (this.frameCounter >= this.UPDATE_INTERVAL) {
      this.frameCounter = 0;
      this.refresh();
    }
  }

  private refresh(): void {
    const snapshot = this.antenna.getSnapshot();
    const lines = formatAntennaDebugFields(
      snapshot,
      this.getDefinition,
      (pathId) => this.waveguide.getSnapshot(pathId),
      this.sourceAnalysis.getSnapshot(),
    ).map(([k, v]) => `${k}: ${v}`);
    this.content.textContent = lines.join('\n');
  }

  dispose(): void {
    this.root.remove();
  }
}
