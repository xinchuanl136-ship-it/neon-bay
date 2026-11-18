// The player: on foot, or behind the wheel of a car. Wanted, health, cash,
// punch and pistol all live here; the game loop calls update() every frame.
import { TUNE } from './config.js';
import { clamp, dist, wrapAngle } from './util.js';
import { moveWithCollision } from './city.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    speed: 0,
    onFoot: true,
    car: null,
    health: 100,
    cash: 0,
    wanted: 0,
    ammo: TUNE.pistolAmmo,
    punchT: 0,
    punchCooldown: 0,
    shootCooldown: 0,
    muzzle: 0,
    lastPoliceSeen: -999,
    lastDecay: 0,
    hurtT: 0,
  };
}

// Steer + drive the car the player is sitting in. Returns events for the loop.
export function driveCar(p, input, dt, city, audio) {
  const car = p.car;
  const ax = input.axisY(); // W = forward, S = brake/reverse
  const sx = input.axisX();
  if (ax < 0) car.speed += TUNE.carAccel * dt;
  else if (ax > 0) {
    if (car.speed > 5) car.speed -= TUNE.carBrake * dt;
    else car.speed -= TUNE.carAccel * 0.45 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * 260 * dt;
    if (Math.abs(car.speed) < 8) car.speed = 0;
  }
  car.speed = clamp(car.speed, -TUNE.carReverseMax, TUNE.carMaxSpeed);
  const steer = sx * TUNE.carTurn * clamp(Math.abs(car.speed) / 220, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.angle = wrapAngle(car.angle + steer * dt);
  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  const moved = moveWithCollision(city, car, dx, dy, 17);
  if (!moved && Math.abs(car.speed) > 260) {
    car.health = Math.max(0, car.health - 14);
    car.speed *= -0.25;
    audio.crash();
    p.hurtT = 0.25;
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = car.speed;
  audio.engine(true, Math.abs(car.speed) / TUNE.carMaxSpeed);
  return { crashed: !moved };
}

export function walkPlayer(p, input, dt, city) {
  const ax = input.axisX();
  const ay = input.axisY();
  const len = Math.hypot(ax, ay);
  if (len > 0) {
    const nx = ax / len;
    const ny = ay / len;
    p.angle = Math.atan2(ny, nx);
    moveWithCollision(city, p, nx * TUNE.walkSpeed * dt, ny * TUNE.walkSpeed * dt, 12);
    p.speed = TUNE.walkSpeed;
  } else {
    p.speed = 0;
  }
}

// Try to get into the nearest car. Returns {stole, gold} or null.
export function tryEnterCar(p, cars) {
  let best = null;
  let bd = 52;
  for (const c of cars) {
    if (c.isPolice) continue;
    if (c.health <= 0) continue; // A wrecked car cannot be driven.
    const d = dist(p.x, p.y, c.x, c.y);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  if (!best) return null;
  p.onFoot = false;
  p.car = best;
  best.parked = false;
  best.driver = 'player';
  const stole = best.parkedBefore === true;
  const gold = best.gold === true;
  return { stole, gold };
}

export function exitCar(p) {
  if (p.onFoot || !p.car) return;
  const car = p.car;
  car.speed = 0;
  car.parked = true;
  car.driver = null;
  // Step out to the side of the car.
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
  p.onFoot = true;
  p.car = null;
  p.speed = 0;
}

// Punch: short arc in front. Returns the pedestrians/police hit.
export function punch(p, people, dt) {
  p.punchCooldown -= dt;
  if (p.punchCooldown > 0) return [];
  p.punchCooldown = 0.35;
  p.punchT = 0.18;
  const hit = [];
  for (const person of people) {
    const d = dist(p.x, p.y, person.x, person.y);
    if (d > TUNE.punchRange + 12) continue;
    const a = Math.atan2(person.y - p.y, person.x - p.x);
    if (Math.abs(wrapAngle(a - p.angle)) > 1.1) continue;
    person.health -= TUNE.punchDamage;
    person.knocked = 1.1;
    person.kx = Math.cos(a) * 260;
    person.ky = Math.sin(a) * 260;
    hit.push(person);
  }
  return hit;
}

// Pistol: hitscan along the facing angle. Returns the person hit, if any.
export function shoot(p, people, cars) {
  if (p.ammo <= 0 || p.shootCooldown > 0) return null;
  p.ammo -= 1;
  p.shootCooldown = 0.3;
  p.muzzle = 0.09;
  let best = null;
  let bd = 460;
  for (const person of people) {
    const d = dist(p.x, p.y, person.x, person.y);
    if (d > bd) continue;
    const a = Math.atan2(person.y - p.y, person.x - p.x);
    if (Math.abs(wrapAngle(a - p.angle)) > 0.16) continue;
    bd = d;
    best = person;
  }
  if (best) {
    best.health -= TUNE.pistolDamage;
    best.knocked = 0.7;
    const a = Math.atan2(best.y - p.y, best.x - p.x);
    best.kx = Math.cos(a) * 320;
    best.ky = Math.sin(a) * 320;
  }
  return best;
}

export function addWanted(p, n) {
  p.wanted = clamp(p.wanted + n, 0, TUNE.maxWanted);
}

// Wanted fades only after the police have lost sight of the player.
export function decayWanted(p, now, policeSeePlayer) {
  if (policeSeePlayer) p.lastPoliceSeen = now;
  if (p.wanted > 0 && now - p.lastPoliceSeen > TUNE.wantedDecayDelay) {
    if (now - p.lastDecay > TUNE.wantedDecayEvery) {
      p.lastDecay = now;
      p.wanted -= 1;
    }
  }
}
