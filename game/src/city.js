// Neon Bay's city: road grid, building blocks, beach and water, palms, and the
// road graph traffic drives on. Everything is generated from a seed, so the
// same ?seed= always builds the same city.
import { WORLD, ROAD_W, STREET_X, STREET_Y, BEACH_X, WATER_X, PALETTE, PLACES } from './config.js';
import { makeRng } from './rng.js';
import { clamp } from './util.js';

export function generateCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const palms = [];
  const half = ROAD_W / 2;

  // Buildings fill every block between two streets, with a margin for sidewalks.
  for (let ix = 0; ix < STREET_X.length; ix++) {
    for (let iy = 0; iy < STREET_Y.length; iy++) {
      const x0 = STREET_X[ix] + half + 18;
      const y0 = STREET_Y[iy] + half + 18;
      const x1 = (ix + 1 < STREET_X.length ? STREET_X[ix + 1] : BEACH_X) - half - 18;
      const y1 = (iy + 1 < STREET_Y.length ? STREET_Y[iy + 1] : WORLD.h) - half - 18;
      const bw = x1 - x0;
      const bh = y1 - y0;
      if (bw < 90 || bh < 90) continue;
      // One or two buildings per block, sized to the block.
      const count = rng.chance(0.45) ? 2 : 1;
      for (let b = 0; b < count; b++) {
        const w = count === 1 ? bw * rng.range(0.45, 0.62) : bw * rng.range(0.3, 0.42);
        const h = count === 1 ? bh * rng.range(0.45, 0.62) : bh * rng.range(0.3, 0.42);
        const x = count === 1 ? x0 + (bw - w) / 2 : x0 + (b === 0 ? 0 : bw - w);
        const y = count === 1 ? y0 + (bh - h) / 2 : y0 + (b === 0 ? 0 : bh - h);
        buildings.push({
          x, y, w, h,
          roof: rng.pick(PALETTE.buildingRoof),
          tall: rng.chance(0.3),
        });
      }
    }
  }

  // Palms line the beach and dot a few blocks.
  for (let i = 0; i < 46; i++) {
    const onBeach = rng.chance(0.6);
    palms.push({
      x: onBeach ? rng.range(BEACH_X + 8, WATER_X - 8) : rng.range(120, WORLD.w - 260),
      y: onBeach ? rng.range(80, WORLD.h - 80) : rng.range(120, WORLD.h - 120),
      s: rng.range(0.8, 1.3),
    });
  }

  // Road graph: every street intersection is a node; streets are the edges.
  const nodes = [];
  for (const sx of STREET_X) {
    for (const sy of STREET_Y) {
      nodes.push({ x: sx, y: sy });
    }
  }
  const nodeAt = (x, y) => nodes.findIndex((n) => n.x === x && n.y === y);
  const neighbors = nodes.map((n) => {
    const out = [];
    for (const sx of STREET_X) {
      if (sx !== n.x && STREET_Y.includes(n.y)) {
        // Same horizontal street: nearest street on either side.
        if (Math.abs(sx - n.x) === 400) out.push(nodeAt(sx, n.y));
      }
    }
    for (const sy of STREET_Y) {
      if (sy !== n.y && STREET_X.includes(n.x)) {
        if (Math.abs(sy - n.y) === 400) out.push(nodeAt(n.x, sy));
      }
    }
    return out.filter((i) => i >= 0);
  });

  // Named places sit on the nearest intersection so missions can point at them.
  const places = {};
  for (const [key, p] of Object.entries(PLACES)) {
    const nx = STREET_X.reduce((a, b) => (Math.abs(b - p.x) < Math.abs(a - p.x) ? b : a));
    const ny = STREET_Y.reduce((a, b) => (Math.abs(b - p.y) < Math.abs(a - p.y) ? b : a));
    places[key] = { ...p, node: nodeAt(nx, ny), ix: nx, iy: ny };
  }

  return { buildings, palms, nodes, neighbors, places, rng };
}

export const isWater = (x) => x >= WATER_X;
export const isBeach = (x) => x >= BEACH_X && x < WATER_X;

// True when a circle at (x, y) with radius r hits a building, the water, or the edge.
export function hitsSolid(city, x, y, r) {
  if (x < r || y < r || x > WORLD.w - r || y > WORLD.h - r) return true;
  if (x + r >= WATER_X) return true;
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

// Slide a moving circle along solids: try the full step, then each axis alone.
export function moveWithCollision(city, pos, dx, dy, r) {
  if (!hitsSolid(city, pos.x + dx, pos.y + dy, r)) {
    pos.x += dx;
    pos.y += dy;
    return true;
  }
  if (!hitsSolid(city, pos.x + dx, pos.y, r)) {
    pos.x += dx;
    return true;
  }
  if (!hitsSolid(city, pos.x, pos.y + dy, r)) {
    pos.y += dy;
    return true;
  }
  return false;
}

// Is (x, y) on a road? Used for spawning and for keeping pedestrians off lawns.
export function onRoad(x, y) {
  const half = ROAD_W / 2;
  for (const sx of STREET_X) if (Math.abs(x - sx) < half) return true;
  for (const sy of STREET_Y) if (Math.abs(y - sy) < half) return true;
  return false;
}

export const nearestNode = (city, x, y) => {
  let best = 0;
  let bd = Infinity;
  city.nodes.forEach((n, i) => {
    const d = (n.x - x) ** 2 + (n.y - y) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
};

export const clampToWorld = (x, y, r) => ({
  x: clamp(x, r, WORLD.w - r),
  y: clamp(y, r, WORLD.h - r),
});
