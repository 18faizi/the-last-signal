/**
 * Development-only F9 facility debug overlay for the facility greybox scene.
 *
 * Displays the current progression phase, discovered zones, activated
 * checkpoints, open doors and collected pickups.  Polled from the scene's
 * onBeforeRenderObservable at a reduced rate (every 30 frames) to avoid
 * per-frame DOM writes.
 *
 * No Babylon objects cross this boundary.
 */
import type { Disposable } from '../../../app/lifecycle/Disposable';
import type { FacilityRuntimeState } from '../../../game/facility/FacilityRuntimeState';
import type { ZoneRegistry } from '../../../game/facility/ZoneRegistry';
import type { CheckpointRegistry } from '../../../game/facility/Checkpoint';

export class FacilityDebugOverlay implements Disposable {
  private readonly root: HTMLElement;
  private readonly content: HTMLElement;
  private visible = false;
  private frameCounter = 0;
  private readonly UPDATE_INTERVAL = 30;

  constructor(
    parent: HTMLElement,
    private readonly facilityState: FacilityRuntimeState,
    private readonly zoneRegistry: ZoneRegistry,
    private readonly checkpointRegistry: CheckpointRegistry,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'facility-debug-overlay';
    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-label', 'Facility debug info');
    this.root.hidden = true;
    Object.assign(this.root.style, {
      position: 'fixed',
      top: '60px',
      left: '16px',
      width: '280px',
      maxHeight: 'calc(100vh - 80px)',
      overflowY: 'auto',
      background: 'rgba(10, 10, 20, 0.90)',
      border: '1px solid #3a3a5a',
      borderRadius: '4px',
      padding: '10px',
      zIndex: '8900',
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#aaaacc',
      boxSizing: 'border-box',
    });

    const header = document.createElement('div');
    header.textContent = 'FACILITY DEBUG — F9 to close';
    Object.assign(header.style, {
      color: '#aaaaff',
      marginBottom: '8px',
      borderBottom: '1px solid #3a3a5a',
      paddingBottom: '6px',
    });
    this.root.append(header);

    this.content = document.createElement('pre');
    Object.assign(this.content.style, {
      margin: '0',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      fontSize: '10px',
      color: '#aaaacc',
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
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
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
    const snap = this.facilityState.getSnapshot();
    const activeZones = this.zoneRegistry.activeZoneIds;
    const latestCp = this.checkpointRegistry.latestCheckpoint;

    const lines: string[] = [
      `Phase: ${snap.progressionPhase}${snap.isComplete ? ' ✓ COMPLETE' : ''}`,
      '',
      `Zones (${this.zoneRegistry.discoveredCount}/${this.zoneRegistry.totalCount} discovered):`,
    ];

    for (const zoneId of snap.discoveredZoneIds) {
      const active = activeZones.includes(zoneId);
      lines.push(`  ${active ? '▶ ' : '  '}${zoneId}`);
    }

    lines.push('');
    lines.push(
      `Checkpoints (${this.checkpointRegistry.activatedCount}/${this.checkpointRegistry.totalCount}):`,
    );
    lines.push(`  Latest: ${latestCp?.label ?? 'none'}`);

    lines.push('');
    lines.push(`Doors opened (${snap.openedDoorIds.length}):`);
    for (const id of snap.openedDoorIds) {
      lines.push(`  ${id}`);
    }

    lines.push('');
    lines.push(`Pickups collected (${snap.collectedPickupIds.length}):`);
    for (const id of snap.collectedPickupIds) {
      lines.push(`  ${id}`);
    }

    this.content.textContent = lines.join('\n');
  }

  dispose(): void {
    this.root.remove();
  }
}
