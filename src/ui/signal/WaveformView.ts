/**
 * Canvas-based waveform visualization: noisy when unlocked, coherent
 * structure emerging as overallQuality rises, stable once Locked, perfectly
 * clean once Decoded.
 *
 * Deterministic math only: a fixed-shape carrier sine (visual only — this
 * is NOT literally the RF waveform) blended with a bounded pseudo-noise
 * term whose amplitude shrinks as quality rises. The noise term is purely
 * cosmetic animation and is never read back into SignalEvaluator — quality
 * itself is computed once upstream by ReceiverController/SignalEvaluator
 * and simply passed in here for rendering.
 *
 * Bounded sample count (192 points); draws only when `draw()` is called by
 * the owning ReceiverPanelView's single rAF loop.
 */
import type { ReceiverControllerSnapshot } from '../../game/receiver/ReceiverController';

const SAMPLE_COUNT = 192;

function pseudoNoise(x: number, t: number): number {
  const a = Math.sin(x * 78.233 + t * 2.3) * 43758.5453;
  return (a - Math.floor(a)) * 2 - 1; // [-1, 1)
}

export class WaveformView {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'signal-waveform-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    const ctx = this.canvas.getContext('2d');
    if (ctx === null) throw new Error('WaveformView: 2D canvas context unavailable');
    this.ctx = ctx;
    parent.append(this.canvas);
  }

  get element(): HTMLCanvasElement {
    return this.canvas;
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  draw(snapshot: ReceiverControllerSnapshot, elapsedSeconds: number): void {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#050a10';
    ctx.fillRect(0, 0, w, h);

    const decoded = snapshot.mode === 'Decoded';
    const locked = snapshot.mode === 'Locked' || snapshot.mode === 'Decoding' || decoded;
    const quality = decoded ? 1 : (snapshot.metrics?.overallQuality ?? 0);
    // Noise shrinks as quality rises; fully clean once decoded.
    const noiseAmplitude = decoded ? 0 : Math.max(0, 0.9 - quality * 0.9);
    const signalAmplitude = decoded ? 0.8 : 0.2 + quality * 0.6;
    const phaseRad = (snapshot.controls.phaseDeg * Math.PI) / 180;
    const cyclesAcrossCanvas = 6;

    ctx.beginPath();
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const t = i / (SAMPLE_COUNT - 1);
      const carrier = Math.sin(t * Math.PI * 2 * cyclesAcrossCanvas + phaseRad) * signalAmplitude;
      const noise = pseudoNoise(t, elapsedSeconds) * noiseAmplitude * 0.5;
      const y = h / 2 - (carrier + noise) * (h / 2.4);
      const x = t * w;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = decoded ? '#bfffcf' : locked ? '#7fe3c0' : '#4a6a76';
    ctx.lineWidth = Math.max(1, w / 350);
    ctx.stroke();

    // Center line for reference.
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  }

  dispose(): void {
    this.canvas.remove();
  }
}
