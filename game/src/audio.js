// Synthesized WebAudio: no sound files, everything is oscillators and noise.
// Audio only starts after the first user gesture (browser autoplay policy).
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let muted = false;

  const ensure = () => {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      return true;
    } catch {
      return false;
    }
  };

  const beep = (freq, dur, type = 'sine', vol = 0.12) => {
    if (!ensure() || muted || ctx.state === 'suspended') return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + dur);
  };

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    // Engine hum follows the driven car's speed (0..1).
    engine(on, speed01) {
      if (!ensure() || muted) return;
      if (ctx.state === 'suspended') return;
      if (on && !engineOsc) {
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 60;
        engineGain.gain.value = 0.0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(ctx.destination);
        engineOsc.start();
      }
      if (!on && engineOsc) {
        engineOsc.stop();
        engineOsc = null;
        engineGain = null;
        return;
      }
      if (engineOsc) {
        engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.08);
        engineGain.gain.setTargetAtTime(0.015 + speed01 * 0.05, ctx.currentTime, 0.08);
      }
    },
    siren(on) {
      if (!ensure() || muted) return;
      if (ctx.state === 'suspended') return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenGain = ctx.createGain();
        sirenOsc.type = 'triangle';
        sirenOsc.frequency.value = 700;
        sirenGain.gain.value = 0.02;
        sirenLfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        sirenLfo.frequency.value = 0.9;
        lfoGain.gain.value = 260;
        sirenLfo.connect(lfoGain);
        lfoGain.connect(sirenOsc.frequency);
        sirenOsc.connect(sirenGain);
        sirenGain.connect(ctx.destination);
        sirenOsc.start();
        sirenLfo.start();
      }
      if (!on && sirenOsc) {
        sirenOsc.stop();
        sirenLfo.stop();
        sirenOsc = null;
        sirenLfo = null;
        sirenGain = null;
      }
    },
    pickup() {
      beep(880, 0.12, 'sine', 0.14);
      setTimeout(() => beep(1318, 0.16, 'sine', 0.12), 70);
    },
    punch() {
      beep(140, 0.1, 'square', 0.16);
    },
    shot() {
      beep(190, 0.09, 'sawtooth', 0.2);
      beep(90, 0.14, 'square', 0.14);
    },
    crash() {
      beep(70, 0.25, 'sawtooth', 0.2);
    },
    mission() {
      beep(523, 0.14, 'sine', 0.14);
      setTimeout(() => beep(659, 0.14, 'sine', 0.14), 120);
      setTimeout(() => beep(784, 0.22, 'sine', 0.14), 240);
    },
    busted() {
      beep(392, 0.3, 'triangle', 0.16);
      setTimeout(() => beep(311, 0.5, 'triangle', 0.16), 260);
    },
    toggleMute() {
      muted = !muted;
      if (muted) {
        this.engine(false);
        this.siren(false);
      }
      return muted;
    },
  };
}
