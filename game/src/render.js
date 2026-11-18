// Everything the player sees: ground, roads, buildings, beach, cars, people,
// pickups and effects, drawn in world space under the camera transform.
import { WORLD, ROAD_W, STREET_X, STREET_Y, BEACH_X, WATER_X, PALETTE } from './config.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGround(ctx, city, cam, vw, vh, time) {
  const x0 = Math.max(0, cam.x - vw / 2 - 60);
  const y0 = Math.max(0, cam.y - vh / 2 - 60);
  const x1 = Math.min(WORLD.w, cam.x + vw / 2 + 60);
  const y1 = Math.min(WORLD.h, cam.y + vh / 2 + 60);
  // Grass with a mown checker.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.fillStyle = PALETTE.grassDark;
  const cell = 200;
  for (let gx = Math.floor(x0 / cell); gx * cell < x1; gx++) {
    for (let gy = Math.floor(y0 / cell); gy * cell < y1; gy++) {
      if ((gx + gy) % 2 === 0) ctx.fillRect(gx * cell, gy * cell, cell, cell);
    }
  }
  // Sand, then water with a slow wave shimmer.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(Math.max(x0, BEACH_X), y0, Math.min(x1, WATER_X) - Math.max(x0, BEACH_X), y1 - y0);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(Math.max(x0, WATER_X), y0, x1 - Math.max(x0, WATER_X), y1 - y0);
  ctx.strokeStyle = '#ffffff33';
  ctx.lineWidth = 2;
  for (let wy = Math.floor(y0 / 90) * 90; wy < y1; wy += 90) {
    const off = Math.sin(time * 0.7 + wy * 0.02) * 8;
    ctx.beginPath();
    ctx.moveTo(Math.max(x0, WATER_X) + 6, wy + off);
    ctx.lineTo(x1, wy + off);
    ctx.stroke();
  }
  // Roads: sidewalk border, asphalt, edge lines, center dashes.
  const half = ROAD_W / 2;
  ctx.fillStyle = PALETTE.sidewalk;
  for (const sx of STREET_X) ctx.fillRect(sx - half - 10, y0, ROAD_W + 20, y1 - y0);
  for (const sy of STREET_Y) ctx.fillRect(x0, sy - half - 10, x1 - x0, ROAD_W + 20);
  ctx.fillStyle = PALETTE.road;
  for (const sx of STREET_X) ctx.fillRect(sx - half, y0, ROAD_W, y1 - y0);
  for (const sy of STREET_Y) ctx.fillRect(x0, sy - half, x1 - x0, ROAD_W);
  ctx.strokeStyle = PALETTE.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (const sx of STREET_X) {
    ctx.beginPath();
    ctx.moveTo(sx, y0);
    ctx.lineTo(sx, y1);
    ctx.stroke();
  }
  for (const sy of STREET_Y) {
    ctx.beginPath();
    ctx.moveTo(x0, sy);
    ctx.lineTo(x1, sy);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawBuildings(ctx, city, cam, vw, vh) {
  const x0 = cam.x - vw / 2 - 80;
  const y0 = cam.y - vh / 2 - 80;
  const x1 = cam.x + vw / 2 + 80;
  const y1 = cam.y + vh / 2 + 80;
  for (const b of city.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    ctx.fillStyle = '#00000030';
    ctx.fillRect(b.x + 5, b.y + 7, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = PALETTE.buildingEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // Rooftop detail: a darker inset, and windows on tall blocks.
    ctx.fillStyle = '#00000022';
    ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
    if (b.tall) {
      ctx.fillStyle = '#ffffff2e';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          ctx.fillRect(b.x + 14 + i * 34, b.y + 14 + j * 34, 14, 10);
        }
      }
    }
  }
  // Named-place markers: a gold ring where the jobs point.
  for (const [key, p] of Object.entries(city.places)) {
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
    ctx.strokeStyle = '#ffd21f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#000000aa';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const label = p.name;
    const w = ctx.measureText(label).width + 12;
    ctx.fillRect(p.x - w / 2, p.y - 52, w, 20);
    ctx.fillStyle = '#ffd21f';
    ctx.fillText(label, p.x, p.y - 38);
  }
  // Palms.
  for (const palm of city.palms) {
    if (palm.x < x0 || palm.x > x1 || palm.y < y0 || palm.y > y1) continue;
    ctx.strokeStyle = '#6b4a2f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.lineTo(palm.x + 4 * palm.s, palm.y - 12 * palm.s);
    ctx.stroke();
    ctx.fillStyle = PALETTE.palm;
    ctx.beginPath();
    ctx.arc(palm.x + 4 * palm.s, palm.y - 14 * palm.s, 10 * palm.s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCar(ctx, car, time, isPlayer) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = '#00000033';
  rr(ctx, -21, -11 + 3, 44, 24, 8);
  ctx.fill();
  ctx.fillStyle = car.color;
  rr(ctx, -22, -12, 44, 24, 8);
  ctx.fill();
  // Windshield + rear window.
  ctx.fillStyle = '#1c2b3acc';
  rr(ctx, 2, -10, 10, 20, 3);
  ctx.fill();
  rr(ctx, -16, -10, 7, 20, 3);
  ctx.fill();
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(20, -10, 3, 5);
  ctx.fillRect(20, 5, 3, 5);
  if (isPlayer) {
    ctx.strokeStyle = '#ff5fa2';
    ctx.lineWidth = 2.5;
    rr(ctx, -23, -13, 46, 26, 9);
    ctx.stroke();
  }
  if (car.isPolice) {
    const on = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = on ? '#ff2e2e' : '#2e7dff';
    ctx.fillRect(-4, -13, 8, 5);
    ctx.fillStyle = on ? '#2e7dff' : '#ff2e2e';
    ctx.fillRect(-4, 8, 8, 5);
  }
  ctx.restore();
}

export function drawWorld(ctx, game) {
  const { city, cam, time } = game;
  const vw = game.canvas.width;
  const vh = game.canvas.height;
  ctx.save();
  ctx.translate(vw / 2 - cam.x, vh / 2 - cam.y);
  drawGround(ctx, city, cam, vw, vh, time);
  drawBuildings(ctx, city, cam, vw, vh);

  // Cash pickups.
  for (const pk of game.pickups) {
    if (!pk.alive) continue;
    ctx.fillStyle = '#1f9d4d';
    ctx.beginPath();
    ctx.arc(pk.x, pk.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', pk.x, pk.y + 1);
  }

  // Parked + traffic cars.
  for (const c of game.parkedCars) drawCar(ctx, c, time, false);
  for (const c of game.trafficCars) drawCar(ctx, c, time, false);
  for (const c of game.police) drawCar(ctx, c, time, false);

  // Pedestrians.
  for (const ped of game.peds) {
    ctx.fillStyle = ped.down > 0 ? '#888888' : ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, ped.down > 0 ? 10 : 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222222';
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 5, ped.y + Math.sin(ped.angle) * 5, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // The player: a car outline when driving, a walker on foot.
  const p = game.player;
  if (p.onFoot) {
    ctx.fillStyle = '#00000033';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 8, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 16, p.y + Math.sin(p.angle) * 16);
    ctx.stroke();
    // Punch arc.
    if (p.punchT > 0) {
      ctx.strokeStyle = '#ffffffcc';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 34, p.angle - 0.7, p.angle + 0.7);
      ctx.stroke();
    }
    // Muzzle flash.
    if (p.muzzle > 0) {
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (p.car) {
    drawCar(ctx, p.car, time, true);
  }

  // Mission target beacon.
  const target = game.missionTarget;
  if (target) {
    const pulse = 30 + Math.sin(time * 5) * 6;
    ctx.strokeStyle = '#ffd21f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(target.x, target.y, pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd21f';
    ctx.beginPath();
    ctx.arc(target.x, target.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}
