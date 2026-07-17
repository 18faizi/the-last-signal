/**
 * Full-screen accessible antenna control panel dialog.
 *
 * DOM/accessibility structure follows ReceiverPanelView.ts's pattern
 * exactly: role=dialog, aria-modal, focus moves to the close button on
 * open, Escape closes, keyboard input is scoped to a `document`-level
 * listener bounded to open()/close() (NOT the global InputAction system —
 * this avoids conflicting with the existing R-respawn/other bindings while
 * the panel is open, exactly like ReceiverPanelView's own keydown scoping).
 *
 * REMOTE ROOFTOP FEEDBACK (spec §27): rather than building a separate
 * remote-telemetry system, this panel simply always shows receiver
 * quality / waveguide continuity / bearing stability / analysis-readiness
 * as part of its own live readout (see the `readinessEl` row below) — the
 * player operates the antenna cabinet ON the rooftop already, so the
 * "remote feedback" requirement is satisfied by the panel itself never
 * needing the player to walk back to the control room to see receiver
 * quality. Documented here per the milestone's explicit request to justify
 * this choice.
 *
 * ONE animation-frame loop, scoped to this panel's own open()/close()
 * lifecycle — this NEVER touches or duplicates ReceiverPanelView's loop
 * (constraint: at most one new loop, reserved for continuously-varying
 * displays; the alignment meters are the continuously-varying element that
 * justifies it here, everything else is cheap to recompute alongside them).
 */
import type { Disposable } from '../../app/lifecycle/Disposable';
import type { AntennaController } from '../../game/antenna/AntennaController';
import type { AntennaArrayDefinition } from '../../game/antenna/AntennaArrayDefinition';
import type { AntennaArrayId } from '../../game/antenna/AntennaArrayId';
import type { WaveguideController } from '../../game/waveguide/WaveguideController';
import type { SourceAnalysisController } from '../../game/source-analysis/SourceAnalysisController';
import { evaluateBearing } from '../../game/source-analysis/BearingEvaluator';
import { evaluateAnalysisQualityCeiling } from '../../game/source-analysis/AnalysisQualityEvaluator';
import type { ReceiverMetrics } from '../../game/signal/ReceiverMetrics';
import {
  AntennaControlView,
  ANTENNA_CONTROL_ROWS,
  type AntennaControlRow,
} from './AntennaControlView';
import { AlignmentMeterView } from './AlignmentMeterView';
import { WaveguideStatusView } from './WaveguideStatusView';
import { BearingDisplayView } from './BearingDisplayView';
import { SourceAnalysisView } from './SourceAnalysisView';

const EMPTY_RECEIVER_METRICS: ReceiverMetrics = {
  channelMatch: false,
  frequencyErrorMHz: 0,
  frequencyQuality: 0,
  gainQuality: 0,
  filterQuality: 0,
  phaseErrorDeg: 0,
  phaseQuality: 0,
  effectiveSignalStrength: 0,
  amplifiedNoise: 0,
  signalToNoiseQuality: 0,
  overallQuality: 0,
  limitingFactor: 'none',
};

export class AntennaPanelView implements Disposable {
  private readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly readinessEl: HTMLElement;
  private readonly controlView: AntennaControlView;
  private readonly alignmentMeter: AlignmentMeterView;
  private readonly waveguideStatus: WaveguideStatusView;
  private readonly bearingDisplay: BearingDisplayView;
  private readonly sourceAnalysisView: SourceAnalysisView;

  private isOpenFlag = false;
  private onCloseCallback: (() => void) | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private rafHandle: number | null = null;
  private selectedRow: AntennaControlRow = 'array';

  constructor(
    parent: HTMLElement,
    private readonly antenna: AntennaController,
    private readonly waveguide: WaveguideController,
    private readonly sourceAnalysis: SourceAnalysisController,
    private readonly getArrayDefinition: (id: AntennaArrayId) => AntennaArrayDefinition | undefined,
    private readonly getReceiverMetrics: () => ReceiverMetrics | null,
    private readonly isRooftopPowered: () => boolean,
    private readonly isTransmissionDecoded: () => boolean,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'antenna-panel-viewer';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', 'Antenna Controls');
    this.root.hidden = true;

    this.panel = document.createElement('div');
    this.panel.className = 'antenna-panel';

    const header = document.createElement('div');
    header.className = 'antenna-panel-header';
    const title = document.createElement('h2');
    title.className = 'antenna-panel-title';
    title.textContent = 'ANTENNA CONTROL CABINET';
    this.closeButton = document.createElement('button');
    this.closeButton.type = 'button';
    this.closeButton.className = 'antenna-panel-close';
    this.closeButton.textContent = 'CLOSE [ESC]';
    this.closeButton.addEventListener('click', () => this.onCloseCallback?.());
    header.append(title, this.closeButton);

    this.readinessEl = document.createElement('div');
    this.readinessEl.className = 'antenna-readiness-row';
    this.readinessEl.setAttribute('role', 'status');
    this.readinessEl.setAttribute('aria-live', 'polite');

    const body = document.createElement('div');
    body.className = 'antenna-panel-body';
    const controlsColumn = document.createElement('div');
    controlsColumn.className = 'antenna-panel-controls-column';
    this.controlView = new AntennaControlView(controlsColumn, this.getArrayDefinition);
    this.alignmentMeter = new AlignmentMeterView(controlsColumn);
    this.waveguideStatus = new WaveguideStatusView(controlsColumn);

    const analysisColumn = document.createElement('div');
    analysisColumn.className = 'antenna-panel-analysis-column';
    this.bearingDisplay = new BearingDisplayView(analysisColumn);
    this.sourceAnalysisView = new SourceAnalysisView(analysisColumn, () => this.runComparison());

    body.append(controlsColumn, analysisColumn);

    const hints = document.createElement('div');
    hints.className = 'antenna-panel-hints';
    hints.textContent =
      'W/S SELECT · A/D ADJUST (SHIFT = FINE) · ENTER SAMPLE/COMPARE · R PARK · SPACE E-STOP · ESC CLOSE';

    this.panel.append(header, this.readinessEl, body, hints);
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
    this.selectedRow = 'array';
    this.root.hidden = false;
    this.closeButton.focus();

    this.keydownHandler = (e: KeyboardEvent) => this.handleKeydown(e);
    document.addEventListener('keydown', this.keydownHandler);

    this.scheduleFrame();
  }

  close(returnFocusTo: HTMLElement): void {
    if (!this.isOpenFlag) return;
    this.isOpenFlag = false;
    this.root.hidden = true;
    if (this.keydownHandler !== null) {
      document.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    // Mirrors ReceiverPanelView: close() never invokes onCloseCallback —
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
    this.controlView.dispose();
    this.alignmentMeter.dispose();
    this.waveguideStatus.dispose();
    this.bearingDisplay.dispose();
    this.sourceAnalysisView.dispose();
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
    const snapshot = this.antenna.getSnapshot();
    const selectedId = snapshot.selectedArrayId;
    const entry = snapshot.arrays.find((a) => a.id === selectedId);
    const def = selectedId !== null ? this.getArrayDefinition(selectedId) : undefined;
    const receiverMetrics = this.getReceiverMetrics() ?? EMPTY_RECEIVER_METRICS;
    const waveguideSnapshot =
      def !== undefined ? this.waveguide.getSnapshot(def.waveguidePathId) : undefined;

    this.controlView.render(snapshot, this.selectedRow, selectedId);
    this.alignmentMeter.render(entry?.metrics ?? null);
    this.waveguideStatus.render(waveguideSnapshot);

    const liveBearing =
      def !== undefined && entry !== undefined && entry.metrics !== null
        ? evaluateBearing(
            def.id,
            def.role,
            entry.metrics.alignmentQuality,
            entry.mechanical.currentAzimuthDeg,
            entry.mechanical.currentElevationDeg,
          )
        : null;
    this.bearingDisplay.render(liveBearing);
    this.sourceAnalysisView.render(this.sourceAnalysis.getSnapshot());

    const ceiling = evaluateAnalysisQualityCeiling({
      receiverMetrics,
      antennaMetrics: entry?.metrics ?? {
        arrayMatch: false,
        azimuthErrorDeg: 0,
        azimuthQuality: 0,
        elevationErrorDeg: 0,
        elevationQuality: 0,
        polarizationErrorDeg: 0,
        polarizationQuality: 0,
        mechanicalReadiness: 0,
        waveguideContinuity: 0,
        powerAvailability: 0,
        alignmentQuality: 0,
        overallQuality: 0,
        limitingFactor: 'none',
      },
      waveguideQuality: waveguideSnapshot?.continuity ?? 0,
      rooftopPowered: this.isRooftopPowered(),
      transmissionDecoded: this.isTransmissionDecoded(),
    });
    this.readinessEl.textContent = `RECEIVER QUALITY ${Math.round(receiverMetrics.overallQuality * 100)}% · ANALYSIS READINESS ${Math.round(ceiling * 100)}%`;
  }

  private adjust(row: AntennaControlRow, direction: 1 | -1, fine: boolean): void {
    const id = this.antenna.selectedArray;
    if (row === 'array') {
      this.cycleArraySelection(direction);
      return;
    }
    if (id === null) return;
    const def = this.getArrayDefinition(id);
    if (def === undefined) return;
    switch (row) {
      case 'azimuth':
        this.antenna.adjustAzimuth(
          direction * (fine ? def.azimuthStepFineDeg : def.azimuthStepCoarseDeg),
        );
        break;
      case 'elevation':
        this.antenna.adjustElevation(
          direction * (fine ? def.elevationStepFineDeg : def.elevationStepCoarseDeg),
        );
        break;
      case 'polarization':
        this.antenna.adjustPolarization(
          direction * (fine ? def.polarizationStepFineDeg : def.polarizationStepCoarseDeg),
        );
        break;
    }
  }

  private cycleArraySelection(direction: 1 | -1): void {
    const ids = this.antenna.listArrayIds();
    if (ids.length === 0) return;
    const current = this.antenna.selectedArray;
    const currentIndex = current !== null ? ids.indexOf(current) : -1;
    const nextIndex = (currentIndex + direction + ids.length) % ids.length;
    const nextId = ids[nextIndex];
    if (nextId !== undefined) this.antenna.selectArray(nextId);
  }

  /**
   * Enter is contextual (spec's fixed minimal key set has no separate
   * compare key): collects a sample for the selected array first; once all
   * required samples exist, the SAME key runs the comparison.
   */
  private activate(): void {
    const snap = this.sourceAnalysis.getSnapshot();
    if (snap.state === 'Collecting' && snap.samples.length >= snap.requiredArrayIds.length) {
      this.runComparison();
      return;
    }
    this.collectSample();
  }

  private collectSample(): void {
    const id = this.antenna.selectedArray;
    if (id === null) return;
    const def = this.getArrayDefinition(id);
    if (def === undefined) return;
    const mech = this.antenna.getMechanicalState(id);
    const metrics = this.antenna.getMetrics(id);
    if (mech === undefined || metrics === null) return;
    const waveguideSnapshot = this.waveguide.getSnapshot(def.waveguidePathId);
    this.sourceAnalysis.collectSample({
      arrayId: id,
      role: def.role,
      azimuthDeg: mech.currentAzimuthDeg,
      elevationDeg: mech.currentElevationDeg,
      polarizationDeg: mech.currentPolarizationDeg,
      alignmentQuality: metrics.alignmentQuality,
      receiverQuality: (this.getReceiverMetrics() ?? EMPTY_RECEIVER_METRICS).overallQuality,
      waveguideState: waveguideSnapshot?.state ?? 'Disconnected',
      powered: this.antenna.isPowered,
    });
  }

  private runComparison(): void {
    this.sourceAnalysis.runComparison();
  }

  private handleKeydown(e: KeyboardEvent): void {
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
        e.preventDefault();
        this.activate();
        return;
      case 'KeyR':
        e.preventDefault();
        this.antenna.park();
        return;
      case 'Space':
        e.preventDefault();
        this.antenna.emergencyStop();
        return;
      default:
        return;
    }
  }

  private moveSelection(delta: 1 | -1): void {
    const index = ANTENNA_CONTROL_ROWS.indexOf(this.selectedRow);
    const nextIndex = (index + delta + ANTENNA_CONTROL_ROWS.length) % ANTENNA_CONTROL_ROWS.length;
    this.selectedRow = ANTENNA_CONTROL_ROWS[nextIndex] ?? 'array';
  }
}
