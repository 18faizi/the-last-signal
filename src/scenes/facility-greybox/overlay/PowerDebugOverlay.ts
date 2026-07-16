/**
 * Development-only F10 power-network debug overlay.
 *
 * Mirrors FacilityDebugOverlay's (F9) pattern: a DOM text panel refreshed at
 * a reduced rate, listing source availability/capacity, every circuit's
 * requested/effective state and cost, and load powered flags. Also places a
 * small set of non-pickable, non-colliding marker spheres at each power
 * indicator's world position, colour-coded green/red for powered/unpowered,
 * visible only while the overlay is shown. Hidden by default; entirely
 * absent in production (never constructed outside development).
 */
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { Disposable } from '../../../app/lifecycle/Disposable';
import type { PowerNetwork } from '../../../game/power/PowerNetwork';
import type { PowerCircuitId } from '../../../game/power/PowerCircuitId';
import type { GeneratorController } from '../../../game/generator/GeneratorController';
import { formatGeneratorDebugFields } from '../../../game/generator/GeneratorDebugView';

export interface PowerDebugMarkerSpec {
  readonly id: string;
  readonly position: Vector3;
  readonly circuitId: PowerCircuitId;
}

export class PowerDebugOverlay implements Disposable {
  private readonly root: HTMLElement;
  private readonly content: HTMLElement;
  private readonly markers: Array<{
    mesh: Mesh;
    mat: StandardMaterial;
    circuitId: PowerCircuitId;
  }> = [];
  private visible = false;
  private frameCounter = 0;
  private readonly UPDATE_INTERVAL = 30;

  constructor(
    parent: HTMLElement,
    scene: Scene,
    private readonly network: PowerNetwork,
    private readonly generator: GeneratorController,
    markerSpecs: readonly PowerDebugMarkerSpec[],
  ) {
    this.root = document.createElement('div');
    this.root.id = 'power-debug-overlay';
    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-label', 'Power network debug info');
    this.root.hidden = true;
    Object.assign(this.root.style, {
      position: 'fixed',
      top: '60px',
      right: '16px',
      width: '320px',
      maxHeight: 'calc(100vh - 80px)',
      overflowY: 'auto',
      background: 'rgba(10, 14, 20, 0.92)',
      border: '1px solid #3a4a5a',
      borderRadius: '4px',
      padding: '10px',
      zIndex: '8950',
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#aad0ee',
      boxSizing: 'border-box',
    });

    const header = document.createElement('div');
    header.textContent = 'POWER DEBUG — F10 to close';
    Object.assign(header.style, {
      color: '#bcd8ff',
      marginBottom: '8px',
      borderBottom: '1px solid #3a4a5a',
      paddingBottom: '6px',
    });
    this.root.append(header);

    this.content = document.createElement('pre');
    Object.assign(this.content.style, {
      margin: '0',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      fontSize: '10px',
      color: '#aad0ee',
    });
    this.root.append(this.content);
    parent.append(this.root);

    for (const spec of markerSpecs) {
      const mesh = CreateSphere(`power-debug-marker-${spec.id}`, { diameter: 0.5 }, scene);
      mesh.position.copyFrom(spec.position);
      mesh.position.y += 0.6;
      mesh.isPickable = false;
      mesh.checkCollisions = false;
      mesh.setEnabled(false);
      const mat = new StandardMaterial(`power-debug-marker-${spec.id}-mat`, scene);
      mat.emissiveColor = new Color3(0.6, 0.1, 0.1);
      mesh.material = mat;
      this.markers.push({ mesh, mat, circuitId: spec.circuitId });
    }
  }

  get isVisible(): boolean {
    return this.visible;
  }

  show(): void {
    this.visible = true;
    this.root.hidden = false;
    for (const m of this.markers) m.mesh.setEnabled(true);
    this.refresh();
  }

  hide(): void {
    this.visible = false;
    this.root.hidden = true;
    for (const m of this.markers) m.mesh.setEnabled(false);
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
    const snap = this.network.getSnapshot();
    const lines: string[] = [
      'GENERATOR',
      ...formatGeneratorDebugFields(this.generator.snapshot).map(([k, v]) => `  ${k}: ${v}`),
      '',
    ];

    lines.push('SOURCES:');
    for (const s of snap.sources) {
      lines.push(`  ${s.id} [${s.kind}] ${s.availability} ${s.allocatedCapacity}/${s.maxCapacity}`);
    }

    lines.push('');
    lines.push('CIRCUITS:');
    for (const c of snap.circuits) {
      lines.push(
        `  ${c.id} req=${c.requested} eff=${c.effective} src=${c.sourceId ?? '—'} cost=${c.capacityCost}`,
      );
    }

    lines.push('');
    lines.push(
      `LOADS (${snap.loads.filter((l) => l.powered).length}/${snap.loads.length} powered):`,
    );
    for (const l of snap.loads) {
      lines.push(`  ${l.id}: ${l.powered ? 'ON' : 'off'}`);
    }

    this.content.textContent = lines.join('\n');

    for (const marker of this.markers) {
      const energized = this.network.isCircuitEnergized(marker.circuitId);
      marker.mat.emissiveColor = energized ? new Color3(0.1, 0.7, 0.1) : new Color3(0.6, 0.1, 0.1);
    }
  }

  dispose(): void {
    for (const m of this.markers) {
      m.mesh.dispose();
      m.mat.dispose();
    }
    this.markers.length = 0;
    this.root.remove();
  }
}
