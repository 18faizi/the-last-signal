/**
 * Development-only F1 threat/stealth debug overlay (Milestone 0.9).
 *
 * Mirrors the F9/F10/F11/F2 overlay pattern: a DOM text panel refreshed at
 * a reduced rate PLUS lazily-created 3D markers (nav graph nodes +
 * adjacency, hiding spots, safe zones, threat LOS/facing lines, last-known
 * position). All 3D helpers are non-pickable, physics-free, created on
 * first show and disposed on hide — production builds never construct this
 * class, so the F1 key is completely inert there.
 */
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import type { Disposable } from '../../../app/lifecycle/Disposable';
import type { ThreatController } from '../../../game/threat/ThreatController';
import type { ThreatNavGraph } from '../../../game/threat/behavior/ThreatSearchPattern';
import { getNode } from '../../../game/threat/behavior/ThreatSearchPattern';
import type { SoundStimulusRegistry } from '../../../game/threat/perception/SoundStimulusRegistry';
import type { HidingSpotRegistry } from '../../../game/threat/stealth/HidingSpotRegistry';
import type { SafeZoneRegistry } from '../../../game/threat/stealth/SafeZoneRegistry';
import type { ThreatBindingsHandle } from '../threat/buildThreatEventBindings';

export class ThreatDebugOverlay implements Disposable {
  private readonly root: HTMLElement;
  private readonly content: HTMLElement;
  private visible = false;
  private frameCounter = 0;
  private readonly UPDATE_INTERVAL = 15;

  private markers: Mesh[] = [];
  private lines: LinesMesh[] = [];
  private losLine: LinesMesh | null = null;
  private lastKnownMarker: Mesh | null = null;
  private markerMaterial: StandardMaterial | null = null;

  constructor(
    parent: HTMLElement,
    private readonly scene: Scene,
    private readonly threat: ThreatController,
    private readonly graph: ThreatNavGraph,
    private readonly hidingSpots: HidingSpotRegistry,
    private readonly safeZones: SafeZoneRegistry,
    private readonly stimuli: SoundStimulusRegistry,
    private readonly bindings: ThreatBindingsHandle,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'threat-debug-overlay';
    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-label', 'Threat and stealth debug info');
    this.root.hidden = true;
    Object.assign(this.root.style, {
      position: 'fixed',
      bottom: '16px',
      left: '16px',
      width: '340px',
      maxHeight: 'calc(100vh - 80px)',
      overflowY: 'auto',
      background: 'rgba(14, 10, 10, 0.92)',
      border: '1px solid #5a3a3a',
      borderRadius: '4px',
      padding: '10px',
      zIndex: '8960',
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#f0c0b0',
      boxSizing: 'border-box',
    });

    const header = document.createElement('div');
    header.textContent = 'THREAT DEBUG — F1 to close';
    Object.assign(header.style, {
      color: '#ffd8c8',
      marginBottom: '8px',
      borderBottom: '1px solid #5a3a3a',
      paddingBottom: '6px',
    });
    this.root.append(header);

    this.content = document.createElement('pre');
    Object.assign(this.content.style, {
      margin: '0',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      fontSize: '10px',
      color: '#f0c0b0',
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
    this.buildMarkers();
    this.refresh();
  }

  hide(): void {
    this.visible = false;
    this.root.hidden = true;
    this.disposeMarkers();
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  /** Call from the scene's per-frame observer (rate-limited internally). */
  tick(): void {
    if (!this.visible) return;
    this.frameCounter++;
    if (this.frameCounter >= this.UPDATE_INTERVAL) {
      this.frameCounter = 0;
      this.refresh();
    }
  }

  dispose(): void {
    this.disposeMarkers();
    this.root.remove();
  }

  // ----- private -----------------------------------------------------------

  private buildMarkers(): void {
    if (this.markerMaterial !== null) return;
    const material = new StandardMaterial('threat-debug-mat', this.scene);
    material.emissiveColor = new Color3(0.9, 0.45, 0.3);
    material.disableLighting = true;
    material.alpha = 0.55;
    this.markerMaterial = material;

    // Nav graph nodes + adjacency lines.
    for (const node of this.graph.nodes) {
      const sphere = CreateSphere(
        `threat-debug-node-${node.id}`,
        { diameter: 0.3, segments: 6 },
        this.scene,
      );
      sphere.position.set(node.position.x, node.position.y + 0.3, node.position.z);
      sphere.material = material;
      sphere.isPickable = false;
      this.markers.push(sphere);
      for (const adj of node.adjacency) {
        if (adj < node.id) continue; // one line per pair
        const other = getNode(this.graph, adj);
        if (other === undefined) continue;
        const line = CreateLines(
          `threat-debug-edge-${node.id}-${adj}`,
          {
            points: [
              new Vector3(node.position.x, node.position.y + 0.3, node.position.z),
              new Vector3(other.position.x, other.position.y + 0.3, other.position.z),
            ],
          },
          this.scene,
        );
        line.color = new Color3(0.9, 0.5, 0.3);
        line.isPickable = false;
        this.lines.push(line);
      }
    }

    // Hiding spots (green boxes at camera positions).
    for (const spot of this.hidingSpots.getAll()) {
      const box = CreateBox(`threat-debug-hide-${spot.id}`, { size: 0.35 }, this.scene);
      box.position.set(spot.cameraPosition.x, spot.cameraPosition.y, spot.cameraPosition.z);
      const mat = new StandardMaterial(`threat-debug-hide-mat-${spot.id}`, this.scene);
      mat.emissiveColor = new Color3(0.3, 0.85, 0.4);
      mat.disableLighting = true;
      mat.alpha = 0.6;
      box.material = mat;
      box.isPickable = false;
      this.markers.push(box);
    }

    // Safe zones (translucent blue volumes).
    for (const zone of this.safeZones.getAll()) {
      const a = zone.aabb;
      const box = CreateBox(
        `threat-debug-safe-${zone.id}`,
        { width: a.maxX - a.minX, height: a.maxY - a.minY, depth: a.maxZ - a.minZ },
        this.scene,
      );
      box.position.set((a.minX + a.maxX) / 2, (a.minY + a.maxY) / 2, (a.minZ + a.maxZ) / 2);
      const mat = new StandardMaterial(`threat-debug-safe-mat-${zone.id}`, this.scene);
      mat.emissiveColor = new Color3(0.25, 0.5, 0.9);
      mat.disableLighting = true;
      mat.alpha = 0.12;
      box.material = mat;
      box.isPickable = false;
      this.markers.push(box);
    }

    // Last-known-position marker (repositioned on refresh).
    const lastKnown = CreateSphere(
      'threat-debug-lastknown',
      { diameter: 0.4, segments: 6 },
      this.scene,
    );
    const lkMat = new StandardMaterial('threat-debug-lastknown-mat', this.scene);
    lkMat.emissiveColor = new Color3(0.95, 0.9, 0.2);
    lkMat.disableLighting = true;
    lastKnown.material = lkMat;
    lastKnown.isPickable = false;
    lastKnown.setEnabled(false);
    this.lastKnownMarker = lastKnown;
    this.markers.push(lastKnown);
  }

  private disposeMarkers(): void {
    for (const mesh of this.markers) mesh.dispose(false, true);
    for (const line of this.lines) line.dispose(false, true);
    this.losLine?.dispose(false, true);
    this.markers = [];
    this.lines = [];
    this.losLine = null;
    this.lastKnownMarker = null;
    this.markerMaterial?.dispose();
    this.markerMaterial = null;
  }

  private refresh(): void {
    const snap = this.threat.getSnapshot();
    const fields = this.bindings.getDebugFields();
    const stimulusLines = this.stimuli
      .getActive()
      .map((s) => `  ${s.category} i=${s.intensity.toFixed(2)} r=${s.radius}`)
      .join('\n');
    const messages = this.bindings.getDevMessages().slice(-5).join('\n  ');
    this.content.textContent =
      fields.map(([k, v]) => `${k}: ${v}`).join('\n') +
      `\nSearch queue: ${snap.remainingSearchNodes.join(',') || '—'}` +
      `\nVision score: ${snap.visionScore.toFixed(2)}` +
      `\nStimuli (${this.stimuli.activeCount}):\n${stimulusLines || '  none'}` +
      `\nDirector log:\n  ${messages || '—'}`;

    // Live 3D updates: LOS line + last-known marker.
    if (this.lastKnownMarker !== null) {
      if (snap.lastKnownPlayerPosition !== null) {
        this.lastKnownMarker.setEnabled(true);
        this.lastKnownMarker.position.set(
          snap.lastKnownPlayerPosition.x,
          snap.lastKnownPlayerPosition.y + 1,
          snap.lastKnownPlayerPosition.z,
        );
      } else {
        this.lastKnownMarker.setEnabled(false);
      }
    }
    this.losLine?.dispose(false, true);
    this.losLine = null;
    if (snap.active) {
      const origin = new Vector3(snap.position.x, snap.position.y + 1.6, snap.position.z);
      const facing = new Vector3(
        origin.x + Math.sin(snap.facingYaw) * 3,
        origin.y,
        origin.z + Math.cos(snap.facingYaw) * 3,
      );
      this.losLine = CreateLines('threat-debug-los', { points: [origin, facing] }, this.scene);
      this.losLine.color = snap.hasLineOfSight
        ? new Color3(1, 0.3, 0.3)
        : new Color3(0.5, 0.5, 0.55);
      this.losLine.isPickable = false;
    }
  }
}
