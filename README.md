# substrate-game-engine

Room/scene engine for substrate games.

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
