/**
 * Array-selection row + azimuth/elevation/polarization control rows.
 * Mirrors src/ui/signal/ReceiverControlView.ts's row-based construction and
 * render(snapshot, selectedRow) contract exactly.
 */
import type { AntennaArrayDefinition } from '../../game/antenna/AntennaArrayDefinition';
import type { AntennaArrayId } from '../../game/antenna/AntennaArrayId';
import type { AntennaControllerSnapshot } from '../../game/antenna/AntennaSnapshot';

export type AntennaControlRow = 'array' | 'azimuth' | 'elevation' | 'polarization';

export const ANTENNA_CONTROL_ROWS: readonly AntennaControlRow[] = [
  'array',
  'azimuth',
  'elevation',
  'polarization',
];

interface RowElements {
  readonly root: HTMLElement;
  readonly label: HTMLElement;
  readonly value: HTMLElement;
}

export class AntennaControlView {
  private readonly root: HTMLElement;
  private readonly rows: Record<AntennaControlRow, RowElements>;

  constructor(
    parent: HTMLElement,
    private readonly getArrayDefinition: (id: AntennaArrayId) => AntennaArrayDefinition | undefined,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'antenna-control-rows';

    this.rows = {
      array: this.buildRow('array', 'ARRAY'),
      azimuth: this.buildRow('azimuth', 'AZIMUTH'),
      elevation: this.buildRow('elevation', 'ELEVATION'),
      polarization: this.buildRow('polarization', 'POLARIZATION'),
    };

    for (const row of ANTENNA_CONTROL_ROWS) {
      this.root.append(this.rows[row].root);
    }
    parent.append(this.root);
  }

  render(
    snapshot: AntennaControllerSnapshot,
    selectedRow: AntennaControlRow,
    selectedArrayId: AntennaArrayId | null,
  ): void {
    for (const row of ANTENNA_CONTROL_ROWS) {
      this.rows[row].root.classList.toggle('selected', row === selectedRow);
    }

    const def = selectedArrayId !== null ? this.getArrayDefinition(selectedArrayId) : undefined;
    const entry = snapshot.arrays.find((a) => a.id === selectedArrayId);

    this.rows.array.value.textContent =
      def !== undefined
        ? `${def.displayName.toUpperCase()} (${entry?.controlState ?? 'Offline'})`
        : 'NONE SELECTED';

    if (def === undefined || entry === undefined) {
      this.rows.azimuth.value.textContent = '—';
      this.rows.elevation.value.textContent = '—';
      this.rows.polarization.value.textContent = '—';
      return;
    }

    const mech = entry.mechanical;
    this.rows.azimuth.value.textContent = `${mech.currentAzimuthDeg.toFixed(1)}° ${
      mech.targetAzimuthDeg !== null ? `→ ${mech.targetAzimuthDeg.toFixed(1)}°` : ''
    } (target ${def.targetAzimuthDeg.toFixed(1)}°)`;
    this.rows.elevation.value.textContent = `${mech.currentElevationDeg.toFixed(1)}° ${
      mech.targetElevationDeg !== null ? `→ ${mech.targetElevationDeg.toFixed(1)}°` : ''
    } (target ${def.targetElevationDeg.toFixed(1)}°)`;
    this.rows.polarization.value.textContent = `${mech.currentPolarizationDeg.toFixed(1)}° ${
      mech.targetPolarizationDeg !== null ? `→ ${mech.targetPolarizationDeg.toFixed(1)}°` : ''
    } (target ${def.targetPolarizationDeg.toFixed(1)}°)`;
  }

  dispose(): void {
    this.root.remove();
  }

  private buildRow(kind: AntennaControlRow, labelText: string): RowElements {
    const root = document.createElement('div');
    root.className = 'antenna-control-row';
    root.dataset['row'] = kind;
    const label = document.createElement('span');
    label.className = 'antenna-control-label';
    label.textContent = labelText;
    const value = document.createElement('span');
    value.className = 'antenna-control-value';
    root.append(label, value);
    return { root, label, value };
  }
}
