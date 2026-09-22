# substrate-game-engine

**Room/scene engine for substrate games.** Each room is a cell, each transition is a witness-log entry, each opcode application is hash-chained.

## What this is

A game engine where:
- **Rooms** are cells (BIND opcode creates them)
- **Movement** between rooms is a witness-log entry (LINK opcode)
- **Player actions** are opcodes (BIND/LINK/EFFECT/VIEW/TICK/ATTEST/CONTEST/etc.)
- **State changes** are prev_hash-chained (EFFECT opcode)
- **Player proofs** are the witness-log (the entire play history is auditable)

This makes every game **deterministic and replayable** — given the same player inputs and the same room seed, you get the same game state.

## Usage

```typescript
import { GameEngine, newPlayer } from 'substrate-game-engine';

const engine = new GameEngine({
  rooms: [
    { id: 'cell-root', name: 'Genesis', desc: 'start', exits: { north: 'cell-bind' }, ops: ['BIND'], proof: 'GENESIS' },
  ],
  start: 'cell-root',
});

const player = newPlayer();
engine.enterRoom(player, 'cell-root');
engine.move(player, 'north');
engine.applyOp(player, 'BIND');
// player.witnessLog has all the actions
// player.proofChain has the hashes
```

## Why this is interesting

Most game engines treat state as opaque (e.g., `state.player.health = 100`). The substrate-game-engine treats state as **witness-log entries**: every state change has a hash chain, an opcode, a source, a timestamp, and an attestation.

This means:
- **Replay is deterministic**: re-running the witness-log produces the same state
- **Save states are just hashes**: state can be checkpointed as a single hash
- **Anti-cheat is structural**: forged witness entries break the hash chain
- **Educational**: every game action is a teachable substrate primitive

## Architecture

```
       ┌─────────────────────────────────────┐
       │           GameEngine                │
       │                                      │
       │  ┌──────────────┐  ┌──────────────┐ │
       │  │    Rooms     │  │   Players    │ │
       │  │  (cells)     │  │ (witness-log)│ │
       │  └──────┬───────┘  └──────┬───────┘ │
       │         │                 │         │
       │         └────────┬────────┘         │
       │                  ▼                  │
       │         ┌────────────────┐          │
       │         │   Opcode Bus   │          │
       │         │ (11 opcodes)   │          │
       │         └────────┬───────┘          │
       │                  │                  │
       │                  ▼                  │
       │         ┌────────────────┐          │
       │         │ Witness Chain  │          │
       │         │ (prev_hash)    │          │
       │         └────────────────┘          │
       └─────────────────────────────────────┘
```

## The 11 opcodes in gameplay

| Opcode | Game use |
|---|---|
| **BIND** | Player joins a room / a new entity is created |
| **LINK** | Player moves between rooms |
| **EFFECT** | Player changes state (e.g., opens chest) |
| **VIEW** | Player observes a room / object |
| **TICK** | Time advances (turn-based games) |
| **ATTEST** | Player witnesses an event (e.g., I saw the key) |
| **DELEGATE** | Player gives an item to an NPC |
| **CONTEST** | Player challenges an NPC's claim |
| **MERGER** | Two players combine items |
| **REVOKE** | Player takes back delegated authority |
| **WITHDRAW** | Player retracts an attestation |

## In the substrate

The substrate-game-engine is the runtime for substrate games, including:
- **cargo-line-tycoon**: the canonical game (shipping empire simulation)
- **Midden** (planned): a warehouse-management game
- Custom games built by users of the substrate

## License

MIT
