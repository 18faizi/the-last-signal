/**
 * Full-screen accessible signal receiver dialog.
 *
 * DOM/accessibility structure follows DistributionPanelView.ts exactly:
 * role=dialog, aria-modal, focus moves to the close button on open, Escape
 * closes, focus returns to the canvas on close via the owning session
 * (ReceiverPanelSession) — this view's own close() only tears down the
 * DOM/rAF, mirroring DistributionPanelView's one-directional close flow so
 * escape/click handlers never re-enter.
 *
 * Owns exactly one requestAnimationFrame loop, started in open() and
 * cancelled in close()/dispose() — the two canvases (Spectrum/Waveform)
 * never run their own timers, so there is never more than one animation
 * loop for the whole panel, and it never runs while the panel is closed.
 */
import type { Disposable } from '../../app/lifecycle/Disposable';
import type { ReceiverController } from '../../game/receiver/ReceiverController';
import type { SignalDefinition } from '../../game/signal/SignalDefinition';
import type { DocumentDefinition } from '../../game/interaction/documents/DocumentDefinition';
import { SpectrumView } from './SpectrumView';
import { WaveformView } from './WaveformView';
import { ReceiverControlView, CONTROL_ROWS, type ControlRow } from './ReceiverControlView';
import { DecodeProgressView } from './DecodeProgressView';
import { TranscriptView } from './TranscriptView';

export class ReceiverPanelView implements Disposable {
  private readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly transcriptButton: HTMLButtonElement;
  private readonly spectrum: SpectrumView;
  private readonly waveform: WaveformView;
  private readonly controlView: ReceiverControlView;
  private readonly decodeProgressView: DecodeProgressView;
  private readonly transcript: TranscriptView;

  private isOpenFlag = false;
  private onCloseCallback: (() => void) | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private wheelHandler: ((e: WheelEvent) => void) | null = null;
  private rafHandle: number | null = null;
  private selectedRow: ControlRow = 'channel';
  private readonly startTime = performance.now();

  constructor(
    parent: HTMLElement,
    private readonly controller: ReceiverController,
    private readonly getActiveSignalDefinition: () => SignalDefinition | undefined,
    private readonly getDocument: (documentId: string) => DocumentDefinition | undefined,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'receiver-panel-viewer';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', 'Signal Receiver');
    this.root.hidden = true;

    this.panel = document.createElement('div');
    this.panel.className = 'receiver-panel';

    const header = document.createElement('div');
    header.className = 'receiver-panel-header';
    const title = document.createElement('h2');
    title.className = 'receiver-panel-title';
    title.textContent = 'SIGNAL RECEIVER';
    this.transcriptButton = document.createElement('button');
    this.transcriptButton.type = 'button';
    this.transcriptButton.className = 'receiver-transcript-open-btn';
    this.transcriptButton.textContent = 'VIEW TRANSCRIPT';
    this.transcriptButton.hidden = true;
    this.transcriptButton.addEventListener('click', () => this.openTranscript());
    this.closeButton = document.createElement('button');
    this.closeButton.type = 'button';
    this.closeButton.className = 'receiver-panel-close';
    this.closeButton.textContent = 'CLOSE [ESC]';
    this.closeButton.addEventListener('click', () => this.onCloseCallback?.());
    header.append(title, this.transcriptButton, this.closeButton);

    const body = document.createElement('div');
    body.className = 'receiver-panel-body';
    const visuals = document.createElement('div');
    visuals.className = 'receiver-panel-visuals';
    this.spectrum = new SpectrumView(visuals);
    this.waveform = new WaveformView(visuals);
    const controls = document.createElement('div');
    controls.className = 'receiver-panel-controls';
    this.controlView = new ReceiverControlView(controls, {
      onCoarseAdjust: (row, dir) => this.adjust(row, dir, false),
      onFineAdjust: (row, dir) => this.adjust(row, dir, true),
      onSelectRow: (row) => {
        this.selectedRow = row;
      },
      onScanToggle: () => this.toggleScan(),
      onReset: () => this.controller.resetControls(),
    });
    this.decodeProgressView = new DecodeProgressView(controls);
    body.append(visuals, controls);

    this.transcript = new TranscriptView(this.panel, () => this.closeTranscript());

    this.panel.append(header, body);
    this.root.append(this.panel);
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return this.isOpenFlag;
  }

  open(onClose: () => void): void {
    if (this.isOpenFlag) return;
    this.isOpenFlag = true;
    this.onCloseCallback = onClose;
    this.selectedRow = 'channel';
    this.root.hidden = false;
    this.closeButton.focus();

    this.keydownHandler = (e: KeyboardEvent) => this.handleKeydown(e);
    document.addEventListener('keydown', this.keydownHandler);
    this.wheelHandler = (e: WheelEvent) => this.handleWheel(e);
    this.panel.addEventListener('wheel', this.wheelHandler, { passive: false });

    this.spectrum.resize();
    this.waveform.resize();
    this.scheduleFrame();
  }

  close(returnFocusTo: HTMLElement): void {
    if (!this.isOpenFlag) return;
    this.isOpenFlag = false;
    this.root.hidden = true;
    if (this.transcript.isOpen) this.transcript.close();
    if (this.keydownHandler !== null) {
      document.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.wheelHandler !== null) {
      this.panel.removeEventListener('wheel', this.wheelHandler);
      this.wheelHandler = null;
    }
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    // Mirrors DistributionPanelView: close() never invokes onCloseCallback —
    // only the escape/close-button/session flow does, avoiding re-entrancy.
    this.onCloseCallback = null;
    returnFocusTo.focus();
  }

  dispose(): void {
    if (this.keydownHandler !== null) {
      document.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    this.spectrum.dispose();
    this.waveform.dispose();
    this.controlView.dispose();
    this.decodeProgressView.dispose();
    this.transcript.dispose();
    this.root.remove();
  }

  // ----- private -------------------------------------------------------------

  private scheduleFrame(): void {
    this.rafHandle = requestAnimationFrame(() => {
      this.renderFrame();
      if (this.isOpenFlag) this.scheduleFrame();
    });
  }

  private renderFrame(): void {
    const snapshot = this.controller.getSnapshot();
    const elapsed = (performance.now() - this.startTime) / 1000;
    const activeSignal = this.getActiveSignalDefinition();
    this.spectrum.resize();
    this.spectrum.draw(
      snapshot,
      activeSignal,
      this.controller.definition.minFrequencyMHz,
      this.controller.definition.maxFrequencyMHz,
      elapsed,
    );
    this.waveform.resize();
    this.waveform.draw(snapshot, elapsed);
    this.controlView.render(snapshot, this.selectedRow);
    this.decodeProgressView.render(snapshot);
    this.transcriptButton.hidden = snapshot.mode !== 'Decoded';
  }

  private toggleScan(): void {
    if (this.controller.isScanning) {
      this.controller.cancelScan();
    } else {
      this.controller.startScan();
    }
  }

  private adjust(row: ControlRow, direction: 1 | -1, fine: boolean): void {
    const def = this.controller.definition;
    switch (row) {
      case 'channel':
        this.controller.setChannel(this.controller.currentControls.channel + direction);
        break;
      case 'frequency':
        this.controller.adjustFrequency(
          direction * (fine ? def.frequencyStepFine : def.frequencyStepCoarse),
        );
        break;
      case 'gain':
        this.controller.adjustGain(direction * (fine ? def.gainStepFine : def.gainStepCoarse));
        break;
      case 'filter':
        this.controller.adjustFilter(
          direction * (fine ? def.filterStepFine : def.filterStepCoarse),
        );
        break;
      case 'phase':
        this.controller.adjustPhase(
          direction * (fine ? def.phaseStepFineDeg : def.phaseStepCoarseDeg),
        );
        break;
    }
  }

  private openTranscript(): void {
    const activeSignal = this.getActiveSignalDefinition();
    if (activeSignal === undefined) return;
    const doc = this.getDocument(activeSignal.transcriptDocumentId);
    if (doc === undefined) return;
    this.transcript.open(doc);
  }

  private closeTranscript(): void {
    this.transcript.close();
    this.closeButton.focus();
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    const direction: 1 | -1 = e.deltaY > 0 ? -1 : 1;
    this.adjust(this.selectedRow, direction, e.shiftKey);
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (this.transcript.isOpen) {
      if (e.code === 'Escape') {
        e.preventDefault();
        this.closeTranscript();
      }
      return;
    }

    switch (e.code) {
      case 'Escape':
        e.preventDefault();
        this.onCloseCallback?.();
        return;
      case 'ArrowUp':
      case 'KeyW':
        e.preventDefault();
        this.moveSelection(-1);
        return;
      case 'ArrowDown':
      case 'KeyS':
        e.preventDefault();
        this.moveSelection(1);
        return;
      case 'ArrowLeft':
      case 'KeyA':
        e.preventDefault();
        this.adjust(this.selectedRow, -1, e.shiftKey);
        return;
      case 'ArrowRight':
      case 'KeyD':
        e.preventDefault();
        this.adjust(this.selectedRow, 1, e.shiftKey);
        return;
      case 'Enter':
      case 'Space':
        e.preventDefault();
        if (this.controller.receiverMode === 'Decoded') {
          this.openTranscript();
        } else {
          this.toggleScan();
        }
        return;
      case 'KeyR':
        e.preventDefault();
        this.controller.resetControls();
        return;
      default:
        return;
    }
  }

  private moveSelection(delta: 1 | -1): void {
    const index = CONTROL_ROWS.indexOf(this.selectedRow);
    const nextIndex = (index + delta + CONTROL_ROWS.length) % CONTROL_ROWS.length;
    this.selectedRow = CONTROL_ROWS[nextIndex] ?? 'channel';
  }
}
