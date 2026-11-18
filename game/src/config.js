// Neon Bay tuning and palette. One place for every number the game balances on.
export const WORLD = { w: 3200, h: 2400 };

export const ROAD_W = 96;
// Vertical streets (x) and horizontal streets (y). The grid the whole city hangs on.
export const STREET_X = [200, 600, 1000, 1400, 1800, 2200, 2600, 2920];
export const STREET_Y = [200, 600, 1000, 1400, 1800, 2200];

// East edge: sand, then open water. Both are outside the drivable city.
export const BEACH_X = 2980;
export const WATER_X = 3090;

export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#74a24f',
  road: '#3c3f46',
  roadEdge: '#2e3138',
  lane: '#e8d44f',
  sidewalk: '#b9b3a4',
  sand: '#e8d8a0',
  water: '#2e7fb8',
  waterDeep: '#256b9e',
  buildingRoof: ['#c96f4a', '#4a7fc9', '#c9a44a', '#7a4a9e', '#4a9e7f', '#b84a5e', '#8a6f4a'],
  buildingEdge: '#00000033',
  palm: '#2f7d3a',
  player: '#ff5fa2',
  police: '#2f6df6',
  traffic: ['#d8d8d8', '#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22'],
  gold: '#f7c948',
};

export const TUNE = {
  walkSpeed: 250,
  carAccel: 780,
  carBrake: 1400,
  carMaxSpeed: 640,
  carReverseMax: 220,
  carTurn: 2.6,
  punchRange: 46,
  punchDamage: 34,
  pistolDamage: 55,
  pistolAmmo: 12,
  maxWanted: 5,
  maxPolice: 3,
  bustSeconds: 1.2,
  bustCashLoss: 0.2,
  wantedDecayDelay: 6,
  wantedDecayEvery: 4,
};

// Named places the missions and the minimap point at.
export const PLACES = {
  garage: { name: 'Sunset Garage', x: 600, y: 1000 },
  pier: { name: 'Pier 9', x: 3010, y: 600 },
  harbor: { name: 'Harbor Drop-off', x: 1400, y: 2200 },
  chop: { name: 'Chop Shop', x: 200, y: 1800 },
  cafe: { name: 'Café Lumen', x: 1800, y: 1000 },
  safehouse: { name: 'Safehouse', x: 2600, y: 1400 },
  hospital: { name: 'Bay General', x: 1000, y: 200 },
};
