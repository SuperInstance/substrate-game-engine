/**
 * substrate-game-engine
 *
 * Cellular automata + game primitives for the Quilt substrate.
 * Supports Conway, HighLife, Day&Night, Wireworld, Lenia, Rule 110,
 * Forest Fire, and any custom B/S rule.
 */

// === Grid ===
export type Grid = Uint8Array;

export class Grid2D {
  readonly width: number;
  readonly height: number;
  data: Uint8Array;

  constructor(width: number, height: number, data?: Uint8Array | number[][]) {
    this.width = width;
    this.height = height;
    if (data instanceof Uint8Array) {
      if (data.length !== width * height) throw new Error('data length mismatch');
      this.data = data;
    } else if (Array.isArray(data)) {
      this.data = new Uint8Array(width * height);
      for (let i = 0; i < data.length; i++) {
        for (let j = 0; j < data[i].length; j++) {
          this.data[i * width + j] = data[i][j];
        }
      }
    } else {
      this.data = new Uint8Array(width * height);
    }
  }

  get(x: number, y: number): number {
    return this.data[y * this.width + x];
  }

  set(x: number, y: number, v: number): void {
    this.data[y * this.width + x] = v;
  }

  clone(): Grid2D {
    return new Grid2D(this.width, this.height, new Uint8Array(this.data));
  }

  count(predicate?: (v: number) => boolean): number {
    let n = 0;
    for (let i = 0; i < this.data.length; i++) {
      if (!predicate || predicate(this.data[i])) n++;
    }
    return n;
  }

  density(): number {
    return this.count(v => v > 0) / this.data.length;
  }

  toArray2D(): number[][] {
    const out: number[][] = [];
    for (let y = 0; y < this.height; y++) {
      const row: number[] = [];
      for (let x = 0; x < this.width; x++) row.push(this.get(x, y));
      out.push(row);
    }
    return out;
  }
}

export type WrapMode = 'wrap' | 'fixed';

/** Count Moore neighborhood (8 neighbors). */
export function countMoore(grid: Grid2D, x: number, y: number, wrap: WrapMode): number {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      let nx = x + dx, ny = y + dy;
      if (wrap === 'wrap') {
        nx = ((nx % grid.width) + grid.width) % grid.width;
        ny = ((ny % grid.height) + grid.height) % grid.height;
      } else {
        if (nx < 0 || nx >= grid.width || ny < 0 || ny >= grid.height) continue;
      }
      n += grid.get(nx, ny) > 0 ? 1 : 0;
    }
  }
  return n;
}

// === Rule parser: "B3/S23" → { birth: Set(3), survival: Set(2,3) } ===
export interface BSRule {
  birth: Set<number>;
  survival: Set<number>;
}

export function parseBSRule(s: string): BSRule {
  const [bPart, sPart] = s.toUpperCase().split('/');
  if (!bPart.startsWith('B') || !sPart.startsWith('S')) {
    throw new Error(`Invalid B/S rule: ${s}`);
  }
  return {
    birth: new Set(bPart.slice(1).split('').map(Number)),
    survival: new Set(sPart.slice(1).split('').map(Number)),
  };
}

export interface CAResult {
  grid: Grid2D;
  alive: number;
  generation: number;
}

/** Apply a B/S rule. Binary (0 or >0) only. */
export function stepBS(grid: Grid2D, rule: BSRule, wrap: WrapMode = 'wrap'): CAResult {
  const out = new Grid2D(grid.width, grid.height);
  let alive = 0;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const n = countMoore(grid, x, y, wrap);
      const cur = grid.get(x, y) > 0 ? 1 : 0;
      let next = 0;
      if (cur === 1 && rule.survival.has(n)) next = 1;
      else if (cur === 0 && rule.birth.has(n)) next = 1;
      out.set(x, y, next);
      if (next > 0) alive++;
    }
  }
  return { grid: out, alive, generation: 0 };
}

// === Conway's Game of Life ===
export const CONWAY_RULE = parseBSRule('B3/S23');
export function conwayStep(grid: Grid2D, wrap: WrapMode = 'wrap'): CAResult {
  return stepBS(grid, CONWAY_RULE, wrap);
}

// === HighLife (B36/S23) ===
export const HIGHLIFE_RULE = parseBSRule('B36/S23');
export function highlifeStep(grid: Grid2D, wrap: WrapMode = 'wrap'): CAResult {
  return stepBS(grid, HIGHLIFE_RULE, wrap);
}

// === Day & Night (B3678/S34678) ===
export const DAYNIGHT_RULE = parseBSRule('B3678/S34678');
export function daynightStep(grid: Grid2D, wrap: WrapMode = 'wrap'): CAResult {
  return stepBS(grid, DAYNIGHT_RULE, wrap);
}

// === Wireworld (4 states: 0=empty, 1=wire, 2=electron head, 3=electron tail) ===
export interface WireworldResult { grid: Grid2D; heads: number; }

export function wireworldStep(grid: Grid2D, wrap: WrapMode = 'fixed'): WireworldResult {
  const out = grid.clone();
  let heads = 0;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const cur = grid.get(x, y);
      if (cur === 2) {
        out.set(x, y, 3);  // head → tail
      } else if (cur === 3) {
        out.set(x, y, 1);  // tail → wire
      } else if (cur === 1) {
        // wire → head if 1 or 2 electron heads nearby
        const n = countMoore(grid, x, y, wrap);
        const electronHeads = countSpecific(grid, x, y, 2, wrap);
        if (electronHeads === 1 || electronHeads === 2) {
          out.set(x, y, 2);
          heads++;
        }
      }
    }
  }
  return { grid: out, heads };
}

function countSpecific(grid: Grid2D, x: number, y: number, target: number, wrap: WrapMode): number {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      let nx = x + dx, ny = y + dy;
      if (wrap === 'wrap') {
        nx = ((nx % grid.width) + grid.width) % grid.width;
        ny = ((ny % grid.height) + grid.height) % grid.height;
      } else {
        if (nx < 0 || nx >= grid.width || ny < 0 || ny >= grid.height) continue;
      }
      if (grid.get(nx, ny) === target) n++;
    }
  }
  return n;
}

// === Lenia (continuous cellular automaton) ===
export interface LeniaConfig {
  radius: number;       // neighborhood radius (typically 1-13)
  mu: number;           // mean of growth function
  sigma: number;        // width of growth function
  dt: number;           // time step (typically 0.1)
  stepsPerCall: number; // number of Lenia steps per "step" call
}

export const LENIA_DEFAULTS: LeniaConfig = {
  radius: 5,
  mu: 0.15,
  sigma: 0.015,
  dt: 0.1,
  stepsPerCall: 1,
};

export class LeniaField {
  readonly width: number;
  readonly height: number;
  field: Float32Array;

  constructor(width: number, height: number, field?: Float32Array) {
    this.width = width;
    this.height = height;
    this.field = field || new Float32Array(width * height);
  }

  get(x: number, y: number): number {
    return this.field[y * this.width + x];
  }

  set(x: number, y: number, v: number): void {
    this.field[y * this.width + x] = v;
  }

  clone(): LeniaField {
    return new LeniaField(this.width, this.height, new Float32Array(this.field));
  }

  density(): number {
    let s = 0;
    for (let i = 0; i < this.field.length; i++) s += this.field[i];
    return s / this.field.length;
  }
}

const LENIA_BETA: number[] = [];
(function initLeniaBeta() {
  // Bell-shaped kernel
  for (let r = 0; r <= 1; r += 0.005) {
    LENIA_BETA.push(Math.exp(-Math.pow((r - 0.5) * 12, 2) / 2));
  }
})();

function bellBeta(r: number): number {
  if (r < 0 || r > 1) return 0;
  const idx = Math.round(r / 0.005);
  return LENIA_BETA[idx] || 0;
}

export function leniaStep(field: LeniaField, config: LeniaConfig = LENIA_DEFAULTS): LeniaField {
  const out = field.clone();
  const R = config.radius;
  for (let y = 0; y < field.height; y++) {
    for (let x = 0; x < field.width; x++) {
      let sum = 0, weight = 0;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const r = Math.sqrt(dx * dx + dy * dy) / R;
          if (r > 1) continue;
          const nx = ((x + dx) % field.width + field.width) % field.width;
          const ny = ((y + dy) % field.height + field.height) % field.height;
          const b = bellBeta(r);
          sum += field.get(nx, ny) * b;
          weight += b;
        }
      }
      const u = weight > 0 ? sum / weight : 0;
      // Growth function: G(u) = 2 * exp(-((u - mu) / sigma)^2 / 2) - 1
      const g = 2 * Math.exp(-Math.pow((u - config.mu) / config.sigma, 2) / 2) - 1;
      const next = Math.max(0, Math.min(1, field.get(x, y) + config.dt * g));
      out.set(x, y, next);
    }
  }
  return out;
}

// === Rule 110 (1D cellular automaton) ===
export const RULE110_TABLE: Uint8Array = (() => {
  // 110 = 0b01101110
  const t = new Uint8Array(8);
  for (let i = 0; i < 8; i++) t[i] = (110 >> i) & 1;
  return t;
})();

export function rule110Step(line: Uint8Array): Uint8Array {
  const out = new Uint8Array(line.length);
  for (let i = 0; i < line.length; i++) {
    const l = line[(i - 1 + line.length) % line.length];
    const c = line[i];
    const r = line[(i + 1) % line.length];
    const idx = (l << 2) | (c << 1) | r;
    out[i] = RULE110_TABLE[idx];
  }
  return out;
}

// === Forest Fire (3 states: 0=empty, 1=tree, 2=fire) ===
export interface ForestFireConfig {
  p: number;  // tree growth probability per step
  f: number;  // spontaneous fire probability per step
}

export const FORESTFIRE_DEFAULTS: ForestFireConfig = { p: 0.005, f: 0.00005 };

export function forestFireStep(grid: Grid2D, config: ForestFireConfig = FORESTFIRE_DEFAULTS): CAResult {
  const out = grid.clone();
  let trees = 0;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const cur = grid.get(x, y);
      if (cur === 2) {
        // Fire → empty
        out.set(x, y, 0);
      } else if (cur === 1) {
        // Tree → fire if neighbor fire OR spontaneous
        const fireNeighbors = countSpecific(grid, x, y, 2, 'wrap');
        if (fireNeighbors > 0 || Math.random() < config.f) {
          out.set(x, y, 2);
        } else {
          trees++;
        }
      } else {
        // Empty → tree with probability p
        if (Math.random() < config.p) {
          out.set(x, y, 1);
          trees++;
        }
      }
    }
  }
  return { grid: out, alive: trees, generation: 0 };
}

// === Seed helpers ===
export function randomSeed(width: number, height: number, density: number = 0.3, max: number = 1): Grid2D {
  const g = new Grid2D(width, height);
  for (let i = 0; i < g.data.length; i++) {
    g.data[i] = Math.random() < density ? Math.floor(Math.random() * max) + 1 : 0;
  }
  return g;
}

export function glider(width: number, height: number, x: number = 1, y: number = 1): Grid2D {
  const g = new Grid2D(width, height);
  // Conway glider
  g.set(x, y, 1); g.set(x + 1, y, 1); g.set(x + 2, y, 1);
  g.set(x, y + 1, 1); g.set(x + 1, y + 2, 1);
  return g;
}

export function gosperGliderGun(width: number, height = 40): Grid2D {
  const g = new Grid2D(width, height);
  // Simplified: place known Conway glider gun pattern (or skip and just seed gliders)
  const cells: Array<[number, number]> = [
    [1, 5], [1, 6], [2, 5], [2, 6],
    [11, 5], [11, 6], [11, 7], [12, 4], [12, 8], [13, 3], [13, 9], [14, 3], [14, 9],
    [15, 6], [16, 4], [16, 8], [17, 5], [17, 6], [17, 7], [18, 6],
    [21, 3], [21, 4], [21, 5], [22, 3], [22, 4], [22, 5], [23, 2], [23, 6],
    [25, 1], [25, 2], [25, 6], [25, 7],
    [35, 3], [35, 4], [36, 3], [36, 4],
  ];
  for (const [x, y] of cells) g.set(x, y, 1);
  return g;
}

export function circleSeed(field: LeniaField, cx: number, cy: number, radius: number, value: number = 0.5): void {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        const wx = ((x % field.width) + field.width) % field.width;
        const wy = ((y % field.height) + field.height) % field.height;
        field.set(wx, wy, value);
      }
    }
  }
}

// === Game runner ===
export interface GameState {
  rule: string;
  generation: number;
  grid: Grid2D;
  alive: number;
  history: number[];
}

export function makeGame(width: number, height: number, rule: string = 'B3/S23'): GameState {
  return {
    rule,
    generation: 0,
    grid: randomSeed(width, height),
    alive: 0,
    history: [],
  };
}

export function tick(game: GameState, n: number = 1, wrap: WrapMode = 'wrap'): GameState {
  const rule = parseBSRule(game.rule);
  for (let i = 0; i < n; i++) {
    const r = stepBS(game.grid, rule, wrap);
    game.grid = r.grid;
    game.alive = r.alive;
    game.generation++;
    game.history.push(game.alive);
    if (game.history.length > 200) game.history.shift();
  }
  return game;
}

// === Exports ===
export const game = {
  Grid2D,
  countMoore,
  parseBSRule,
  stepBS,
  CONWAY_RULE,
  HIGHLIFE_RULE,
  DAYNIGHT_RULE,
  conwayStep, highlifeStep, daynightStep,
  wireworldStep,
  LeniaField, leniaStep, LENIA_DEFAULTS,
  RULE110_TABLE, rule110Step,
  forestFireStep, FORESTFIRE_DEFAULTS,
  randomSeed, glider, gosperGliderGun, circleSeed,
  makeGame, tick,
};
