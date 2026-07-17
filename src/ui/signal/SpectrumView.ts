/**
 * Canvas-based spectrum visualization: frequency axis, noise floor, a
 * carrier peak (only rendered when the tuned channel matches the active
 * signal's channel — an untuned channel shows plain noise), the tuning
 * cursor, and the current channel indicator.
 *
 * Bounded sample count (128 bins) regardless of canvas size; respects
 * devicePixelRatio without over-resolving; draws only when `draw()` is
 * called by the owning ReceiverPanelView's single rAF loop — this class
 * owns no timer/rAF of its own, so it can't leak one.
 *
 * All math is deterministic (bin index + a caller-supplied elapsed-time
 * value for cosmetic animation only) — never Math.random, and never fed
 * back into SignalEvaluator.
 */
import type { ReceiverControllerSnapshot } from '../../game/receiver/ReceiverController';
import type { SignalDefinition } from '../../game/signal/SignalDefinition';

const BIN_COUNT = 128;

/** Deterministic pseudo-noise in [0,1), seeded by bin + time — cosmetic only. */
function pseudoNoise(bin: number, t: number): number {
  const a = Math.sin(bin * 12.9898 + t * 1.7) * 43758.5453;
  return a - Math.floor(a);
}

export class SpectrumView {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'signal-spectrum-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    const ctx = this.canvas.getContext('2d');
    if (ctx === null) throw new Error('SpectrumView: 2D canvas context unavailable');
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

  draw(
    snapshot: ReceiverControllerSnapshot,
    activeSignal: SignalDefinition | undefined,
    minFrequencyMHz: number,
    maxFrequencyMHz: number,
    elapsedSeconds: number,
  ): void {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#050a10';
    ctx.fillRect(0, 0, w, h);

    const quality = snapshot.metrics?.overallQuality ?? 0;
    const tunedToSignal = activeSignal !== undefined;

    ctx.beginPath();
    for (let i = 0; i < BIN_COUNT; i++) {
      const t = i / (BIN_COUNT - 1);
      const freq = minFrequencyMHz + t * (maxFrequencyMHz - minFrequencyMHz);
      const noiseFloor = 0.06 + pseudoNoise(i, elapsedSeconds) * 0.05;

      let amplitude = noiseFloor;
      if (tunedToSignal) {
        const distance = Math.abs(freq - activeSignal.targetFrequencyMHz);
        const width = Math.max(activeSignal.frequencyToleranceMHz, 0.5);
        const peak = Math.exp(-(distance * distance) / (2 * width * width));
        amplitude += peak * (0.25 + quality * 0.65);
      }

      const x = t * w;
      const y = h - amplitude * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = tunedToSignal ? '#7fe3c0' : '#3c5a66';
    ctx.lineWidth = Math.max(1, w / 400);
    ctx.stroke();

    // Tuning cursor.
    const cursorT =
      (snapshot.controls.frequencyMHz - minFrequencyMHz) / (maxFrequencyMHz - minFrequencyMHz);
    ctx.strokeStyle = '#ffcf6b';
    ctx.lineWidth = Math.max(1, w / 300);
    ctx.beginPath();
    ctx.moveTo(cursorT * w, 0);
    ctx.lineTo(cursorT * w, h);
    ctx.stroke();

    // Channel indicator text.
    ctx.fillStyle = '#9fd6ff';
    ctx.font = `${Math.max(10, Math.round(h / 14))}px monospace`;
    ctx.fillText(`CH ${snapshot.controls.channel}`, 6, Math.max(12, h / 14));
  }

  dispose(): void {
    this.canvas.remove();
  }
}
