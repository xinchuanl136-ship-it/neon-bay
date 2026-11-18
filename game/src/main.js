// Neon Bay: game loop, state machine, save, camera, and the glue between systems.
import { generateCity } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createPlayer, driveCar, walkPlayer, tryEnterCar, exitCar,
  punch, shoot, addWanted, decayWanted,
} from './player.js';
import {
  makeTrafficCar, makePedestrian, makeParkedCars, makePickups,
  updateTrafficCar, updatePedestrian, updatePickups, checkCarHits,
} from './traffic.js';
import { spawnPolice, updatePolice, policeCountFor, anyPoliceSees } from './police.js';
import {
  MISSIONS, createMissionState, currentMission, missionTarget, updateMissions,
} from './missions.js';
import { drawHUD, drawStart, drawPause, drawBusted, drawComplete } from './hud.js';
import { drawWorld } from './render.js';
import { applyShot } from './shots.js';
import { WORLD, PLACES, TUNE } from './config.js';
import { clamp, dist } from './util.js';

const SAVE_KEY = 'neon-bay-save-v1';

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = createInput();
    this.audio = createAudio();
    this.city = generateCity(1337);
    this.player = createPlayer(PLACES.garage.x, PLACES.garage.y + 120);
    this.missionState = createMissionState();
    this.trafficCars = [];
    this.peds = [];
    this.parkedCars = [];
    this.pickups = [];
    this.police = [];
    this.toasts = [];
    this.state = 'start';
    this.time = 0;
    this.cam = { x: this.player.x, y: this.player.y };
    this.save = loadSave();
    this.bestCash = this.save ? this.save.bestCash || 0 : 0;
    this.bustedLoss = 0;
    this.showMissions = false;
    this.muted = false;
    this.saveT = 0;
    this.dirty = false;
    this.ready = false;
  }

  get mission() {
    return currentMission(this.missionState);
  }

  get missionTarget() {
    return missionTarget(this.missionState, this.city.places);
  }

  toast(text, life = 3) {
    this.toasts.push({ text, life });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: this.player.cash,
        missionIndex: this.missionState.index,
        bestCash: Math.max(this.bestCash, this.player.cash),
      }));
      this.dirty = false;
    } catch {
      // Storage unavailable (private mode, sandbox): the game still plays.
    }
  }

  startGame(fromSave) {
    this.trafficCars = [];
    this.peds = [];
    this.police = [];
    this.toasts = [];
    const rng = this.city.rng;
    for (let i = 0; i < 12; i++) this.trafficCars.push(makeTrafficCar(this.city, rng));
    for (let i = 0; i < 22; i++) this.peds.push(makePedestrian(this.city, rng));
    this.parkedCars = makeParkedCars(this.city, rng);
    this.pickups = makePickups(this.city, rng, 10);
    this.player = createPlayer(PLACES.garage.x, PLACES.garage.y + 120);
    this.missionState = createMissionState();
    if (fromSave && this.save) {
      this.player.cash = this.save.cash || 0;
      this.missionState.index = clamp(this.save.missionIndex || 0, 0, MISSIONS.length - 1);
      this.toast(`Welcome back, Rio — job ${this.missionState.index + 1} of ${MISSIONS.length}`);
    } else {
      this.toast('Marisol Vega has work for you. Check your missions (M).');
    }
    this.cam.x = this.player.x;
    this.cam.y = this.player.y;
    this.state = 'play';
  }

  bustPlayer() {
    const loss = Math.floor(this.player.cash * TUNE.bustCashLoss);
    this.player.cash -= loss;
    this.bustedLoss = loss;
    this.player.wanted = 0;
    this.player.health = 100;
    this.police = [];
    this.audio.siren(false);
    this.audio.engine(false);
    this.audio.busted();
    if (this.player.car) {
      this.player.car.speed = 0;
      this.player.car.parked = true;
      this.player.car.driver = null;
      this.player.car = null;
      this.player.onFoot = true;
    }
    this.player.x = PLACES.hospital.x;
    this.player.y = PLACES.hospital.y + 120;
    this.cam.x = this.player.x;
    this.cam.y = this.player.y;
    this.dirty = true;
    this.state = 'busted';
  }

  update(dt, settling = false) {
    this.time += dt;
    const p = this.player;
    const input = this.input;

    if (this.state === 'play' && !settling) {
      if (input.hit('KeyP')) {
        this.state = 'pause';
        this.audio.engine(false);
        this.audio.siren(false);
      }
      if (input.hit('KeyM')) this.showMissions = !this.showMissions;
      if (input.hit('KeyN')) {
        this.muted = this.audio.toggleMute();
        this.toast(this.muted ? 'Sound off' : 'Sound on');
      }
      if (input.hit('KeyE')) {
        if (p.onFoot) {
          const res = tryEnterCar(p, this.parkedCars);
          if (res) {
            if (res.gold) {
              addWanted(p, 2);
              this.toast('You stole the gold coupe! The cops are coming.');
            } else if (res.stole) {
              addWanted(p, 1);
              this.toast('You stole a car! Wanted level up.');
            }
            this.audio.engine(true, 0);
          } else {
            this.toast('No car close enough — walk up to one and press E.');
          }
        } else {
          exitCar(p);
          this.audio.engine(false);
        }
      }
      if (input.hit('Space') && p.onFoot) {
        const hit = punch(p, this.peds, dt);
        if (hit.length) {
          this.audio.punch();
          addWanted(p, 1);
          this.toast('You hit a pedestrian! Wanted level up.');
        }
      }
      if (input.hit('KeyF')) {
        const hit = shoot(p, this.peds, this.parkedCars);
        if (hit) {
          this.audio.shot();
          addWanted(p, 1);
          this.toast('You shot someone! Wanted level up.');
        } else if (p.ammo > 0) {
          this.audio.shot();
        }
      }
    }

    if (this.state === 'play') {
      // Movement.
      if (p.onFoot) walkPlayer(p, input, dt, this.city);
      else driveCar(p, input, dt, this.city, this.audio);

      p.punchT = Math.max(0, p.punchT - dt);
      p.muzzle = Math.max(0, p.muzzle - dt);
      p.shootCooldown = Math.max(0, p.shootCooldown - dt);
      p.hurtT = Math.max(0, p.hurtT - dt);

      // Traffic, pedestrians, pickups.
      for (const c of this.trafficCars) updateTrafficCar(c, this.city, dt, p.car);
      for (const ped of this.peds) updatePedestrian(ped, this.city, dt, p, this.city.rng);
      updatePickups(this.pickups, this.city, dt, this.city.rng);
      for (const pk of this.pickups) {
        if (pk.alive && dist(p.x, p.y, pk.x, pk.y) < 28) {
          pk.alive = false;
          pk.respawnT = 25;
          p.cash += pk.value;
          this.audio.pickup();
          this.toast(`+$${pk.value}`);
          this.dirty = true;
        }
      }

      // Hitting pedestrians with the car.
      const ranOver = checkCarHits(p, this.peds, dt);
      if (ranOver.length) {
        addWanted(p, ranOver.length);
        this.audio.crash();
        this.toast('You ran someone over! Wanted level up.');
      }

      // Safehouse refills ammo, hospital heals.
      if (dist(p.x, p.y, PLACES.safehouse.x, PLACES.safehouse.y) < 100 && p.ammo < TUNE.pistolAmmo) {
        p.ammo = TUNE.pistolAmmo;
        this.toast('Ammo restocked at the Safehouse.');
      }
      if (dist(p.x, p.y, PLACES.hospital.x, PLACES.hospital.y) < 100 && p.health < 100) {
        p.health = Math.min(100, p.health + 30 * dt);
      }

      // Wrecked car: get out.
      if (p.car && p.car.health <= 0) {
        this.toast('Your car is wrecked!');
        exitCar(p);
        this.audio.engine(false);
      }

      // Police: match the wanted level, then hunt.
      const want = policeCountFor(p.wanted);
      if (want === 0 && this.police.length) {
        this.police = [];
        this.audio.siren(false);
        this.toast('You lost the cops.');
      }
      while (this.police.length < want) {
        this.police.push(...spawnPolice(this.city, 1, p));
      }
      if (this.police.length > want) this.police.length = want;
      let busted = false;
      for (const cop of this.police) {
        const ev = updatePolice(cop, this.city, dt, p, this.audio);
        if (ev && ev.busted) busted = true;
      }
      if (this.police.length) this.audio.siren(true);
      decayWanted(p, this.time, anyPoliceSees(this.police, p));

      if (busted || p.health <= 0) {
        this.bustPlayer();
      }

      // Missions.
      const ev = updateMissions(this.missionState, this);
      if (ev === 'step') {
        this.audio.pickup();
        this.toast('Step done.');
      } else if (ev === 'mission') {
        const m = MISSIONS[this.missionState.index - 1];
        this.audio.mission();
        this.toast(`Job done: ${m.title} — +$${m.reward}`);
        this.dirty = true;
      } else if (ev === 'complete') {
        const m = MISSIONS[MISSIONS.length - 1];
        this.audio.mission();
        this.toast(`All jobs done: +$${m.reward}`);
        this.bestCash = Math.max(this.bestCash, p.cash);
        this.dirty = true;
        this.state = 'complete';
      }

      // Camera follows the player.
      const tx = clamp(p.x, 640, WORLD.w - 640);
      const ty = clamp(p.y, 360, WORLD.h - 360);
      this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 5);
      this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 5);

      // Toasts + autosave.
      for (const t of this.toasts) t.life -= dt;
      this.toasts = this.toasts.filter((t) => t.life > 0);
      this.saveT += dt;
      if (this.dirty && this.saveT > 5) {
        this.saveT = 0;
        this.persist();
      }
    }

    if (this.state === 'start' && !settling) {
      if (input.hit('Space') || input.hit('Enter')) this.startGame(false);
      if (input.hit('KeyC') && this.save) this.startGame(true);
    }
    if ((this.state === 'busted' || this.state === 'complete' || this.state === 'pause') && !settling) {
      if (this.state === 'pause' && input.hit('KeyP')) this.state = 'play';
      if ((this.state === 'busted' || this.state === 'complete') && input.hit('Space')) {
        this.state = 'play';
      }
    }
  }

  draw() {
    const ctx = this.ctx;
    if (this.state === 'start') {
      drawStart(ctx, this);
      return;
    }
    drawWorld(ctx, this);
    drawHUD(ctx, this);
    if (this.showMissions && this.state === 'play') {
      const W = this.canvas.width;
      ctx.save();
      ctx.fillStyle = '#000000b8';
      ctx.fillRect(W / 2 - 260, 90, 520, 30 + MISSIONS.length * 56);
      ctx.textAlign = 'left';
      MISSIONS.forEach((m, i) => {
        const y = 122 + i * 56;
        const status = this.missionState.done || i < this.missionState.index
          ? 'DONE'
          : i === this.missionState.index ? 'ACTIVE' : 'LOCKED';
        ctx.fillStyle = status === 'ACTIVE' ? '#ffd21f' : status === 'DONE' ? '#7dff8a' : '#ffffff88';
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.fillText(`${i + 1}. ${m.title} — $${m.reward} [${status}]`, W / 2 - 240, y);
        ctx.fillStyle = '#ffffffcc';
        ctx.font = '13px system-ui, sans-serif';
        ctx.fillText(m.brief, W / 2 - 240, y + 20);
      });
      ctx.restore();
    }
    if (this.state === 'pause') drawPause(ctx, this);
    if (this.state === 'busted') drawBusted(ctx, this);
    if (this.state === 'complete') drawComplete(ctx, this);
  }

  frame(now) {
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    this.update(dt, false);
    this.draw();
    this.input.endFrame();
  }

  run() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('shot')) {
      applyShot(this, params);
      // Let traffic and police settle so the shot shows a living city.
      this.update(1 / 60, true);
    }
    const loop = (now) => {
      this.frame(now);
      if (!this.ready) {
        this.ready = true;
        window.__neonReady = true;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    this.canvas.addEventListener('click', () => {
      this.audio.unlock();
      if (this.state === 'start') this.startGame(false);
    });
    window.addEventListener('keydown', () => this.audio.unlock(), { once: true });
  }
}

const canvas = document.getElementById('game');
const game = new Game(canvas);
window.__game = game; // Debug hook: lets a probe read live state (player, camera).
game.run();
