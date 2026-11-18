// Screenshot staging: ?shot= sets up a scene so the four entry screenshots
// each show a different system at work. The game itself never depends on this.
import { PLACES } from './config.js';
import { spawnPolice } from './police.js';

function settle(game, ticks = 100) {
  for (let i = 0; i < ticks; i++) game.update(1 / 60, true);
}

export function applyShot(game, params) {
  const shot = params.get('shot') || 'play';
  const start = () => game.startGame(false);
  if (shot === 'start') {
    game.state = 'start';
    return 'start';
  }
  if (shot === 'city') {
    start();
    // On foot in the middle of town, traffic already moving.
    game.player.x = 1400;
    game.player.y = 1000;
    game.player.onFoot = true;
    settle(game, 150);
    return 'city';
  }
  if (shot === 'chase') {
    start();
    // Driving with a 3-star wanted level and two police closing in.
    const car = game.parkedCars[0];
    game.player.x = car.x;
    game.player.y = car.y;
    game.player.onFoot = false;
    game.player.car = car;
    car.parked = false;
    car.driver = 'player';
    car.speed = 320;
    car.angle = 0;
    game.player.wanted = 3;
    game.police = spawnPolice(game.city, 2, game.player);
    game.police[0].x = game.player.x - 260;
    game.police[0].y = game.player.y - 80;
    game.police[1].x = game.player.x - 180;
    game.police[1].y = game.player.y + 140;
    settle(game, 40);
    return 'chase';
  }
  if (shot === 'mission') {
    start();
    // Job 2 in progress: the gold coupe, headed for the Chop Shop.
    game.missionState.index = 1;
    game.missionState.step = 1;
    const gold = game.parkedCars.find((c) => c.gold);
    game.player.x = gold.x;
    game.player.y = gold.y;
    game.player.onFoot = false;
    game.player.car = gold;
    gold.parked = false;
    gold.driver = 'player';
    gold.speed = 300;
    gold.angle = Math.PI;
    game.player.wanted = 2;
    game.police = spawnPolice(game.city, 1, game.player);
    settle(game, 40);
    return 'mission';
  }
  start();
  return 'play';
}
