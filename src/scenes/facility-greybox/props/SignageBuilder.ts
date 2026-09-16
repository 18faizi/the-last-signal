/**
 * Facility-Wide Signage & Wayfinding System.
 *
 * Provides a reusable, data-driven signage helper that generates legible,
 * high-contrast architectural signs, directional fingerposts, and color-coded
 * corridor conduits across Station Echo.
 */
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';

export interface SignOptions {
  readonly id: string;
  readonly text: string;
  readonly subtext?: string;
  readonly position: Vector3;
  readonly rotationY?: number;
  readonly width?: number;
  readonly height?: number;
  readonly accentColor?: string; // hex
  readonly arrow?: 'left' | 'right' | 'up' | 'down';
}

export interface DirectionalFingerpostItem {
  readonly label: string;
  readonly direction: 'left' | 'right' | 'forward' | 'backward';
  readonly distance?: string;
}

export interface SignageSystemHandle {
  readonly meshes: ReadonlyArray<Mesh>;
  dispose(): void;
}

export class SignageBuilder {
  private readonly scene: Scene;
  private readonly meshes: Mesh[] = [];
  private readonly materials: StandardMaterial[] = [];
  private readonly textures: DynamicTexture[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Creates an architectural wall plaque or gate sign with stenciled text.
   */
  createSign(options: SignOptions): Mesh {
    const width = options.width ?? 3.0;
    const height = options.height ?? width * 0.32;
    const depth = 0.05;

    const mesh = CreateBox(`sign-${options.id}`, { width, height, depth }, this.scene);
    mesh.position.copyFrom(options.position);
    if (options.rotationY !== undefined) {
      mesh.rotation.y = options.rotationY;
    }
    mesh.isPickable = false;
    mesh.checkCollisions = false;

    // Create high-resolution dynamic texture for legible typography
    const texW = 1024;
    const texH = Math.round(texW * (height / width));
    const dt = new DynamicTexture(
      `sign-tex-${options.id}`,
      { width: texW, height: texH },
      this.scene,
      false,
    );
    const ctx = dt.getContext() as CanvasRenderingContext2D | null;

    if (ctx && typeof ctx.fillRect === 'function') {
      // 1. Dark weathered steel backing
      ctx.fillStyle = '#0f141c';
      ctx.fillRect(0, 0, texW, texH);

      // 2. High-contrast border
      ctx.strokeStyle = '#2d3b4d';
      ctx.lineWidth = 10;
      ctx.strokeRect(10, 10, texW - 20, texH - 20);

      // 3. Colored accent bar
      const accent = options.accentColor ?? '#38bdf8'; // Industrial cyan by default
      ctx.fillStyle = accent;
      ctx.fillRect(15, 15, texW - 30, 14);
      ctx.fillRect(15, texH - 29, texW - 30, 14);

      // 4. Arrow indicator if specified
      let arrowSymbol = '';
      if (options.arrow === 'left') arrowSymbol = '← ';
      if (options.arrow === 'right') arrowSymbol = ' →';
      if (options.arrow === 'up') arrowSymbol = '↑ ';
      if (options.arrow === 'down') arrowSymbol = '↓ ';

      // 5. Main sign text
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const fontSize = options.subtext ? Math.round(texH * 0.32) : Math.round(texH * 0.42);
      ctx.font = `bold ${fontSize}px sans-serif, system-ui`;

      const displayText =
        options.arrow === 'left'
          ? `${arrowSymbol}${options.text}`
          : `${options.text}${arrowSymbol}`;
      const textY = options.subtext ? texH * 0.42 : texH * 0.5;
      ctx.fillText(displayText, texW * 0.5, textY);

      // 6. Subtext if present
      if (options.subtext) {
        ctx.fillStyle = accent;
        ctx.font = `600 ${Math.round(texH * 0.2)}px sans-serif, system-ui`;
        ctx.fillText(options.subtext, texW * 0.5, texH * 0.74);
      }

      dt.update();
    }

    const mat = new StandardMaterial(`sign-mat-${options.id}`, this.scene);
    mat.diffuseTexture = dt;
    mat.emissiveColor = new Color3(0.35, 0.4, 0.45);
    mat.specularColor = new Color3(0.2, 0.25, 0.3);
    mesh.material = mat;

    this.meshes.push(mesh);
    this.materials.push(mat);
    this.textures.push(dt);

    return mesh;
  }

  /**
   * Creates a freestanding Courtyard Directional Fingerpost with pointing signplates.
   */
  createCourtyardFingerpost(position: Vector3, items: DirectionalFingerpostItem[]): Mesh {
    const postMat = new StandardMaterial('fingerpost-metal-mat', this.scene);
    postMat.diffuseColor = new Color3(0.2, 0.22, 0.25);
    postMat.specularColor = new Color3(0.4, 0.4, 0.4);
    this.materials.push(postMat);

    // Central steel post
    const post = CreateCylinder(
      'fingerpost-pole',
      { height: 3.2, diameter: 0.16, tessellation: 12 },
      this.scene,
    );
    post.position.set(position.x, position.y + 1.6, position.z);
    post.material = postMat;
    post.isPickable = false;
    post.checkCollisions = false;
    this.meshes.push(post);

    // Concrete anchor footing
    const base = CreateCylinder(
      'fingerpost-base',
      { height: 0.3, diameter: 0.6, tessellation: 16 },
      this.scene,
    );
    base.position.set(position.x, position.y + 0.15, position.z);
    base.material = postMat;
    base.isPickable = false;
    base.checkCollisions = false;
    this.meshes.push(base);

    // Finger blades for each destination
    const bladeYOffsets = [2.6, 2.25, 1.9, 1.55];
    const bladeAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;
      const y = position.y + (bladeYOffsets[i] ?? 2.6 - i * 0.35);
      const rotY = bladeAngles[i] ?? 0;

      const blade = CreateBox(
        `fingerpost-blade-${i}`,
        { width: 1.6, height: 0.28, depth: 0.04 },
        this.scene,
      );
      // Offset slightly forward from post along its facing angle
      const forwardX = Math.cos(rotY) * 0.75;
      const forwardZ = -Math.sin(rotY) * 0.75;
      blade.position.set(position.x + forwardX, y, position.z + forwardZ);
      blade.rotation.y = rotY;
      blade.isPickable = false;
      blade.checkCollisions = false;

      // Texture for blade
      const dt = new DynamicTexture(
        `blade-tex-${i}`,
        { width: 512, height: 128 },
        this.scene,
        false,
      );
      const ctx = dt.getContext() as CanvasRenderingContext2D | null;
      if (ctx && typeof ctx.fillRect === 'function') {
        ctx.fillStyle = '#1e293b'; // Slate navy background
        ctx.fillRect(0, 0, 512, 128);

        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 6;
        ctx.strokeRect(4, 4, 504, 120);

        // Accent strip on pointing tip
        ctx.fillStyle = '#f59e0b'; // Amber warning accent
        ctx.fillRect(485, 8, 20, 112);

        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 36px sans-serif, system-ui';
        ctx.fillText(`➜  ${item.label}`, 30, 64);
        dt.update();
      }

      const bladeMat = new StandardMaterial(`blade-mat-${i}`, this.scene);
      bladeMat.diffuseTexture = dt;
      bladeMat.emissiveColor = new Color3(0.3, 0.35, 0.4);
      blade.material = bladeMat;

      this.meshes.push(blade);
      this.materials.push(bladeMat);
      this.textures.push(dt);
    }

    return post;
  }

  /**
   * Generates color-coded conduit lines along hallway walls.
   *  - Yellow: Power Network / Generator Building
   *  - Blue: Telecom / Antenna Deck
   *  - Green: Security / Perimeter Exit
   */
  createCorridorConduit(
    id: string,
    points: Vector3[],
    colorType: 'power' | 'telecom' | 'security',
  ): void {
    const colorHex =
      colorType === 'power'
        ? new Color3(0.95, 0.7, 0.1) // Amber yellow
        : colorType === 'telecom'
          ? new Color3(0.15, 0.65, 0.95) // Cyan blue
          : new Color3(0.2, 0.8, 0.4); // Emerald green

    const conduitMat = new StandardMaterial(`conduit-mat-${id}`, this.scene);
    conduitMat.diffuseColor = colorHex;
    conduitMat.emissiveColor = colorHex.scale(0.35);
    this.materials.push(conduitMat);

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      if (!p1 || !p2) continue;

      const delta = p2.subtract(p1);
      const len = delta.length();
      if (len < 0.01) continue;

      const seg = CreateBox(
        `conduit-${id}-${i}`,
        { width: 0.08, height: 0.08, depth: len },
        this.scene,
      );
      seg.position = Vector3.Center(p1, p2);

      // Rotate segment to align with direction vector
      const dir = delta.normalize();
      const rotY = Math.atan2(dir.x, dir.z);
      seg.rotation.y = rotY;

      seg.material = conduitMat;
      seg.isPickable = false;
      seg.checkCollisions = false;
      this.meshes.push(seg);
    }
  }

  getHandle(): SignageSystemHandle {
    return {
      meshes: [...this.meshes],
      dispose: () => this.dispose(),
    };
  }

  dispose(): void {
    for (const mesh of this.meshes) {
      mesh.dispose();
    }
    this.meshes.length = 0;

    for (const mat of this.materials) {
      mat.dispose();
    }
    this.materials.length = 0;

    for (const tex of this.textures) {
      tex.dispose();
    }
    this.textures.length = 0;
  }
}
