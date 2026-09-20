import * as T from './table.ts';

export type BallKind = 'cue' | 'solid' | 'stripe' | 'eight';
export interface Vec2 { x: number; y: number }
export interface Spin { x: number; y: number; z: number } // rad/s. x,y: roll axes; z: english
export interface Ball {
  number: number; kind: BallKind; radius: number; mass: number;
  pos: Vec2; vel: Vec2; spin: Spin; rotation: number;
  pocketed: boolean; pocket: number;
}
export type PhysEvent =
  | { t: 'cue'; speed: number }
  | { t: 'ball'; a: number; b: number; speed: number }
  | { t: 'cushion'; ball: number; speed: number }
  | { t: 'pocket'; ball: number; pocket: number };

const RACK = [[1], [9, 2], [10, 8, 3], [4, 11, 12, 5], [6, 13, 7, 14, 15]];
const sqrt = Math.sqrt;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Deterministic billiards simulation. Pure state + step(); no rendering, rules or I/O. */
export class World {
  balls: Ball[] = [];
  events: PhysEvent[] = [];

  constructor(rack = true) { if (rack) this.rack(); }

  get cue(): Ball { return this.balls.find(b => b.number === 0)!; }

  addBall(n: number, x: number, y: number, vx = 0, vy = 0): Ball {
    const b: Ball = {
      number: n, kind: n === 0 ? 'cue' : n === 8 ? 'eight' : n < 8 ? 'solid' : 'stripe',
      radius: T.BALL_R, mass: 1, pos: { x, y }, vel: { x: vx, y: vy },
      spin: { x: 0, y: 0, z: 0 }, rotation: 0, pocketed: false, pocket: -1,
    };
    this.balls.push(b);
    return b;
  }

  /** Standard triangle: 1 on the apex, 8 in the centre, a solid and a stripe in the back corners. */
  rack() {
    this.balls = []; this.events = [];
    this.addBall(0, T.TABLE_W * 0.25, T.TABLE_H / 2);
    const k = 1.0005, R = T.BALL_R; // tiny gap so the rack starts with zero overlap
    RACK.forEach((row, ri) => row.forEach((n, i) =>
      this.addBall(n, T.TABLE_W * 0.75 + ri * sqrt(3) * R * k, T.TABLE_H / 2 + (i - (row.length - 1) / 2) * 2 * R * k)));
  }

  atRest(): boolean { return this.balls.every(b => b.pocketed || (b.vel.x === 0 && b.vel.y === 0)); }

  /** Cue strike. angle in radians (y up), power 0..1, sx: +right english, sy: +top / -back (-1..1). */
  shoot(angle: number, power: number, sx = 0, sy = 0) {
    const c = this.cue, v = clamp(power, 0, 1) * T.V_MAX;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const k = (1.25 * v) / c.radius; // omega = 5 v b / (2 R^2), tip offset b = 0.5 R * spin
    c.vel.x = dx * v; c.vel.y = dy * v;
    c.spin.x = -dy * k * sy; c.spin.y = dx * k * sy; // natural roll is sy = 0.8
    c.spin.z = -k * sx;
    this.events.push({ t: 'cue', speed: v });
  }

  placeCue(x: number, y: number) {
    while (x > T.BALL_R && this.overlaps(x, y)) x -= T.BALL_R * 2;
    const c = this.cue;
    c.pos = { x, y }; c.vel = { x: 0, y: 0 }; c.spin = { x: 0, y: 0, z: 0 }; c.pocketed = false; c.pocket = -1;
  }

  private overlaps(x: number, y: number) {
    return this.balls.some(b => b.number !== 0 && !b.pocketed &&
      (b.pos.x - x) * (b.pos.x - x) + (b.pos.y - y) * (b.pos.y - y) < 4 * T.BALL_R * T.BALL_R);
  }

  step() {
    const dt = T.STEP;
    for (const b of this.balls) if (!b.pocketed) this.cloth(b, dt);
    for (const b of this.balls) if (!b.pocketed) {
      b.pos.x += b.vel.x * dt; b.pos.y += b.vel.y * dt; b.rotation += b.spin.z * dt;
    }
    for (let i = 0; i < 2; i++) this.collideBalls();
    for (const b of this.balls) if (!b.pocketed) this.collideRails(b);
    for (const b of this.balls) if (!b.pocketed) this.checkPockets(b);
  }

  /** Cloth friction: slide until the contact point stops slipping, then roll and decelerate. */
  private cloth(b: Ball, dt: number) {
    const R = b.radius, v = b.vel, w = b.spin;
    const ux = v.x - R * w.y, uy = v.y + R * w.x; // velocity of the contact point on the cloth
    const us = sqrt(ux * ux + uy * uy);
    if (us > 1e-6) {
      // sliding: max slip reduction per step is 3.5 mu g dt (1 + m R^2 / I = 3.5 for a solid sphere)
      const a = Math.min(1, us / (3.5 * T.MU_SLIDE * T.G * dt)) * T.MU_SLIDE * T.G * dt;
      const nx = ux / us, ny = uy / us;
      v.x -= a * nx; v.y -= a * ny;
      w.x -= (2.5 * a * ny) / R; w.y += (2.5 * a * nx) / R;
    } else {
      const sp = sqrt(v.x * v.x + v.y * v.y);
      if (sp > 0) {
        const ns = Math.max(0, sp - T.MU_ROLL * T.G * dt), s = ns / sp;
        if (ns < T.STOP_SPEED) { v.x = 0; v.y = 0; w.x = 0; w.y = 0; }
        else { v.x *= s; v.y *= s; w.x *= s; w.y *= s; }
      }
    }
    w.z *= 1 - T.SPIN_DECAY * dt;
    if (w.z < 0.05 && w.z > -0.05) w.z = 0;
  }

  private collideBalls() {
    const R = T.BALL_R, n = this.balls.length;
    for (let i = 0; i < n; i++) {
      const a = this.balls[i]; if (a.pocketed) continue;
      for (let j = i + 1; j < n; j++) {
        const b = this.balls[j]; if (b.pocketed) continue;
        let dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 4 * R * R) continue;
        let d = sqrt(d2);
        if (d < 1e-9) { dx = 1; dy = 0; d = 1; }
        const nx = dx / d, ny = dy / d, pen = (2 * R - d) / 2;
        a.pos.x -= nx * pen; a.pos.y -= ny * pen; b.pos.x += nx * pen; b.pos.y += ny * pen;
        const rvx = a.vel.x - b.vel.x, rvy = a.vel.y - b.vel.y;
        const vn = rvx * nx + rvy * ny;
        if (vn <= 0) continue; // already separating
        const jn = ((1 + T.E_BALL) * vn) / 2; // equal masses
        a.vel.x -= jn * nx; a.vel.y -= jn * ny; b.vel.x += jn * nx; b.vel.y += jn * ny;
        // ball-ball friction: throw + english transfer (effective mass 7 with both spinning spheres)
        const tx = -ny, ty = nx;
        const vt = rvx * tx + rvy * ty + R * (a.spin.z + b.spin.z);
        const jt = clamp(-vt / 7, -T.MU_BALL * jn, T.MU_BALL * jn);
        a.vel.x += jt * tx; a.vel.y += jt * ty; b.vel.x -= jt * tx; b.vel.y -= jt * ty;
        a.spin.z += (2.5 * jt) / R; b.spin.z += (2.5 * jt) / R;
        this.events.push({ t: 'ball', a: a.number, b: b.number, speed: vn });
      }
    }
  }

  private collideRails(b: Ball) {
    const R = b.radius;
    for (const [x0, y0, x1, y1] of T.RAILS) {
      const ex = x1 - x0, ey = y1 - y0, len2 = ex * ex + ey * ey;
      const t = clamp(((b.pos.x - x0) * ex + (b.pos.y - y0) * ey) / len2, 0, 1);
      let dx = b.pos.x - (x0 + ex * t), dy = b.pos.y - (y0 + ey * t);
      const d2 = dx * dx + dy * dy;
      if (d2 >= R * R) continue;
      let d = sqrt(d2);
      if (d < 1e-9) { // centre exactly on the segment: push toward table centre
        const len = sqrt(len2); dx = -ey / len; dy = ex / len; d = 0;
        if (dx * (T.TABLE_W / 2 - b.pos.x) + dy * (T.TABLE_H / 2 - b.pos.y) < 0) { dx = -dx; dy = -dy; }
      } else { dx /= d; dy /= d; }
      b.pos.x += dx * (R - d); b.pos.y += dy * (R - d);
      const vn = b.vel.x * dx + b.vel.y * dy;
      if (vn >= 0) continue;
      const jn = -(1 + T.E_CUSHION) * vn;
      b.vel.x += jn * dx; b.vel.y += jn * dy;
      const tx = -dy, ty = dx;
      const vt = b.vel.x * tx + b.vel.y * ty - R * b.spin.z;
      const jt = clamp(-vt / 3.5, -T.MU_CUSHION * jn, T.MU_CUSHION * jn);
      b.vel.x += jt * tx; b.vel.y += jt * ty; b.spin.z -= (2.5 * jt) / R;
      this.events.push({ t: 'cushion', ball: b.number, speed: -vn });
    }
  }

  private checkPockets(b: Ball) {
    let hit = -1;
    T.POCKETS.forEach((p, i) => {
      const dx = b.pos.x - p.x, dy = b.pos.y - p.y;
      if (hit < 0 && dx * dx + dy * dy < p.r * p.r) hit = i;
    });
    if (hit < 0 && (b.pos.x < -T.BALL_R || b.pos.x > T.TABLE_W + T.BALL_R || b.pos.y < -T.BALL_R || b.pos.y > T.TABLE_H + T.BALL_R)) {
      // safety net: a ball must never leave the table; treat it as pocketed in the nearest pocket
      let best = Infinity;
      T.POCKETS.forEach((p, i) => {
        const d = (b.pos.x - p.x) * (b.pos.x - p.x) + (b.pos.y - p.y) * (b.pos.y - p.y);
        if (d < best) { best = d; hit = i; }
      });
    }
    if (hit < 0) return;
    b.pocketed = true; b.pocket = hit;
    b.pos = { x: T.POCKETS[hit].x, y: T.POCKETS[hit].y };
    b.vel = { x: 0, y: 0 }; b.spin = { x: 0, y: 0, z: 0 };
    this.events.push({ t: 'pocket', ball: b.number, pocket: hit });
  }

  /** Aim prediction: where the cue ball first touches a ball or cushion along `angle`. */
  castRay(angle: number) {
    const c = this.cue, R = T.BALL_R, dx = Math.cos(angle), dy = Math.sin(angle);
    let best = Infinity, hit: Ball | null = null;
    for (const b of this.balls) {
      if (b === c || b.pocketed) continue;
      const ox = c.pos.x - b.pos.x, oy = c.pos.y - b.pos.y;
      const bq = ox * dx + oy * dy, disc = bq * bq - (ox * ox + oy * oy - 4 * R * R);
      if (disc < 0) continue;
      const t = -bq - sqrt(disc);
      if (t > 0 && t < best) { best = t; hit = b; }
    }
    const walls: number[] = [];
    if (dx > 0) walls.push((T.TABLE_W - R - c.pos.x) / dx); else if (dx < 0) walls.push((R - c.pos.x) / dx);
    if (dy > 0) walls.push((T.TABLE_H - R - c.pos.y) / dy); else if (dy < 0) walls.push((R - c.pos.y) / dy);
    for (const t of walls) if (t > 0 && t < best) { best = t; hit = null; }
    const x = c.pos.x + dx * best, y = c.pos.y + dy * best;
    return {
      x, y, ball: hit ? hit.number : null,
      dirX: hit ? (hit.pos.x - x) / (2 * R) : 0, dirY: hit ? (hit.pos.y - y) / (2 * R) : 0, // object-ball direction
    };
  }
}
