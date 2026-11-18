// The police: up to three cars that hunt the player along the road graph,
// ram the player's car, and bust the player on foot.
import { WORLD, TUNE, PALETTE } from './config.js';
import { dist, wrapAngle, clamp } from './util.js';
import { nearestNode } from './city.js';

// Breadth-first route over the intersection graph, from `from` node to `to` node.
function bfsRoute(city, from, to) {
  if (from === to) return [to];
  const prev = new Array(city.nodes.length).fill(-1);
  const queue = [from];
  prev[from] = from;
  while (queue.length) {
    const cur = queue.shift();
    for (const nb of city.neighbors[cur]) {
      if (prev[nb] !== -1) continue;
      prev[nb] = cur;
      if (nb === to) {
        const path = [to];
        let n = to;
        while (n !== from) {
          n = prev[n];
          path.unshift(n);
        }
        return path;
      }
      queue.push(nb);
    }
  }
  return [to];
}

export function makePoliceCar(city, x, y) {
  return {
    x, y,
    angle: 0,
    speed: 0,
    color: PALETTE.police,
    health: 100,
    isPolice: true,
    parked: false,
    driver: 'police',
    route: [],
    routeIdx: 0,
    ramCooldown: 0,
    bustT: 0,
    flashT: 0,
  };
}

export function spawnPolice(city, count, player) {
  const cars = [];
  const edges = [
    { x: 120, y: 120 },
    { x: WORLD.w - 160, y: 120 },
    { x: 120, y: WORLD.h - 120 },
    { x: WORLD.w - 160, y: WORLD.h - 120 },
  ];
  for (let i = 0; i < count; i++) {
    const e = edges[i % edges.length];
    const car = makePoliceCar(city, e.x, e.y);
    car.route = bfsRoute(city, nearestNode(city, e.x, e.y), nearestNode(city, player.x, player.y));
    car.routeIdx = 0;
    cars.push(car);
  }
  return cars;
}

export function updatePolice(car, city, dt, player, audio) {
  car.flashT += dt;
  car.ramCooldown -= dt;
  const pd = dist(car.x, car.y, player.x, player.y);
  const maxSpeed = 560;

  if (pd < 170) {
    // Close in: steer straight at the player.
    const want = Math.atan2(player.y - car.y, player.x - car.x);
    car.angle = wrapAngle(car.angle + clamp(wrapAngle(want - car.angle), -3.2 * dt, 3.2 * dt));
    car.speed = Math.min(car.speed + 620 * dt, maxSpeed);
  } else {
    // Far: follow the road graph toward the player's nearest node.
    const targetNode = nearestNode(city, player.x, player.y);
    const myNode = nearestNode(city, car.x, car.y);
    if (car.routeIdx >= car.route.length || car.route[car.route.length - 1] !== targetNode) {
      car.route = bfsRoute(city, myNode, targetNode);
      car.routeIdx = 0;
    }
    const wp = city.nodes[car.route[Math.min(car.routeIdx, car.route.length - 1)]];
    if (wp && dist(car.x, car.y, wp.x, wp.y) < 26) car.routeIdx += 1;
    if (wp) {
      const want = Math.atan2(wp.y - car.y, wp.x - car.x);
      car.angle = wrapAngle(car.angle + clamp(wrapAngle(want - car.angle), -3.0 * dt, 3.0 * dt));
      car.speed = Math.min(car.speed + 560 * dt, maxSpeed * 0.92);
    }
  }

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 30, WORLD.w - 30);
  car.y = clamp(car.y, 30, WORLD.h - 30);

  // Ram the player's car on contact.
  if (player.car && pd < 34 && car.ramCooldown <= 0) {
    car.ramCooldown = 0.9;
    player.car.health = Math.max(0, player.car.health - 12);
    player.health = Math.max(0, player.health - 4);
    player.car.speed *= 0.55;
    audio.crash();
    return { rammed: true };
  }
  // Bust the player on foot after standing close for a moment.
  if (player.onFoot && pd < 46) {
    car.bustT += dt;
    if (car.bustT >= TUNE.bustSeconds) return { busted: true };
  } else {
    car.bustT = Math.max(0, car.bustT - dt * 2);
  }
  return null;
}

// How many police the wanted level calls for, and whether any can see the player.
export function policeCountFor(wanted) {
  return Math.min(wanted >= 4 ? 3 : wanted >= 2 ? 2 : wanted >= 1 ? 1 : 0, TUNE.maxPolice);
}

export function anyPoliceSees(police, player) {
  for (const c of police) {
    if (dist(c.x, c.y, player.x, player.y) < 520) return true;
  }
  return false;
}
