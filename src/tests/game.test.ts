import { test } from 'node:test';
import assert from 'node:assert';
import { GameEngine, newPlayer } from '../index.ts';

const rooms = [
  { id: 'cell-root', name: 'Genesis', desc: 'start', exits: { north: 'cell-bind' }, ops: ['BIND'], proof: 'GENESIS' },
  { id: 'cell-bind', name: 'Bindery', desc: 'binding room', exits: { south: 'cell-root' }, ops: ['BIND', 'LINK'], proof: '0xbind' },
];

test('engine constructor', () => {
  const e = new GameEngine({ rooms, start: 'cell-root' });
  assert.strictEqual(Object.keys(e.scene.rooms).length, 2);
});

test('enter room logs witness', () => {
  const e = new GameEngine({ rooms, start: 'cell-root' });
  const player = newPlayer();
  const result = e.enterRoom(player, 'cell-bind');
  assert.strictEqual(result.success, true);
  assert.ok(player.witnessLog.length > 0);
});

test('move through exit', () => {
  const e = new GameEngine({ rooms, start: 'cell-root' });
  const player = newPlayer();
  e.enterRoom(player, 'cell-root');
  const result = e.move(player, 'north');
  assert.strictEqual(result.newRoom?.id, 'cell-bind');
});

test('move through non-existent exit', () => {
  const e = new GameEngine({ rooms, start: 'cell-root' });
  const player = newPlayer();
  e.enterRoom(player, 'cell-root');
  const result = e.move(player, 'west');
  assert.ok(result.error);
});

test('apply op', () => {
  const e = new GameEngine({ rooms, start: 'cell-root' });
  const player = newPlayer();
  e.enterRoom(player, 'cell-root');
  const result = e.applyOp(player, 'BIND');
  assert.strictEqual(result.success, true);
});

test('apply unavailable op', () => {
  const e = new GameEngine({ rooms, start: 'cell-root' });
  const player = newPlayer();
  e.enterRoom(player, 'cell-root');
  const result = e.applyOp(player, 'FORGET');
  assert.ok(result.error);
});
