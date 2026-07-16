/**
 * Extended geometry helpers for the facility greybox scene.
 *
 * Wraps CourseBuilder and adds facility-specific primitives: walls with door
 * openings, stairs (step sequence), railings, ceilings, floors, pillars,
 * tunnel segments, ramps, and equipment blocks.
 *
 * All methods add a static Havok physics body via CourseBuilder.box() or the
 * underlying addStaticCollider path.  Decorative items that need no physics
 * (small props, labels) use CreateBox directly.
 */
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import { CourseBuilder } from '../movement-test/CourseBuilder';
import type { FacilityPalette } from './FacilityMaterials';

export class FacilityGeometryHelper {
  readonly course: CourseBuilder;
  private readonly scene: Scene;
  private readonly palette: FacilityPalette;
  /** Non-physics decorative meshes (disposed with scene, tracked for label textures). */
  private readonly decorMeshes: Mesh[] = [];

  constructor(scene: Scene, palette: FacilityPalette) {
    this.scene = scene;
    this.palette = palette;
    this.course = new CourseBuilder(scene);
  }

  // ----- basic structural elements ----------------------------------------

  /** Flat floor slab with physics. */
  floor(
    id: string,
    options: { cx: number; cy: number; cz: number; w: number; d: number; h?: number },
  ): Mesh {
    return this.course.box(`fac-floor-${id}`, {
      width: options.w,
      height: options.h ?? 0.3,
      depth: options.d,
      position: new Vector3(options.cx, options.cy, options.cz),
      color: this.palette.floor.diffuseColor,
    });
  }

  /** Ceiling slab with physics. */
  ceiling(
    id: string,
    options: { cx: number; cy: number; cz: number; w: number; d: number; h?: number },
  ): Mesh {
    return this.course.box(`fac-ceiling-${id}`, {
      width: options.w,
      height: options.h ?? 0.3,
      depth: options.d,
      position: new Vector3(options.cx, options.cy, options.cz),
      color: this.palette.ceiling.diffuseColor,
    });
  }

  /** Full wall panel with physics. */
  wall(
    id: string,
    options: {
      cx: number;
      cy: number;
      cz: number;
      w: number;
      h: number;
      d: number;
      color?: Color3;
    },
  ): Mesh {
    return this.course.box(`fac-wall-${id}`, {
      width: options.w,
      height: options.h,
      depth: options.d,
      position: new Vector3(options.cx, options.cy, options.cz),
      color: options.color ?? this.palette.concrete.diffuseColor,
    });
  }

  /**
   * Wall with a door-height opening cut from it.
   * Renders as three boxes: left jamb, right jamb, lintel.
   *
   * wallW: total wall width (including opening)
   * openW: opening width
   * openH: opening height
   */
  wallWithOpening(
    id: string,
    options: {
      cx: number;
      cy: number;
      cz: number;
      wallW: number;
      wallH: number;
      wallD: number;
      openW: number;
      openH: number;
      openOffsetX?: number; // centre of opening relative to wall centre
      color?: Color3;
    },
  ): void {
    const col = options.color ?? this.palette.concrete.diffuseColor;
    const d = options.wallD;
    const wH = options.wallH;
    const oW = options.openW;
    const oH = options.openH;
    const oX = options.openOffsetX ?? 0;
    const wallW = options.wallW;
    const cx = options.cx;
    const cy = options.cy;
    const cz = options.cz;

    // Left jamb
    const leftW = wallW / 2 + oX - oW / 2;
    if (leftW > 0.01) {
      this.course.box(`fac-wall-${id}-ljamb`, {
        width: leftW,
        height: wH,
        depth: d,
        position: new Vector3(cx - wallW / 2 + leftW / 2, cy, cz),
        color: col,
      });
    }
    // Right jamb
    const rightW = wallW / 2 - oX - oW / 2;
    if (rightW > 0.01) {
      this.course.box(`fac-wall-${id}-rjamb`, {
        width: rightW,
        height: wH,
        depth: d,
        position: new Vector3(cx + wallW / 2 - rightW / 2, cy, cz),
        color: col,
      });
    }
    // Lintel above opening
    const lintelH = wH - oH;
    if (lintelH > 0.01) {
      this.course.box(`fac-wall-${id}-lintel`, {
        width: oW,
        height: lintelH,
        depth: d,
        position: new Vector3(cx + oX, cy + (wH - lintelH) / 2, cz),
        color: col,
      });
    }
  }

  /**
   * Stair flight: a sequence of steps from (x0,y0,z0) going in +Z.
   * stepW: width of staircase, stepH: rise per step, stepD: run per step.
   */
  stairs(
    id: string,
    options: {
      x0: number;
      y0: number;
      z0: number;
      stepW: number;
      stepH: number;
      stepD: number;
      count: number;
      color?: Color3;
    },
  ): void {
    const col = options.color ?? this.palette.stair.diffuseColor;
    for (let i = 0; i < options.count; i++) {
      const stepZ = options.z0 + options.stepD * (i + 0.5);
      const cumulativeH = options.stepH * (i + 1);
      this.course.box(`fac-step-${id}-${i}`, {
        width: options.stepW,
        height: cumulativeH,
        depth: options.stepD,
        position: new Vector3(options.x0, options.y0 + cumulativeH / 2, stepZ),
        color: col,
      });
    }
  }

  /** Simple railing (thin box, no physics — decorative only). */
  railing(
    id: string,
    options: { cx: number; cy: number; cz: number; w: number; d: number; h?: number },
  ): Mesh {
    const mesh = CreateBox(
      `fac-railing-${id}`,
      { width: options.w, height: options.h ?? 1.0, depth: options.d },
      this.scene,
    );
    mesh.position.set(options.cx, options.cy, options.cz);
    mesh.material = this.materialForColor(this.palette.metal.diffuseColor);
    mesh.isPickable = false;
    this.decorMeshes.push(mesh);
    return mesh;
  }

  /** Equipment block (console/rack/cabinet shape). No physics. */
  equipment(
    id: string,
    options: { cx: number; cy: number; cz: number; w: number; h: number; d: number },
    material?: StandardMaterial,
  ): Mesh {
    const mesh = CreateBox(
      `fac-eq-${id}`,
      { width: options.w, height: options.h, depth: options.d },
      this.scene,
    );
    mesh.position.set(options.cx, options.cy, options.cz);
    mesh.material = material ?? this.palette.equipment;
    mesh.isPickable = false;
    this.decorMeshes.push(mesh);
    return mesh;
  }

  /** Physics-colliding equipment block (desks, lockers). */
  equipmentSolid(
    id: string,
    options: { cx: number; cy: number; cz: number; w: number; h: number; d: number },
  ): Mesh {
    return this.course.box(`fac-eq-${id}`, {
      width: options.w,
      height: options.h,
      depth: options.d,
      position: new Vector3(options.cx, options.cy, options.cz),
      color: this.palette.equipment.diffuseColor,
    });
  }

  /** Flat outdoor ground with concrete surface. */
  outdoor(id: string, options: { cx: number; cz: number; w: number; d: number; y?: number }): Mesh {
    return this.course.box(`fac-outdoor-${id}`, {
      width: options.w,
      height: 0.5,
      depth: options.d,
      position: new Vector3(options.cx, (options.y ?? 0) - 0.25, options.cz),
      color: this.palette.ground.diffuseColor,
    });
  }

  /** Perimeter fence section (thin physics panel). */
  fence(
    id: string,
    options: {
      cx: number;
      cy: number;
      cz: number;
      w: number;
      h: number;
      d: number;
      ry?: number;
    },
  ): Mesh {
    return this.course.box(`fac-fence-${id}`, {
      width: options.w,
      height: options.h,
      depth: options.d,
      position: new Vector3(options.cx, options.cy, options.cz),
      rotationY: options.ry ?? 0,
      color: this.palette.fence.diffuseColor,
    });
  }

  /** Tunnel segment (floor + left wall + right wall + ceiling). */
  tunnelSegment(
    id: string,
    options: {
      cx: number;
      cy: number;
      cz: number;
      len: number; // along Z
      width: number;
      height: number;
      wallThick?: number;
    },
  ): void {
    const wt = options.wallThick ?? 0.3;
    const halfW = options.width / 2;
    const cy = options.cy;

    // Floor
    this.course.box(`fac-tun-${id}-floor`, {
      width: options.width,
      height: wt,
      depth: options.len,
      position: new Vector3(options.cx, cy - options.height / 2 + wt / 2, options.cz),
      color: this.palette.tunnel.diffuseColor,
    });
    // Ceiling
    this.course.box(`fac-tun-${id}-ceil`, {
      width: options.width,
      height: wt,
      depth: options.len,
      position: new Vector3(options.cx, cy + options.height / 2 - wt / 2, options.cz),
      color: this.palette.tunnel.diffuseColor,
    });
    // Left wall
    this.course.box(`fac-tun-${id}-lwl`, {
      width: wt,
      height: options.height,
      depth: options.len,
      position: new Vector3(options.cx - halfW - wt / 2, cy, options.cz),
      color: this.palette.tunnel.diffuseColor,
    });
    // Right wall
    this.course.box(`fac-tun-${id}-rwl`, {
      width: wt,
      height: options.height,
      depth: options.len,
      position: new Vector3(options.cx + halfW + wt / 2, cy, options.cz),
      color: this.palette.tunnel.diffuseColor,
    });
  }

  /** Dev floating label. */
  label(text: string, position: Vector3, width?: number): Mesh {
    return this.course.label(text, position, width);
  }

  dispose(): void {
    this.course.dispose();
    // Decorative meshes are disposed with the scene — no explicit disposal needed.
    this.decorMeshes.length = 0;
  }

  private materialForColor(color: Color3): StandardMaterial {
    return this.course.material(color.toHexString(), color);
  }
}
