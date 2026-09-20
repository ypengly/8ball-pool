import Phaser from 'phaser';
import { World } from '../physics/world.ts';
import * as T from '../physics/table.ts';

// Rendering + input only. All ball behaviour lives in physics/World.
const S = 0.54;                                   // mm -> px
const OX = (1600 - T.TABLE_W * S) / 2;
const OY = (900 - T.TABLE_H * S) / 2 + 10;
const px = (x: number) => OX + x * S;
const py = (y: number) => OY + (T.TABLE_H - y) * S; // physics y is up, screen y is down
const PALETTE = [0xf4f1e8, 0xf2c500, 0x1f4fbf, 0xd42a2a, 0x5a2a8f, 0xf07a12, 0x1b8a3a, 0x7a1a1a, 0x111111];
const colorOf = (n: number) => PALETTE[n > 8 ? n - 8 : n];
const PULL_MAX = 260; // px of drag for full power

export class TableScene extends Phaser.Scene {
  private world = new World();
  private acc = 0;
  private g!: Phaser.GameObjects.Graphics;
  private labels = new Map<number, Phaser.GameObjects.Text>();
  private hud!: Phaser.GameObjects.Text;
  private aim: { angle: number; power: number } | null = null;
  private shooting = false;

  constructor() { super('table'); }

  create() {
    this.drawTable();
    this.g = this.add.graphics().setDepth(10);
    for (const b of this.world.balls) if (b.number > 0)
      this.labels.set(b.number, this.add.text(0, 0, String(b.number),
        { fontFamily: 'sans-serif', fontSize: '11px', color: '#111', fontStyle: 'bold' }).setOrigin(0.5).setDepth(11));
    this.hud = this.add.text(800, 28, '', { fontFamily: 'sans-serif', fontSize: '20px', color: '#cfe8dc' }).setOrigin(0.5);
    this.add.text(60, 804, 'POWER', { fontFamily: 'sans-serif', fontSize: '16px', color: '#cfe8dc' });
    this.hud.setText('Practice: drag back from the cue ball to aim, release to shoot. R re-racks.');

    this.input.on('pointerdown', this.pull, this);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (p.isDown) this.pull(p); });
    this.input.on('pointerup', this.release, this);
    this.input.keyboard?.on('keydown-R', () => { this.world.rack(); this.shooting = false; this.aim = null; });
  }

  // Slingshot control: works identically for mouse and touch.
  private pull(p: Phaser.Input.Pointer) {
    const c = this.world.cue;
    if (this.shooting || c.pocketed) return;
    const dx = p.x - px(c.pos.x), dy = p.y - py(c.pos.y), len = Math.sqrt(dx * dx + dy * dy);
    if (len < 14) { this.aim = null; return; } // releasing near the ball cancels the shot
    this.aim = { angle: Math.atan2(dy, -dx), power: Math.min(len / PULL_MAX, 1) };
  }

  private release() {
    if (!this.aim || this.aim.power < 0.04) { this.aim = null; return; }
    this.world.shoot(this.aim.angle, this.aim.power);
    this.aim = null; this.shooting = true; this.hud.setText('');
  }

  update(_t: number, delta: number) {
    this.acc = Math.min(this.acc + delta / 1000, 0.1);
    while (this.acc >= T.STEP) { this.world.step(); this.acc -= T.STEP; }
    this.world.events.length = 0; // Phase 10: route these to audio instead of discarding
    if (this.shooting && this.world.atRest()) {
      this.shooting = false;
      if (this.world.cue.pocketed) {
        this.world.placeCue(T.TABLE_W * 0.25, T.TABLE_H / 2);
        this.hud.setText('Scratch: cue ball returned to the head spot');
      }
    }
    this.render();
  }

  private render() {
    const g = this.g, r = T.BALL_R * S;
    g.clear();
    for (const b of this.world.balls) {
      const label = this.labels.get(b.number);
      if (b.pocketed) { label?.setVisible(false); continue; }
      const x = px(b.pos.x), y = py(b.pos.y);
      g.fillStyle(0x000000, 0.25).fillCircle(x + 3, y + 4, r);
      g.fillStyle(b.kind === 'cue' || b.kind === 'stripe' ? 0xf4f1e8 : colorOf(b.number)).fillCircle(x, y, r);
      if (b.kind === 'stripe') {
        const a = Math.asin(0.55), pts: Phaser.Types.Math.Vector2Like[] = [];
        for (let i = 0; i <= 8; i++) { const t = -a + (2 * a * i) / 8; pts.push({ x: x + Math.cos(t) * r, y: y + Math.sin(t) * r }); }
        for (let i = 8; i >= 0; i--) { const t = -a + (2 * a * i) / 8; pts.push({ x: x - Math.cos(t) * r, y: y + Math.sin(t) * r }); }
        g.fillStyle(colorOf(b.number)).fillPoints(pts, true);
      }
      if (b.number > 0) g.fillStyle(0xf4f1e8).fillCircle(x, y, r * 0.42);
      g.fillStyle(0xffffff, 0.35).fillCircle(x - r * 0.35, y - r * 0.35, r * 0.22);
      label?.setVisible(true).setPosition(x, y);
    }
    if (this.aim && !this.shooting) this.drawAim(g, r);
  }

  private drawAim(g: Phaser.GameObjects.Graphics, r: number) {
    const { angle, power } = this.aim!, c = this.world.cue, hit = this.world.castRay(angle);
    const cx = px(c.pos.x), cy = py(c.pos.y), ux = Math.cos(angle), uy = -Math.sin(angle);
    g.lineStyle(2, 0xffffff, 0.7).lineBetween(cx, cy, px(hit.x), py(hit.y));
    g.lineStyle(2, 0xffffff, 0.9).strokeCircle(px(hit.x), py(hit.y), r);
    if (hit.ball !== null) { // object-ball departure line
      const bx = px(hit.x + hit.dirX * 2 * T.BALL_R), by = py(hit.y + hit.dirY * 2 * T.BALL_R);
      g.lineStyle(2, 0xf2c500, 0.9).lineBetween(bx, by, bx + hit.dirX * 110, by - hit.dirY * 110);
    }
    const gap = r + 6 + power * 70; // cue stick pulls back with power
    g.lineStyle(7, 0xc9974f).lineBetween(cx - ux * gap, cy - uy * gap, cx - ux * (gap + 360), cy - uy * (gap + 360));
    g.fillStyle(0x000000, 0.4).fillRect(60, 830, 300, 18);
    g.fillStyle(power < 0.5 ? 0x3ecf7a : power < 0.8 ? 0xf2c500 : 0xd42a2a).fillRect(60, 830, 300 * power, 18);
  }

  private drawTable() {
    const g = this.add.graphics().setDepth(0), W = T.TABLE_W * S, H = T.TABLE_H * S, m = 46;
    g.fillStyle(0x4a2f17).fillRoundedRect(OX - m, OY - m, W + 2 * m, H + 2 * m, 26);
    g.fillStyle(0x3a2411).fillRoundedRect(OX - m + 8, OY - m + 8, W + 2 * m - 16, H + 2 * m - 16, 20);
    g.fillStyle(0x1e6b4b).fillRect(OX, OY, W, H);
    const o = 6 / S; // cushion strokes sit just outside the playing surface
    g.lineStyle(12, 0x14503a);
    for (const [x0, y0, x1, y1] of T.RAILS) {
      const dx = x0 === x1 ? (x0 < T.TABLE_W / 2 ? -o : o) : 0, dy = y0 === y1 ? (y0 < T.TABLE_H / 2 ? -o : o) : 0;
      g.lineBetween(px(x0 + dx), py(y0 + dy), px(x1 + dx), py(y1 + dy));
    }
    for (const p of T.POCKETS) g.fillStyle(0x050505).fillCircle(px(p.x), py(p.y), p.r * S * 0.95);
    g.lineStyle(1, 0xffffff, 0.25).lineBetween(px(T.TABLE_W * 0.25), OY, px(T.TABLE_W * 0.25), OY + H);
    g.fillStyle(0xffffff, 0.35).fillCircle(px(T.TABLE_W * 0.75), py(T.TABLE_H / 2), 3);
  }
}
