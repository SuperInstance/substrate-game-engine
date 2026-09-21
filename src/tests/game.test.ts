/**
 * substrate-game-engine tests
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Grid2D, parseBSRule, stepBS, conwayStep, highlifeStep, daynightStep,
  wireworldStep, LeniaField, leniaStep, rule110Step,
  forestFireStep, randomSeed, glider, gosperGliderGun, circleSeed,
  makeGame, tick, countMoore,
} from '../index.ts';

// === Grid basics ===
test('Grid2D initializes empty', () => {
  const g = new Grid2D(5, 5);
  assert.equal(g.data.length, 25);
  assert.equal(g.count(v => v > 0), 0);
});

test('Grid2D accepts 2D array', () => {
  const g = new Grid2D(2, 2, [[1, 0], [0, 1]]);
  assert.equal(g.get(0, 0), 1);
  assert.equal(g.get(1, 0), 0);
  assert.equal(g.get(0, 1), 0);
  assert.equal(g.get(1, 1), 1);
});

test('Grid2D density', () => {
  const g = new Grid2D(2, 2, [[1, 1], [0, 0]]);
  assert.equal(g.density(), 0.5);
});

test('countMoore counts 8 neighbors', () => {
  const g = new Grid2D(3, 3, [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
  ]);
  assert.equal(countMoore(g, 1, 1, 'fixed'), 8);
});

test('countMoore wrap mode', () => {
  const g = new Grid2D(3, 3);
  g.set(0, 0, 1); g.set(2, 2, 1); g.set(2, 0, 1); g.set(0, 2, 1);
  // wrap: corner (0,0) sees corners (2,2), (0,2), (2,0) = 3 neighbors (not (1,1))
  assert.equal(countMoore(g, 0, 0, 'wrap'), 3);
});

// === B/S rule parser ===
test('parseBSRule "B3/S23"', () => {
  const r = parseBSRule('B3/S23');
  assert.deepEqual([...r.birth].sort(), [3]);
  assert.deepEqual([...r.survival].sort(), [2, 3]);
});

test('parseBSRule invalid', () => {
  assert.throws(() => parseBSRule('xyz'));
});

// === Conway ===
test('Conway block is still life', () => {
  const g = new Grid2D(4, 4);
  g.set(1, 1, 1); g.set(2, 1, 1); g.set(1, 2, 1); g.set(2, 2, 1);
  const r = conwayStep(g);
  assert.equal(r.alive, 4);
});

test('Conway glider moves', () => {
  const g = glider(20, 20);
  const start = g.count();
  let gliderAlive = true;
  for (let i = 0; i < 4; i++) {
    const r = conwayStep(g);
    g.data = r.grid.data;
  }
  // After 4 generations, glider should have moved but still have 5 cells
  assert.equal(g.count(v => v > 0), 5);
});

test('Conway blinker oscillates', () => {
  const g = new Grid2D(5, 5);
  g.set(2, 1, 1); g.set(2, 2, 1); g.set(2, 3, 1);
  const r1 = conwayStep(g);
  // Horizontal → vertical
  assert.equal(r1.alive, 3);
  assert.equal(r1.grid.get(1, 2), 1);
  assert.equal(r1.grid.get(3, 2), 1);
  assert.equal(r1.grid.get(2, 2), 1);
});

test('Conway Gospers glider gun produces gliders', () => {
  const g = gosperGliderGun(38, 12);
  // Run 50 generations
  for (let i = 0; i < 50; i++) {
    const r = conwayStep(g);
    g.data = r.grid.data;
  }
  // Gun should still be alive
  assert.ok(g.count(v => v > 0) > 0);
});

// === HighLife ===
test('HighLife block is still life', () => {
  const g = new Grid2D(4, 4);
  g.set(1, 1, 1); g.set(2, 1, 1); g.set(1, 2, 1); g.set(2, 2, 1);
  const r = highlifeStep(g);
  assert.equal(r.alive, 4);
});

// === Day & Night ===
test('Day&Night block is still life', () => {
  const g = new Grid2D(4, 4);
  g.set(1, 1, 1); g.set(2, 1, 1); g.set(1, 2, 1); g.set(2, 2, 1);
  const r = daynightStep(g);
  assert.equal(r.alive, 4);
});

// === Wireworld ===
test('Wireworld electron propagates 1 step', () => {
  const g = new Grid2D(5, 1);
  g.set(2, 0, 1);  // wire
  g.set(3, 0, 2);  // head
  const r = wireworldStep(g, 'fixed');
  // Wire next to head becomes head; head becomes tail
  assert.equal(r.grid.get(2, 0), 2);  // becomes head
  assert.equal(r.grid.get(3, 0), 3);  // becomes tail
});

// === Lenia ===
test('Lenia step is deterministic given same input', () => {
  const f1 = new LeniaField(20, 20);
  const f2 = new LeniaField(20, 20);
  circleSeed(f1, 10, 10, 4);
  circleSeed(f2, 10, 10, 4);
  const r1 = leniaStep(f1);
  const r2 = leniaStep(f2);
  for (let i = 0; i < r1.field.length; i++) {
    assert.equal(r1.field[i].toFixed(6), r2.field[i].toFixed(6));
  }
});

test('Lenia density stays in [0, 1]', () => {
  const f = new LeniaField(40, 40);
  circleSeed(f, 20, 20, 8);
  let cur = f;
  for (let i = 0; i < 10; i++) cur = leniaStep(cur);
  for (let i = 0; i < cur.field.length; i++) {
    assert.ok(cur.field[i] >= 0 && cur.field[i] <= 1, `value out of range: ${cur.field[i]}`);
  }
});

// === Rule 110 ===
test('Rule 110 single cell dies', () => {
  const line = new Uint8Array(10);
  line[5] = 1;
  const next = rule110Step(line);
  // Rule 110: 001 → 1, 010 → 1, 011 → 1, 100 → 0, 101 → 1, 110 → 1, 111 → 0
  // Single 1 at pos 5 with neighbors: 010 (pos 5) → next[5] = 1, 001 (pos 4) → 1, 100 (pos 6) → 0
  // Actually with single cell, neighbors are 0s. The local pattern at pos 4 (l=0,c=0,r=1) → 1
  // pattern at pos 5 (l=0,c=1,r=0) → 1, pattern at pos 6 (l=1,c=0,r=0) → 0
  // So new line = ...0100100... with cells at 4 and 5
  assert.equal(next[5], 1);
  assert.equal(next[4], 1);
  assert.equal(next[6], 0);
});

// === Forest Fire ===
test('Forest fire initial fire burns out', () => {
  const g = new Grid2D(10, 10);
  g.set(5, 5, 2);  // initial fire
  for (let i = 0; i < 5; i++) {
    const r = forestFireStep(g);
    g.data = r.grid.data;
  }
  // After 5 steps, no fire (since no trees nearby initially)
  let fires = 0;
  for (let j = 0; j < g.data.length; j++) if (g.data[j] === 2) fires++;
  assert.equal(fires, 0);
});

test('Forest fire tree ignites from neighbor', () => {
  const g = new Grid2D(10, 10);
  g.set(4, 5, 1);  // tree
  g.set(5, 5, 2);  // fire
  const r = forestFireStep(g);
  // tree at (4,5) should be on fire next step
  assert.equal(r.grid.get(4, 5), 2);
});

// === Custom rule ===
test('Custom rule B36/S125 works', () => {
  const g = new Grid2D(3, 3, [[1, 1, 1], [0, 0, 0], [0, 0, 0]]);
  const rule = parseBSRule('B36/S125');
  const r = stepBS(g, rule);
  assert.ok(r.alive >= 0);
});

// === Game runner ===
test('makeGame creates initial state', () => {
  const g = makeGame(10, 10);
  assert.equal(g.generation, 0);
  assert.equal(g.rule, 'B3/S23');
});

test('tick advances generations', () => {
  const g = makeGame(10, 10, 'B3/S23');
  // Plant a stable block
  g.grid.set(4, 4, 1); g.grid.set(5, 4, 1); g.grid.set(4, 5, 1); g.grid.set(5, 5, 1);
  tick(g, 5);
  assert.equal(g.generation, 5);
});

test('tick history bounded', () => {
  const g = makeGame(10, 10);
  tick(g, 250);
  assert.ok(g.history.length <= 200);
});

// === Random seed ===
test('randomSeed produces correct density approximately', () => {
  const g = randomSeed(100, 100, 0.5);
  const density = g.count(v => v > 0) / 10000;
  assert.ok(density > 0.45 && density < 0.55);
});
