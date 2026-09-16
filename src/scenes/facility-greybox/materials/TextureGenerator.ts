/**
 * Procedural Texture Generator for The Last Signal.
 *
 * Generates seamless, high-performance in-memory procedural textures and normal/bump maps
 * for concrete, corrugated metal, diamond-plate steel, asphalt/snow, hazard stripes,
 * and industrial painted surfaces without external asset overhead.
 */
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import '@babylonjs/core/Engines/Extensions/engine.dynamicTexture';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.dynamicTexture';
import type { Scene } from '@babylonjs/core/scene';

export class TextureGenerator {
  private static readonly textureCache = new Map<string, DynamicTexture>();

  /**
   * Generates a concrete texture with subtle gravel aggregate, formwork lines, and surface grime.
   */
  static createConcreteTexture(scene: Scene, size = 512): DynamicTexture {
    const key = `concrete-${size}`;
    const cached = this.textureCache.get(key);
    if (cached) return cached;

    const dt = new DynamicTexture(key, { width: size, height: size }, scene, true);
    const ctx = dt.getContext() as CanvasRenderingContext2D;

    // Base concrete gray
    ctx.fillStyle = '#4f555c';
    ctx.fillRect(0, 0, size, size);

    // Fine grain noise
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 26;
      data[i] = Math.min(255, Math.max(0, (data[i] ?? 0) + noise));
      data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] ?? 0) + noise));
      data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] ?? 0) + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    // Formwork seams and aggregate pitting
    ctx.strokeStyle = 'rgba(35, 38, 42, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.stroke();

    // Subtle water staining streaks
    ctx.fillStyle = 'rgba(25, 30, 36, 0.12)';
    for (let x = 32; x < size; x += 64) {
      ctx.fillRect(x + (Math.random() * 8 - 4), 0, 12, size);
    }

    dt.update();
    this.textureCache.set(key, dt);
    return dt;
  }

  /**
   * Generates an industrial diamond-plate steel tread texture.
   */
  static createDiamondPlateTexture(scene: Scene, size = 256): DynamicTexture {
    const key = `diamond-plate-${size}`;
    const cached = this.textureCache.get(key);
    if (cached) return cached;

    const dt = new DynamicTexture(key, { width: size, height: size }, scene, true);
    const ctx = dt.getContext() as CanvasRenderingContext2D;

    // Base metallic steel
    ctx.fillStyle = '#454a52';
    ctx.fillRect(0, 0, size, size);

    // Draw diamond treads
    ctx.fillStyle = '#727a85';
    ctx.strokeStyle = '#2b2f36';
    ctx.lineWidth = 1.5;

    const step = 32;
    for (let y = 0; y < size; y += step) {
      for (let x = 0; x < size; x += step) {
        ctx.save();
        ctx.translate(x + step / 2, y + step / 2);
        ctx.rotate((45 * Math.PI) / 180);

        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();

        // Offset alternate tread
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((-45 * Math.PI) / 180);

        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }
    }

    dt.update();
    this.textureCache.set(key, dt);
    return dt;
  }

  /**
   * Generates corrugated metal texture with vertical ribs and oxidized highlights.
   */
  static createCorrugatedMetalTexture(scene: Scene, size = 512): DynamicTexture {
    const key = `corrugated-${size}`;
    const cached = this.textureCache.get(key);
    if (cached) return cached;

    const dt = new DynamicTexture(key, { width: size, height: size }, scene, true);
    const ctx = dt.getContext() as CanvasRenderingContext2D;

    // Vertical ribbed wave gradients
    const ribWidth = 16;
    for (let x = 0; x < size; x += ribWidth) {
      const grad = ctx.createLinearGradient(x, 0, x + ribWidth, 0);
      grad.addColorStop(0, '#383d45');
      grad.addColorStop(0.35, '#6a7280');
      grad.addColorStop(0.65, '#525a66');
      grad.addColorStop(1, '#2c3038');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, ribWidth, size);
    }

    // Horizontal rivet rows
    ctx.fillStyle = '#1c2026';
    for (let y = 32; y < size; y += 128) {
      for (let x = ribWidth / 2; x < size; x += ribWidth) {
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    dt.update();
    this.textureCache.set(key, dt);
    return dt;
  }

  /**
   * Generates an asphalt courtyard ground texture with packed Arctic snow patches.
   */
  static createCourtyardGroundTexture(scene: Scene, size = 512): DynamicTexture {
    const key = `courtyard-ground-${size}`;
    const cached = this.textureCache.get(key);
    if (cached) return cached;

    const dt = new DynamicTexture(key, { width: size, height: size }, scene, true);
    const ctx = dt.getContext() as CanvasRenderingContext2D;

    // Dark asphalt base
    ctx.fillStyle = '#2b2e34';
    ctx.fillRect(0, 0, size, size);

    // Gravel grit noise
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 32;
      data[i] = Math.min(255, Math.max(0, (data[i] ?? 0) + n));
      data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] ?? 0) + n));
      data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] ?? 0) + n));
    }
    ctx.putImageData(imgData, 0, 0);

    // Snow patches / frosted edges
    ctx.fillStyle = 'rgba(215, 228, 242, 0.45)';
    for (let s = 0; s < 12; s++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      const radius = 24 + Math.random() * 40;
      const grad = ctx.createRadialGradient(px, py, radius * 0.2, px, py, radius);
      grad.addColorStop(0, 'rgba(225, 238, 252, 0.7)');
      grad.addColorStop(0.7, 'rgba(180, 200, 220, 0.35)');
      grad.addColorStop(1, 'rgba(180, 200, 220, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    dt.update();
    this.textureCache.set(key, dt);
    return dt;
  }

  /**
   * Generates yellow and black angled 45-degree hazard chevron stripes.
   */
  static createHazardStripeTexture(scene: Scene, size = 256): DynamicTexture {
    const key = `hazard-stripe-${size}`;
    const cached = this.textureCache.get(key);
    if (cached) return cached;

    const dt = new DynamicTexture(key, { width: size, height: size }, scene, true);
    const ctx = dt.getContext() as CanvasRenderingContext2D;

    ctx.fillStyle = '#e6af19'; // Industrial safety yellow
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = '#1e2124'; // Matte black stripe
    const stripeW = 28;
    for (let x = -size; x < size * 2; x += stripeW * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeW, 0);
      ctx.lineTo(x + stripeW + size, size);
      ctx.lineTo(x + size, size);
      ctx.closePath();
      ctx.fill();
    }

    dt.update();
    this.textureCache.set(key, dt);
    return dt;
  }

  /**
   * Generates wood grain texture for desks and supervisor office.
   */
  static createWoodTexture(scene: Scene, size = 256): DynamicTexture {
    const key = `wood-${size}`;
    const cached = this.textureCache.get(key);
    if (cached) return cached;

    const dt = new DynamicTexture(key, { width: size, height: size }, scene, true);
    const ctx = dt.getContext() as CanvasRenderingContext2D;

    // Dark walnut/teak
    ctx.fillStyle = '#4a3424';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = '#382517';
    ctx.lineWidth = 2;
    for (let y = 0; y < size; y += 4) {
      ctx.beginPath();
      ctx.moveTo(0, y + Math.sin(y * 0.05) * 3);
      ctx.lineTo(size, y + Math.sin(y * 0.05) * 3);
      ctx.stroke();
    }

    dt.update();
    this.textureCache.set(key, dt);
    return dt;
  }

  /**
   * Generates normal/bump map for surface relief.
   */
  static createBumpMap(
    scene: Scene,
    type: 'noise' | 'tread' | 'seams',
    size = 256,
  ): DynamicTexture {
    const key = `bump-${type}-${size}`;
    const cached = this.textureCache.get(key);
    if (cached) return cached;

    const dt = new DynamicTexture(key, { width: size, height: size }, scene, false);
    const ctx = dt.getContext() as CanvasRenderingContext2D;

    // Flat neutral normal base (RGB 128, 128, 255 = pointing straight out +Z)
    ctx.fillStyle = '#8080ff';
    ctx.fillRect(0, 0, size, size);

    if (type === 'noise') {
      const imgData = ctx.getImageData(0, 0, size, size);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const dx = (Math.random() - 0.5) * 30;
        const dy = (Math.random() - 0.5) * 30;
        data[i] = Math.min(255, Math.max(0, 128 + dx));
        data[i + 1] = Math.min(255, Math.max(0, 128 + dy));
        data[i + 2] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
    } else if (type === 'tread') {
      ctx.fillStyle = '#a0a0ff';
      for (let y = 0; y < size; y += 32) {
        for (let x = 0; x < size; x += 32) {
          ctx.fillRect(x + 8, y + 8, 16, 8);
        }
      }
    }

    dt.update();
    this.textureCache.set(key, dt);
    return dt;
  }

  /**
   * Dispose all cached textures on scene teardown.
   */
  static clearCache(): void {
    for (const tex of this.textureCache.values()) {
      tex.dispose();
    }
    this.textureCache.clear();
  }
}
