# 🎱 8-Ball Pool

<div align="center">

![Phaser](https://img.shields.io/badge/Phaser-3-8A2BE2?style=for-the-badge&logo=phaser&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Go](https://img.shields.io/badge/Go-Planned-00ADD8?style=for-the-badge&logo=go&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Planned-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Planned-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Phase 1-3](https://img.shields.io/badge/Phase-1--3_of_10-22C55E?style=for-the-badge)
![Deterministic](https://img.shields.io/badge/Physics-Deterministic-FF6B6B?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

**A deterministic, server-verifiable 8-ball pool game.**

*Custom physics engine · Slingshot aiming · Built for 1:1 server-side re-simulation*

[📖 Overview](#-overview) • [🏗️ Status](#-status-phases-1-3-foundation) • [🚀 Run](#-run) • [🔬 Physics Design](#-physics-design) • [🗺️ Roadmap](#-roadmap)

</div>

---

## 📖 Overview

**8-Ball Pool** is a monorepo for a deterministic pool game — built to be **server-authoritative** from the ground up.

Today, the client is playable. The physics engine is written with **a single hard constraint**: it must be portable **1:1 to Go**, so the server *(Phase 6)* can re-simulate any shot and verify it independently.

### Core Idea

> **Deterministic by design, not by accident.**
>
> Only `+`, `-`, `*`, `/`, and `sqrt` are used in the physics engine — so the Go port is a mechanical translation, not a rewrite. The server re-simulates every shot and holds the truth.

---

## 🏗️ Status: Phases 1–3 (Foundation)

| Phase | State |
|-------|-------|
| **1** — Engine + table | ✅ **Done** — Phaser 3 scene, responsive 16:9 canvas |
| **2** — Ball physics | ✅ **Done** — custom deterministic engine (`client/src/physics`), 6 tests |
| **3** — Cue + shooting | 🟡 **Basic** — slingshot aim/power, aim prediction. Spin is in the engine (`shoot(angle, power, sx, sy)`); spin UI pending |
| **4** — Rules | ⏭️ **Next** — `client/src/game/rules.ts`, state machine, ball-in-hand |
| **5–10** | AI · Go server · WebSockets · Auth/Postgres · Leaderboard · Polish · Docker |

> 📦 **Monorepo layout:** client only for now. `server/`, `shared/`, and `docker/` arrive with their phases.

---

## 🚀 Run

```bash
cd client && npm install
npm run dev        # http://localhost:5173
npm test           # physics tests
npm run build      # production bundle in dist/
```

### Controls

| Input | Action |
|-------|--------|
| **Press and drag back** from the cue ball | Aim — like a slingshot |
| **Release** | Shoot |
| **Release near the ball** | Cancel the shot |
| **`R`** | Re-rack |

---

## 🔬 Physics Design

The entire physics engine is built around one rule: **determinism must survive a language port.**

### 🧮 Numeric Foundation

| Aspect | Choice | Why |
|--------|--------|-----|
| **Timestep** | Fixed **480 Hz** | Fast enough for accurate cushion and jaw interactions; deterministic across machines |
| **Units** | **mm/s** | Integer-friendly scale, avoids floating-point precision drift |
| **Coordinate frame** | **y-up** | Renderer flips y for Phaser |
| **Allowed operations** | `+ - * / sqrt` | Nothing else. This is what makes the Go port **1:1**, not a rewrite |

### 🎱 Ball Dynamics

**Cloth interaction** — two-regime friction:

1. **Sliding friction** — applied until the contact point stops slipping
2. **Rolling resistance** — applied once rolling

> 💡 **This is what produces real draw and follow** from top/back spin — not a scripted animation.

**Ball-ball collision** — two solver passes per step:

- **Normal impulse** — restitution `e = 0.95`
- **Friction impulse** — provides *throw* and *english transfer*

**Cushion interaction** — closest-point-on-segment:

- Pocket jaw tips behave like **real knuckles**
- Restitution `0.75`
- Friction **couples with english**

### 🔁 Why This Matters

Because the engine uses **only `+ - * / sqrt`**, the Go server *(Phase 6)* can:

1. **Port the physics code 1:1** — no translation layer
2. **Re-simulate any shot** — starting from the same state
3. **Verify the outcome** — without trusting the client

> ✅ **Server-authoritative validation becomes a mechanical step, not a research project.**

---

## 📁 Project Structure

```
8-ball-pool/
├── client/                    Phaser 3 + TypeScript frontend
│   └── src/
│       ├── physics/           ✅ Deterministic engine (6 tests)
│       ├── game/              Phase 4: rules.ts, state machine
│       └── ...                Scenes, rendering, input
│
├── server/                    ⏭️ Phase 6: Go server for re-simulation
├── shared/                    ⏭️ Shared types and constants
├── docker/                    ⏭️ Phase 10: Docker Compose setup
└── README.md
```

---

## 🗺️ Roadmap

### ✅ Phase 1 — Engine + Table

- [x] Phaser 3 scene setup
- [x] Responsive 16:9 canvas
- [x] Table rendering

### ✅ Phase 2 — Ball Physics

- [x] Custom deterministic engine at `client/src/physics`
- [x] Fixed 480 Hz step, mm/s units, y-up frame
- [x] Sliding + rolling friction model
- [x] Ball-ball impulse with friction (throw, english transfer)
- [x] Cushion collision with closest-point-on-segment
- [x] 6 automated tests

### 🟡 Phase 3 — Cue + Shooting

- [x] Slingshot aim and power
- [x] Aim prediction
- [x] Spin available in the engine — `shoot(angle, power, sx, sy)`
- [ ] Spin UI

### ⏭️ Phase 4 — Rules *(Next)*

- [ ] `client/src/game/rules.ts`
- [ ] Game state machine
- [ ] Ball-in-hand logic

### 🔜 Phases 5–10

- [ ] **Phase 5** — AI opponent
- [ ] **Phase 6** — Go server with deterministic re-simulation
- [ ] **Phase 7** — WebSockets for real-time multiplayer
- [ ] **Phase 8** — Auth + PostgreSQL
- [ ] **Phase 9** — Leaderboard and match history
- [ ] **Phase 10** — Polish and Docker deployment

---

## 🎯 Design Principles

<div align="center">

| 🧮 Deterministic First | 🌐 Server-Authoritative |
|:---:|:---:|
| Only `+ - * / sqrt` — portable 1:1 to any language | The server re-simulates every shot and holds the truth |
| **📏 Fixed Timestep** | **🔬 Physical Fidelity** |
| 480 Hz — accurate cushions, same result everywhere | Real draw, follow, throw, and english — not scripted physics |
| **🎯 Built for Multiplayer** | **🧪 Tested** |
| Engine designed for WebSocket re-simulation from day one | Physics has automated tests before the game has rules |

</div>

---

## 🤝 Contributing

Contributions are welcome. Please:

1. Fork the repository
2. **Preserve determinism** — if it can't be expressed with `+ - * / sqrt`, don't add it to physics
3. **Preserve the fixed timestep** — no variable-step physics
4. **Test physics changes** — the 6 tests are the contract
5. **Keep the client/server split in mind** — anything in `physics/` must be portable to Go
6. Submit a Pull Request

### Guidelines

- **Never use `sin`, `cos`, `pow`, or `**` in physics** — they break 1:1 portability
- **Never introduce variable-timestep physics** — determinism dies the moment you do
- **Never trust the client** — the server re-simulates everything
- **Never bypass the tests** — they're what keeps the engine honest

---

## 📜 License

MIT — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **Phaser 3** — for the scene graph
- **Go's math package** — for making the eventual port painless
- **Every physics engine that's ever drifted between machines** — this one won't

---

<div align="center">

### 🎱 AIM. SHOOT. VERIFY.

**Deterministic by design. Server-authoritative by intent.**

**Only `+ - * / sqrt` — portable 1:1 to Go.**

<br>

⭐ If this project helped you, consider giving it a star.

<br>

[⬆ Back to Top](#-8-ball-pool)

</div>
