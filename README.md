# 8-Ball Pool

Monorepo (client now; `server/`, `shared/`, `docker/` arrive with their phases).

## Status: Phases 1-3 (foundation)

| Phase | State |
|---|---|
| 1 Engine + table | done: Phaser 3 scene, responsive 16:9 canvas |
| 2 Ball physics | done: custom deterministic engine (`client/src/physics`), 6 tests |
| 3 Cue + shooting | basic: slingshot aim/power, aim prediction. Spin is in the engine (`shoot(angle, power, sx, sy)`), spin UI pending |
| 4 Rules | next: `client/src/game/rules.ts`, state machine, ball-in-hand |
| 5-10 | AI, Go server, WebSockets, auth/Postgres, leaderboard, polish, Docker |

## Run

```bash
cd client && npm install
npm run dev        # http://localhost:5173
npm test           # physics tests
npm run build      # production bundle in dist/
```

Controls: press and drag back from the cue ball (like a slingshot), release to shoot. Release near the ball to cancel. `R` re-racks.

## Physics design

- Fixed 480 Hz step, mm/s units, y-up frame (renderer flips y).
- Cloth: sliding friction until the contact point stops slipping, then rolling resistance. Gives real draw/follow from top/back spin.
- Ball-ball: normal impulse (e=0.95) plus friction impulse (throw, english transfer). Two solver passes per step.
- Cushions: closest-point-on-segment, so pocket jaw tips behave like real knuckles. Restitution 0.75, friction couples with english.
- Only `+ - * / sqrt` are used, so the Go server (Phase 6) can port it 1:1 and re-simulate shots for server-authoritative validation.
