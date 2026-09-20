import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import * as T from './table.ts';

const run = (w: World, sec: number, stop: () => boolean = () => false) => {
  const n = Math.round(sec / T.STEP);
  for (let i = 0; i < n; i++) { w.step(); if (stop()) return; }
};
const hasEvent = (w: World, t: string) => w.events.some(e => e.t === t);

describe('collisions', () => {
  it('conserves momentum in a head-on ball collision', () => {
    const w = new World(false), c = w.addBall(0, 600, 635), b = w.addBall(1, 1000, 635);
    w.shoot(0, 0.3);
    let prev = 0;
    run(w, 2, () => { if (hasEvent(w, 'ball')) return true; prev = c.vel.x; return false; });
    expect(c.vel.x + b.vel.x).toBeCloseTo(prev, -2);
    expect(b.vel.x).toBeGreaterThan(c.vel.x);
  });

  it('reflects off a cushion with energy loss', () => {
    const w = new World(false), c = w.addBall(0, 1270, 400);
    w.shoot(-Math.PI / 4, 0.3);
    let prevVy = 0, prevSp = 0;
    run(w, 3, () => {
      if (hasEvent(w, 'cushion')) return true;
      prevVy = c.vel.y; prevSp = Math.sqrt(c.vel.x ** 2 + c.vel.y ** 2); return false;
    });
    expect(prevVy).toBeLessThan(0);
    expect(c.vel.y).toBeGreaterThan(0);
    expect(c.vel.x).toBeGreaterThan(0);
    expect(Math.sqrt(c.vel.x ** 2 + c.vel.y ** 2)).toBeLessThan(prevSp);
  });
});

describe('pockets, friction, spin', () => {
  it('pockets a ball rolled into a corner', () => {
    const w = new World(false), c = w.addBall(0, 300, 200);
    w.shoot(Math.atan2(-200, -300), 0.4);
    run(w, 5, () => w.atRest());
    expect(c.pocketed).toBe(true);
    expect(w.events.some(e => e.t === 'pocket' && e.pocket === 0)).toBe(true);
  });

  it('friction brings a ball to a complete stop', () => {
    const w = new World(false), c = w.addBall(0, 600, 635);
    w.shoot(0, 0.05);
    run(w, 30);
    expect(w.atRest()).toBe(true);
    expect(c.pos.x).toBeGreaterThan(600);
  });

  it('backspin draws the cue ball back, topspin follows through', () => {
    for (const [sy, dir] of [[-0.8, -1], [0.8, 1]] as const) {
      const w = new World(false), c = w.addBall(0, 800, 635); w.addBall(1, 1300, 635);
      w.shoot(0, 0.3, 0, sy);
      run(w, 20);
      if (dir < 0) expect(c.pos.x).toBeLessThan(1000); else expect(c.pos.x).toBeGreaterThan(1250);
    }
  });
});

describe('break', () => {
  const play = () => {
    const w = new World(); w.shoot(0, 1);
    let worst = 0;
    for (let i = 0; i < 9600; i++) {
      w.step();
      if (i < 480 || i % 10) continue; // let the first second of the break settle
      const live = w.balls.filter(b => !b.pocketed);
      for (const b of live) {
        expect(b.pos.x).toBeGreaterThan(-1); expect(b.pos.x).toBeLessThan(T.TABLE_W + 1);
        expect(b.pos.y).toBeGreaterThan(-1); expect(b.pos.y).toBeLessThan(T.TABLE_H + 1);
      }
      for (let a = 0; a < live.length; a++) for (let b = a + 1; b < live.length; b++)
        worst = Math.max(worst, 2 * T.BALL_R - Math.hypot(live[a].pos.x - live[b].pos.x, live[a].pos.y - live[b].pos.y));
    }
    return { worst, state: JSON.stringify(w.balls.map(b => [b.pos.x, b.pos.y, b.pocketed])) };
  };

  it('never leaves balls overlapping or off the table, and is deterministic', () => {
    const a = play(), b = play();
    expect(a.worst).toBeLessThan(1);
    expect(a.state).toBe(b.state);
  });
});
