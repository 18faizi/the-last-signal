/**
 * Alignment quality meters — azimuth/elevation/polarization/overall — for
 * the currently-selected array. Mirrors DecodeProgressView.ts's
 * bar-plus-label construction pattern.
 */
import type { AntennaMetrics } from '../../game/antenna/AntennaMetrics';

type MeterKind = 'azimuth' | 'elevation' | 'polarization' | 'overall';
const METERS: readonly MeterKind[] = ['azimuth', 'elevation', 'polarization', 'overall'];
const METER_PREFIX: Readonly<Record<MeterKind, string>> = {
  azimuth: 'AZ',
  elevation: 'EL',
  polarization: 'POL',
  overall: 'ALIGNMENT',
};

interface MeterElements {
  readonly row: HTMLElement;
  readonly label: HTMLElement;
  readonly fill: HTMLElement;
}

export class AlignmentMeterView {
  private readonly root: HTMLElement;
  private readonly meters: Record<MeterKind, MeterElements>;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'antenna-alignment-meters';
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');

    this.meters = {
      azimuth: this.buildMeter('azimuth'),
      elevation: this.buildMeter('elevation'),
      polarization: this.buildMeter('polarization'),
      overall: this.buildMeter('overall'),
    };

    for (const kind of METERS) {
      this.root.append(this.meters[kind].row);
    }
    parent.append(this.root);
  }

  render(metrics: AntennaMetrics | null): void {
    if (metrics === null) {
      for (const kind of METERS) {
        this.meters[kind].label.textContent = `${METER_PREFIX[kind]} —`;
        this.meters[kind].fill.style.width = '0%';
      }
      return;
    }
    this.setMeter('azimuth', metrics.azimuthQuality);
    this.setMeter('elevation', metrics.elevationQuality);
    this.setMeter('polarization', metrics.polarizationQuality);
    this.setMeter('overall', metrics.overallQuality);
  }

  dispose(): void {
    this.root.remove();
  }

  private setMeter(kind: MeterKind, quality: number): void {
    const pct = Math.round(Math.min(1, Math.max(0, quality)) * 100);
    this.meters[kind].label.textContent = `${METER_PREFIX[kind]} ${pct}%`;
    this.meters[kind].fill.style.width = `${pct}%`;
  }

  private buildMeter(kind: MeterKind): MeterElements {
    const row = document.createElement('div');
    row.className = 'antenna-meter-row';
    const label = document.createElement('span');
    label.className = 'antenna-meter-label';
    label.textContent = `${METER_PREFIX[kind]} —`;
    const barOuter = document.createElement('div');
    barOuter.className = 'antenna-meter-bar';
    const fill = document.createElement('div');
    fill.className = 'antenna-meter-fill';
    barOuter.append(fill);
    row.append(label, barOuter);
    return { row, label, fill };
  }
}
