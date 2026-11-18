// Three story jobs for Marisol Vega and the Harbor Crew. Each job is a chain
// of steps; finishing a job pays cash, finishing all three ends the story.
export const MISSIONS = [
  {
    id: 'job1',
    title: 'First Job',
    boss: 'Marisol Vega',
    brief: 'Get in the crew sedan at Sunset Garage and bring it to the Harbor Drop-off.',
    reward: 500,
    steps: [
      { kind: 'enter', text: 'Get in the sedan at Sunset Garage', place: 'garage' },
      { kind: 'goto', text: 'Drive the sedan to the Harbor Drop-off', place: 'harbor' },
    ],
  },
  {
    id: 'job2',
    title: 'Hot Wheels',
    boss: 'Marisol Vega',
    brief: 'Steal the gold coupe at Pier 9 and deliver it to the Chop Shop. The cops will notice.',
    reward: 1200,
    steps: [
      { kind: 'steal', text: 'Steal the gold coupe at Pier 9', place: 'pier' },
      { kind: 'goto', text: 'Deliver the coupe to the Chop Shop', place: 'chop' },
    ],
  },
  {
    id: 'job3',
    title: 'The Big One',
    boss: 'Marisol Vega',
    brief: 'Pick up the package at Café Lumen, then shake the heat and reach the Safehouse.',
    reward: 2500,
    steps: [
      { kind: 'goto', text: 'Pick up the package at Café Lumen', place: 'cafe' },
      { kind: 'goto', text: 'Reach the Safehouse — stay out of sight', place: 'safehouse' },
    ],
  },
];

export function createMissionState() {
  return { index: 0, step: 0, done: false };
}

export function currentMission(state) {
  return state.done ? null : MISSIONS[state.index];
}

export function currentStep(state) {
  const m = currentMission(state);
  return m ? m.steps[state.step] : null;
}

// Where the on-screen tracker should point right now.
export function missionTarget(state, places) {
  const step = currentStep(state);
  if (!step) return null;
  const p = places[step.place];
  return { x: p.x, y: p.y, text: step.text, place: step.place };
}

// Advance the mission state. Returns 'step' | 'mission' | 'complete' | null.
export function updateMissions(state, game) {
  const step = currentStep(state);
  if (!step) return null;
  const p = game.city.places[step.place];
  const px = game.player.x;
  const py = game.player.y;
  const near = Math.hypot(px - p.x, py - p.y) < 90;
  let done = false;
  if (step.kind === 'enter') {
    done = !game.player.onFoot && near;
  } else if (step.kind === 'steal') {
    done = !game.player.onFoot && game.player.car && game.player.car.gold === true;
  } else {
    done = near;
  }
  if (!done) return null;
  const mission = MISSIONS[state.index];
  state.step += 1;
  if (state.step >= mission.steps.length) {
    game.player.cash += mission.reward;
    state.index += 1;
    state.step = 0;
    if (state.index >= MISSIONS.length) {
      state.done = true;
      return 'complete';
    }
    return 'mission';
  }
  return 'step';
}
