// Physics constants + table geometry.
// Units: millimetres, seconds, radians. Frame: x right, y UP (right-handed, z up from the cloth).
// The renderer flips y when drawing. No Math.exp/hypot/pow anywhere in the sim (only + - * / sqrt),
// so a Go port using float64 reproduces results bit-for-bit -> server-authoritative validation.

export const TABLE_W = 2540;   // 9-ft table playing surface
export const TABLE_H = 1270;
export const BALL_R = 28.575;  // 57.15 mm ball

export const STEP = 1 / 480;   // fixed timestep (max ~19 mm travel per step at break speed)
export const G = 9810;
export const V_MAX = 9000;     // cue-ball speed at power 1.0 (mm/s)

export const MU_SLIDE = 0.2;   // ball-cloth sliding friction
export const MU_ROLL = 0.013;  // rolling resistance
export const SPIN_DECAY = 0.8; // english (vertical-axis spin) decay, 1/s
export const STOP_SPEED = 3;   // mm/s: a rolling ball slower than this stops

export const E_BALL = 0.95;    // ball-ball restitution
export const MU_BALL = 0.06;   // ball-ball friction (throw / spin transfer)
export const E_CUSHION = 0.75; // cushion restitution
export const MU_CUSHION = 0.15;

export interface Pocket { x: number; y: number; r: number }
export const POCKETS: Pocket[] = [
  { x: 0, y: 0, r: 68 }, { x: TABLE_W / 2, y: -22, r: 62 }, { x: TABLE_W, y: 0, r: 68 },
  { x: 0, y: TABLE_H, r: 68 }, { x: TABLE_W / 2, y: TABLE_H + 22, r: 62 }, { x: TABLE_W, y: TABLE_H, r: 68 },
];

// Cushion faces as segments [x0,y0,x1,y1]. Segment ends are the pocket "knuckles":
// closest-point collision against a segment handles flat rails and jaw tips uniformly.
const CG = 78, SG = 66, W = TABLE_W, H = TABLE_H;
export const RAILS: [number, number, number, number][] = [
  [CG, 0, W / 2 - SG, 0], [W / 2 + SG, 0, W - CG, 0],
  [CG, H, W / 2 - SG, H], [W / 2 + SG, H, W - CG, H],
  [0, CG, 0, H - CG], [W, CG, W, H - CG],
];
