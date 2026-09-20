/**
 * substrate-game-engine: room/scene engine for substrate games
 */

import { Vector } from 'substrate-vectors';

export interface Room {
  id: string;
  name: string;
  desc: string;
  exits: Record<string, string>;
  ops: string[];
  proof: string;
}

export interface Player {
  id: string;
  state: Vector;
  witnessLog: string[];
  proofChain: string[];
  inventory: Map<string, any>;
  fuel: number;
  scars: number;
}

export interface Scene {
  rooms: Record<string, Room>;
  start: string;
  history: Array<{ at: number; type: string; data: any }>;
}

export class GameEngine {
  scene: Scene;
  
  constructor(opts: { rooms: Room[]; start: string }) {
    this.scene = {
      rooms: {},
      start: opts.start,
      history: [],
    };
    for (const room of opts.rooms) {
      this.scene.rooms[room.id] = room;
    }
  }
  
  enterRoom(player: Player, roomId: string): { player: Player; success: boolean; error?: string } {
    if (!this.scene.rooms[roomId]) {
      return { player, success: false, error: `Unknown room: ${roomId}` };
    }
    
    const room = this.scene.rooms[roomId];
    player.witnessLog.push(`${Date.now()} — entered ${room.id}`);
    player.proofChain.push(`0x${hashHex(roomId + Date.now())}`);
    player.fuel = Math.max(0, player.fuel - 1);
    this.scene.history.push({ at: Date.now(), type: 'enter-room', data: { player: player.id, room: roomId } });
    
    return { player, success: true };
  }
  
  exitRoom(player: Player, roomId: string, exitState: Vector): { player: Player; success: boolean } {
    player.witnessLog.push(`${Date.now()} — exited ${roomId} with state`);
    player.state = exitState;
    this.scene.history.push({ at: Date.now(), type: 'exit-room', data: { player: player.id, room: roomId, exitState } });
    return { player, success: true };
  }
  
  move(player: Player, direction: string): { player: Player; newRoom?: Room; error?: string } {
    // Get current room from last witness entry
    const lastEnter = [...player.witnessLog].reverse().find(e => e.includes('entered'));
    const currentRoomId = lastEnter?.split('entered ')[1] || this.scene.start;
    const currentRoom = this.scene.rooms[currentRoomId];
    
    if (!currentRoom) return { player, error: 'No current room' };
    const nextRoomId = currentRoom.exits[direction];
    if (!nextRoomId) return { player, error: `No exit ${direction}` };
    
    const result = this.enterRoom(player, nextRoomId);
    return { player: result.player, newRoom: this.scene.rooms[nextRoomId] };
  }
  
  applyOp(player: Player, op: string): { player: Player; success: boolean; error?: string } {
    const lastEnter = [...player.witnessLog].reverse().find(e => e.includes('entered'));
    const currentRoomId = lastEnter?.split('entered ')[1] || this.scene.start;
    const room = this.scene.rooms[currentRoomId];
    
    if (!room || !room.ops.includes(op)) {
      return { player, success: false, error: `Op ${op} not available in ${currentRoomId}` };
    }
    
    player.witnessLog.push(`${Date.now()} — ${op} executed`);
    this.scene.history.push({ at: Date.now(), type: 'op', data: { player: player.id, op, room: currentRoomId } });
    return { player, success: true };
  }
}

export function newPlayer(id?: string): Player {
  return {
    id: id || `player-${Math.random().toString(36).slice(2, 8)}`,
    state: new Vector(new Array(32).fill(0).map((_, i) => Math.sin(i))),
    witnessLog: [],
    proofChain: [],
    inventory: new Map(),
    fuel: 10,
    scars: 0,
  };
}

function hashHex(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h).toString(16).padStart(8, '0');
}
