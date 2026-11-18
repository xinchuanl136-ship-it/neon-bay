// HUD, minimap, toasts and the full-screen states: start, pause, busted, complete.
import { WORLD, PALETTE } from './config.js';
import { clamp } from './util.js';

function stars(ctx, x, y, wanted, max = 5) {
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < max; i++) {
    ctx.fillStyle = i < wanted ? '#ffd21f' : '#ffffff44';
    ctx.fillText('★', x + i * 26, y);
  }
}

function bar(ctx, x, y, w, h, frac, color, bg = '#00000088') {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}

export function drawMinimap(ctx, game) {
  const mw = 200;
  const mh = 150;
  const x0 = game.canvas.width - mw - 16;
  const y0 = 16;
  const sx = mw / WORLD.w;
  const sy = mh / WORLD.h;
  ctx.save();
  ctx.fillStyle = '#10141acc';
  ctx.fillRect(x0 - 4, y0 - 4, mw + 8, mh + 8);
  ctx.fillStyle = '#243024';
  ctx.fillRect(x0, y0, mw, mh);
  // Water on the east edge.
  ctx.fillStyle = '#2e7fb8';
  ctx.fillRect(x0 + (3090 * sx), y0, mw - 3090 * sx, mh);
  // Roads.
  ctx.strokeStyle = '#5a5e66';
  ctx.lineWidth = 3;
  for (const gx of game.city.nodes.map((n) => n.x).filter((v, i, a) => a.indexOf(v) === i)) {
    ctx.beginPath();
    ctx.moveTo(x0 + gx * sx, y0);
    ctx.lineTo(x0 + gx * sx, y0 + mh);
    ctx.stroke();
  }
  for (const gy of game.city.nodes.map((n) => n.y).filter((v, i, a) => a.indexOf(v) === i)) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + gy * sy);
    ctx.lineTo(x0 + mw, y0 + gy * sy);
    ctx.stroke();
  }
  const dot = (wx, wy, color, r = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + wx * sx, y0 + wy * sy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  const target = game.missionTarget;
  if (target) {
    const pulse = 4 + Math.sin(game.time * 4) * 1.5;
    dot(target.x, target.y, '#ffd21f', pulse);
  }
  for (const c of game.police) dot(c.x, c.y, '#3f8cff', 3.5);
  dot(game.player.x, game.player.y, '#ff5fa2', 4);
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('NEON BAY', x0 + mw, y0 + mh + 18);
}

export function drawHUD(ctx, game) {
  const p = game.player;
  const W = game.canvas.width;
  ctx.save();
  // Cash + wanted, top left.
  ctx.fillStyle = '#00000066';
  ctx.fillRect(12, 12, 250, 64);
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`$${p.cash}`, 24, 34);
  stars(ctx, 24, 62, p.wanted);

  // Objective banner, top center.
  if (game.missionTarget) {
    const m = game.mission;
    const d = Math.round(Math.hypot(p.x - game.missionTarget.x, p.y - game.missionTarget.y));
    ctx.fillStyle = '#00000066';
    const tw = 560;
    ctx.fillRect(W / 2 - tw / 2, 12, tw, 52);
    ctx.fillStyle = '#ffd21f';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${m.title}: ${game.missionTarget.text}`, W / 2, 32);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`${d}m`, W / 2, 52);
  }

  // Health / car health / ammo, bottom left.
  ctx.fillStyle = '#00000066';
  ctx.fillRect(12, game.canvas.height - 66, 260, 54);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(p.onFoot ? 'HEALTH' : 'CAR', 22, game.canvas.height - 52);
  bar(ctx, 76, game.canvas.height - 58, 180, 12, (p.onFoot ? p.health : (p.car ? p.car.health : 100)) / 100, p.onFoot ? '#ff5f6d' : '#ffb02e');
  ctx.fillText(`AMMO ${p.ammo}`, 22, game.canvas.height - 28);

  drawMinimap(ctx, game);

  // Toasts under the objective.
  ctx.textAlign = 'center';
  game.toasts.forEach((t, i) => {
    ctx.globalAlpha = clamp(t.life, 0, 1);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(t.text, W / 2, 84 + i * 24);
  });
  ctx.globalAlpha = 1;

  // Hints, bottom center.
  ctx.fillStyle = '#ffffffcc';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(
    p.onFoot
      ? 'WASD — move · E — get in car · Space — punch · F — pistol · M — missions · P — pause'
      : 'WASD — drive · E — get out · Space — punch · F — pistol · M — missions · P — pause',
    W / 2,
    game.canvas.height - 14,
  );
  ctx.restore();
}

function overlay(ctx, game, title, lines, accent) {
  const W = game.canvas.width;
  const H = game.canvas.height;
  ctx.save();
  ctx.fillStyle = '#0a0e1acc';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(title, W / 2, H / 2 - 90);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px system-ui, sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, W / 2, H / 2 - 30 + i * 30));
  ctx.restore();
}

export function drawStart(ctx, game) {
  const W = game.canvas.width;
  const H = game.canvas.height;
  ctx.save();
  ctx.fillStyle = '#0d1526';
  ctx.fillRect(0, 0, W, H);
  // Sun glow behind the title.
  const g = ctx.createRadialGradient(W / 2, H / 2 - 110, 10, W / 2, H / 2 - 110, 260);
  g.addColorStop(0, '#ff9a3d88');
  g.addColorStop(1, '#ff9a3d00');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5fa2';
  ctx.font = 'bold 92px system-ui, sans-serif';
  ctx.fillText('NEON BAY', W / 2, H / 2 - 110);
  ctx.fillStyle = '#ffd21f';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('An original open-world crime game', W / 2, H / 2 - 66);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = '17px system-ui, sans-serif';
  const story = [
    'You are Rio, new in Neon Bay. Marisol Vega of the Harbor Crew has work for you:',
    'steal cars, dodge the cops, run the jobs — and get paid.',
    '',
    'WASD move / drive · E enter & exit cars · Space punch · F pistol',
    'M missions · P pause · N mute sound',
    '',
  ];
  story.forEach((line, i) => ctx.fillText(line, W / 2, H / 2 - 20 + i * 26));
  if (game.save) {
    ctx.fillStyle = '#7dff8a';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`Save found: $${game.save.cash} · job ${game.save.missionIndex + 1} of 3 — press C to continue`, W / 2, H / 2 + 132);
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  const blink = Math.sin(game.time * 3) > 0;
  if (blink) ctx.fillText('Press Space or click to start', W / 2, H / 2 + 172);
  if (game.bestCash > 0) {
    ctx.fillStyle = '#ffffff99';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(`Best cash: $${game.bestCash}`, W / 2, H / 2 + 204);
  }
  ctx.restore();
}

export function drawPause(ctx, game) {
  overlay(ctx, game, 'PAUSED', ['Press P to keep playing', 'M — mute sound'], '#ffffff');
}

export function drawBusted(ctx, game) {
  overlay(
    ctx, game, 'BUSTED', [
      `The cops caught you. You lost $${game.bustedLoss}.`,
      'Press Space to wake up at Bay General',
    ], '#ff5f6d',
  );
}

export function drawComplete(ctx, game) {
  overlay(
    ctx, game, 'STORY COMPLETE', [
      `You ran all three jobs for the Harbor Crew and banked $${game.player.cash}.`,
      'Neon Bay is yours. Press Space to play on in free roam.',
    ], '#7dff8a',
  );
}
