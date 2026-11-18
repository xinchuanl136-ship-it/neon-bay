// Traffic cars, pedestrians, parked cars and cash pickups. The city breathing.
import { WORLD, PALETTE, PLACES } from './config.js';
import { makeRng } from './rng.js';
import { dist, wrapAngle, clamp } from './util.js';
import { nearestNode, onRoad } from './city.js';

export function makeTrafficCar(city, rng, color) {
  const node = rng.int(0, city.nodes.length - 1);
  const n = city.nodes[node];
  const nbrs = city.neighbors[node];
  const target = nbrs.length ? nbrs[rng.int(0, nbrs.length - 1)] : node;
  return {
    x: n.x, y: n.y,
    angle: Math.atan2(city.nodes[target].y - n.y, city.nodes[target].x - n.x),
    speed: rng.range(120, 185),
    node, target,
    color: color || rng.pick(PALETTE.traffic),
    parked: false,
    driver: null,
    health: 100,
    gold: false,
    isPolice: false,
  };
}

export function updateTrafficCar(c, city, dt, playerCar) {
  const t = city.nodes[c.target];
  const d = dist(c.x, c.y, t.x, t.y);
  // Slow down for the player's car ahead.
  let speed = c.speed;
  if (playerCar) {
    const pd = dist(c.x, c.y, playerCar.x, playerCar.y);
    if (pd < 70) speed = Math.min(speed, 40);
  }
  if (d < 14) {
    c.node = c.target;
    const nbrs = city.neighbors[c.node];
    const options = nbrs.filter((n) => n !== c.node);
    c.target = options.length ? options[Math.floor(Math.random() * options.length)] : c.node;
    return;
  }
  const want = Math.atan2(t.y - c.y, t.x - c.x);
  c.angle = wrapAngle(c.angle + clamp(wrapAngle(want - c.angle), -2.4 * dt, 2.4 * dt));
  c.x += Math.cos(c.angle) * speed * dt;
  c.y += Math.sin(c.angle) * speed * dt;
}

export function makePedestrian(city, rng) {
  const node = rng.int(0, city.nodes.length - 1);
  const n = city.nodes[node];
  return {
    x: n.x + rng.range(-70, 70),
    y: n.y + rng.range(-70, 70),
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(42, 66),
    target: null,
    node,
    health: 100,
    knocked: 0,
    kx: 0,
    ky: 0,
    down: 0,
    isPed: true,
    color: rng.pick(['#f4d35e', '#ee964b', '#a7c957', '#6a8eae', '#e07a5f', '#b5838d']),
  };
}

export function updatePedestrian(ped, city, dt, player, rng) {
  if (ped.knocked > 0) {
    ped.knocked -= dt;
    ped.x += ped.kx * dt;
    ped.y += ped.ky * dt;
    ped.kx *= 0.9;
    ped.ky *= 0.9;
    if (ped.health <= 0) ped.down = 3;
    return;
  }
  if (ped.down > 0) {
    ped.down -= dt;
    if (ped.down <= 0) ped.health = 100;
    return;
  }
  // Flee a fast car bearing down on them.
  const threat = player.car && Math.abs(player.car.speed) > 220;
  const pd = dist(ped.x, ped.y, player.x, player.y);
  if (threat && pd < 110) {
    const a = Math.atan2(ped.y - player.y, ped.x - player.x);
    ped.angle = a;
    ped.x += Math.cos(a) * 150 * dt;
    ped.y += Math.sin(a) * 150 * dt;
    ped.x = clamp(ped.x, 40, WORLD.w - 40);
    ped.y = clamp(ped.y, 40, WORLD.h - 40);
    return;
  }
  if (!ped.target) {
    const nbrs = city.neighbors[ped.node];
    ped.target = nbrs.length ? nbrs[Math.floor(rng.next() * nbrs.length)] : ped.node;
  }
  const t = city.nodes[ped.target];
  const d = dist(ped.x, ped.y, t.x, t.y);
  if (d < 20) {
    ped.node = ped.target;
    ped.target = null;
    return;
  }
  const want = Math.atan2(t.y - ped.y, t.x - ped.x);
  ped.angle = want;
  // Walk on the sidewalk: offset a little from the road center.
  ped.x += Math.cos(want) * ped.speed * dt;
  ped.y += Math.sin(want) * ped.speed * dt;
}

// Parked cars the player can steal, including the two mission cars.
export function makeParkedCars(city, rng) {
  const cars = [];
  const sedan = {
    ...makeTrafficCar(city, rng, '#e8e8e8'),
    x: PLACES.garage.x, y: PLACES.garage.y + 70,
    angle: 0, speed: 0, parked: true, parkedBefore: true, driver: null, health: 100,
  };
  const coupe = {
    ...makeTrafficCar(city, rng, '#f7c948'),
    x: PLACES.pier.x, y: PLACES.pier.y + 70,
    angle: Math.PI / 2, speed: 0, parked: true, parkedBefore: true, driver: null,
    health: 100, gold: true,
  };
  cars.push(sedan, coupe);
  for (let i = 0; i < 7; i++) {
    const node = rng.int(0, city.nodes.length - 1);
    const n = city.nodes[node];
    cars.push({
      ...makeTrafficCar(city, rng),
      x: n.x + rng.range(-40, 40), y: n.y + rng.range(-40, 40),
      angle: rng.range(0, Math.PI * 2), speed: 0,
      parked: true, parkedBefore: true, driver: null, health: 100,
    });
  }
  return cars;
}

export function makePickups(city, rng, count = 10) {
  const picks = [];
  for (let i = 0; i < count; i++) {
    const node = city.nodes[rng.int(0, city.nodes.length - 1)];
    picks.push({
      x: node.x + rng.range(-60, 60),
      y: node.y + rng.range(-60, 60),
      value: rng.pick([25, 25, 50, 50, 100]),
      alive: true,
      respawnT: 0,
    });
  }
  return picks;
}

export function updatePickups(picks, city, dt, rng) {
  for (const p of picks) {
    if (!p.alive) {
      p.respawnT -= dt;
      if (p.respawnT <= 0) {
        const node = city.nodes[rng.int(0, city.nodes.length - 1)];
        p.x = node.x + rng.range(-60, 60);
        p.y = node.y + rng.range(-60, 60);
        p.alive = true;
      }
    }
  }
}

// A car the player hit at speed: pedestrians get knocked down, wanted goes up.
export function checkCarHits(player, peds, dt) {
  if (!player.car || Math.abs(player.car.speed) < 150) return [];
  const hit = [];
  for (const ped of peds) {
    if (ped.down > 0 || ped.knocked > 0) continue;
    if (dist(player.car.x, player.car.y, ped.x, ped.y) < 30) {
      ped.health = 0;
      ped.knocked = 1.2;
      const a = Math.atan2(ped.y - player.car.y, ped.x - player.car.x);
      ped.kx = Math.cos(a) * 420;
      ped.ky = Math.sin(a) * 420;
      hit.push(ped);
    }
  }
  return hit;
}

export { nearestNode, onRoad };
