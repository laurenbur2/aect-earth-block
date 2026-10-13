/**
 * AECT CEB (Compressed Earth Block) house-build calculator. Browser copy of research/calculator.js.
 *
 * Faithful re-implementation of the SpreadsheetConverter-hosted Excel workbook
 * "CEB block number calculator_house build_2022_rev1" embedded at
 * aectearthblock.com/ceb-calculator. Every constant and lookup table below was
 * copied verbatim from the compiled formulas in that page's assets/js/app.min.js.
 * Cell references (e.g. B14, F86) refer to sheet 1 of the original workbook.
 *
 * calculate(inputs) is a pure function. Unset inputs behave like the original
 * "select" / "N/A" / "volunteer" dropdown choices, which the sheet treats as 0
 * (or as a failed lookup for text keys).
 */

// ---------- Lookup tables (verbatim) ----------

/** External wall width (in) -> block size (sheet range BJ36:BK43). */
const BLOCK_SIZE_BY_WALL_WIDTH = {
  7: '7" x 14" holey, interlocking',
  8: '8" x 14"',
  10: '10" x 14"',
  12: '6" x 12"',
  14: '10" x 14"',
  18: '6" x 12"',
  20: '10" x 14"',
};

/** Block volume in cubic feet (A18:B24): width_ft * length_ft * height_ft, with the sheet's own rounded constants. */
const BLOCK_VOLUME_CUFT = {
  '4" x 12"': 0.333 * 1 * 0.33333,
  '6" x 12"': 0.5 * 1 * 0.3333,
  '7" x 14"': 0.583333 * 1.166666 * 0.33333,
  '7" x 14" holey, interlocking': 0.583333 * 1.166666 * 0.33333,
  '8" x 14"': 0.6666666 * 1.166666 * 0.33333,
  '10" x 14"': 0.8333333 * 1.1666666 * 0.333333,
};

/** AECT price per purchased (cement-stabilized) block, keyed by block size (C3:C9 / J3:J9). */
const AECT_BLOCK_PRICE = {
  '4" x 12"': 2.75,
  '6" x 12"': 3.1,
  '7" x 14"': 3.25,
  '7" x 14" holey, interlocking': 3.5,
  '8" x 14"': 3.35,
  '10" x 14"': 3.5,
};

/** Machine -> rated blocks/hr and purchase price (F3:F11, H3:H11, I3:I11). */
// NOTE: the 2022 spreadsheet had $39k / $79k / $59k and BP714 at 200 blocks/hr.
// Updated to the prices and output listed on the live site (Oct 2026). Confirm with AECT before launch.
const MACHINES = {
  'AECT Impact 2001A': { blocksPerHour: 300, price: 59000 },
  'AECT 3500': { blocksPerHour: 480, price: 149000 },
  'AECT BP714': { blocksPerHour: 240, price: 69625 },
  'AECT 2500HD': { blocksPerHour: 480, price: 89000 },
};

/** Threshold of EXTERNAL block count used to choose the machine (sheet 2, D30). */
const MACHINE_BLOCK_THRESHOLD = 30000;

/**
 * Machine required, by external block size and whether external block count > 30,000
 * (sheet 2, C32:G43; first matching row wins).
 */
const MACHINE_BY_BLOCK_SIZE = {
  '4" x 12"': { over: 'AECT Impact 2001A', atOrUnder: 'AECT Impact 2001A' },
  '6" x 12"': { over: 'AECT 2500HD', atOrUnder: 'AECT Impact 2001A' },
  '7" x 14"': { over: 'AECT 3500', atOrUnder: 'AECT 3500' },
  '7" x 14" holey, interlocking': { over: 'AECT BP714', atOrUnder: 'AECT BP714' },
  '8" x 14"': { over: 'AECT 3500', atOrUnder: 'AECT 3500' },
  '10" x 14"': { over: 'AECT 3500', atOrUnder: 'AECT 3500' },
};

/** Internal wall width (in) produced by each machine (BJ22:BK26). */
const INTERNAL_WALL_WIDTH_BY_MACHINE = {
  'AECT Impact 2001A': 12,
  'AECT 2500HD': 12,
  'AECT 3500': 8,
  'AECT BP714': 7,
};

/**
 * Internal block size by (machine, internal wall width) (sheet 2, B64:G78; first match wins).
 * Because the internal width always comes from INTERNAL_WALL_WIDTH_BY_MACHINE, only four rows are
 * reachable: (2001A,12), (2500HD,12), (3500,8), (BP714,7). The rest are dead rows kept verbatim.
 */
const INTERNAL_BLOCK_SIZE_ROWS = [
  ['AECT Impact 2001A', 6, '6" x 12"'],
  ['AECT 2500HD', 6, '6" x 12"'],
  ['AECT 3500', 7, '7" x 14"'],
  ['AECT BP714', 7, '7" x 14" holey, interlocking'],
  ['AECT 3500', 8, '8" x 14"'],
  ['AECT 3500', 10, '10" x 14"'],
  ['AECT Impact 2001A', 12, '6" x 12"'],
  ['AECT 2500HD', 12, '6" x 12"'],
  ['AECT 3500', 14, '10" x 14"'],
  ['AECT Impact 2001A', 18, '6" x 12"'],
  ['AECT 2500HD', 18, '6" x 12"'],
  ['AECT 3500', 20, '10" x 14"'],
  ['AECT Impact 2001A', 24, '6" x 12"'],
  ['AECT 2500HD', 24, '6" x 12"'],
  ['AECT 3500', 24, '10" x 14"'],
];

/** Cubic yards of raw material per cubic foot of wall, by CEB type (A26:C28). */
const EARTH_PER_CUFT_UNSTAB = 0.037 * 1.8; // (1/27 yd3 per ft3) x 1.8 loose-soil factor
const MATERIAL_PER_CUFT = {
  'Un-stabilized': { earth: EARTH_PER_CUFT_UNSTAB, cement: 0 },
  '8% cement/lime stabilized': {
    earth: EARTH_PER_CUFT_UNSTAB * 0.95,
    cement: EARTH_PER_CUFT_UNSTAB - EARTH_PER_CUFT_UNSTAB * 0.95, // i.e. 5%, despite the "8%" label
  },
};

/** Per-state AECT mobilization/setup cost (rental) and delivery cost per truck (L1:N49). No Alaska or Hawaii. */
const STATES = {
  "Alabama": { setup: 25000, shipping: 2600 },
  "Arizona": { setup: 25000, shipping: 2600 },
  "Arkansas": { setup: 20000, shipping: 1800 },
  "California": { setup: 30000, shipping: 3200 },
  "Colorado": { setup: 25000, shipping: 2600 },
  "Connecticut": { setup: 30000, shipping: 3200 },
  "Delaware": { setup: 30000, shipping: 3200 },
  "Florida": { setup: 30000, shipping: 3200 },
  "Georgia": { setup: 30000, shipping: 3200 },
  "Idaho": { setup: 30000, shipping: 3200 },
  "Illinois": { setup: 30000, shipping: 3200 },
  "Indiana": { setup: 30000, shipping: 3200 },
  "Iowa": { setup: 30000, shipping: 3200 },
  "Kansas": { setup: 25000, shipping: 2600 },
  "Kentucky": { setup: 30000, shipping: 3200 },
  "Louisiana": { setup: 20000, shipping: 1800 },
  "Maine": { setup: 30000, shipping: 3200 },
  "Maryland": { setup: 30000, shipping: 3200 },
  "Massachusetts": { setup: 30000, shipping: 3200 },
  "Michigan": { setup: 30000, shipping: 3200 },
  "Minnesota": { setup: 30000, shipping: 3200 },
  "Mississippi": { setup: 25000, shipping: 2600 },
  "Missouri": { setup: 25000, shipping: 2600 },
  "Montana": { setup: 30000, shipping: 3200 },
  "Nebraska": { setup: 25000, shipping: 2600 },
  "Nevada": { setup: 30000, shipping: 3200 },
  "New Hampshire": { setup: 30000, shipping: 3200 },
  "New Jersey": { setup: 30000, shipping: 3200 },
  "New Mexico": { setup: 20000, shipping: 1800 },
  "New York": { setup: 30000, shipping: 3200 },
  "North Carolina": { setup: 30000, shipping: 3200 },
  "North Dakota": { setup: 30000, shipping: 3200 },
  "Ohio": { setup: 30000, shipping: 3200 },
  "Oklahoma": { setup: 20000, shipping: 1800 },
  "Oregon": { setup: 30000, shipping: 3200 },
  "Pennsylvania": { setup: 30000, shipping: 3200 },
  "Rhode Island": { setup: 30000, shipping: 3200 },
  "South Carolina": { setup: 30000, shipping: 3200 },
  "South Dakota": { setup: 30000, shipping: 3200 },
  "Tennessee": { setup: 25000, shipping: 2600 },
  "Texas": { setup: 20000, shipping: 1800 },
  "Utah": { setup: 25000, shipping: 2600 },
  "Vermont": { setup: 30000, shipping: 3200 },
  "Virginia": { setup: 30000, shipping: 3200 },
  "Washington": { setup: 30000, shipping: 3200 },
  "West Virginia": { setup: 30000, shipping: 3200 },
  "Wisconsin": { setup: 30000, shipping: 3200 },
  "Wyoming": { setup: 30000, shipping: 3200 },
};

// Other fixed constants from the sheet
const EXTERNAL_MORTAR_FACTOR = 0.8; // B9: wall volume x 0.8 (openings/mortar allowance) for external walls
const INTERNAL_MORTAR_FACTOR = 0.85; // B22: x 0.85 for internal walls
const PRODUCTION_EFFICIENCY = 0.2; // B55: effective rate = rated blocks/hr x 0.2
const PALLETS_PER_CUYD = 0.86; // F61: pallets = (earth yd3 + cement yd3) x 0.86
const CUFT_PER_TRUCK = 384; // B78: truckloads = wall ft3 / 384
const RENTAL_PER_BLOCK = 1; // B88: AECT machinery rental $1 per block

// Allowed dropdown values in the original UI
const OPTIONS = {
  wallWidthIn: [7, 8, 10, 12, 14, 18, 20],
  wallHeightFt: [8, 9, 10, 11, 12, 13, 14], // plus "N/A" (= 0)
  blockType: ['Un-stabilized', '8% cement/lime stabilized'], // plus "N/A"
  earthCostPerYd: Array.from({ length: 36 }, (_, i) => i), // 0..35
  cementCostPerYd: [250, 270, 290, 310, 330, 350, 370, 390, 410, 430],
  crewSize: [3, 4, 5, 6, 7],
  laborRate: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30], // plus "volunteer" (= 0)
  incidentalsPerBlock: Array.from({ length: 23 }, (_, i) => +((i + 1) / 100).toFixed(2)), // 0.01..0.23
  palletsPerBlock: Array.from({ length: 23 }, (_, i) => +((i + 1) / 100).toFixed(2)), // 0.01..0.23
  state: Object.keys(STATES),
};

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const safeDiv = (a, b) => {
  const r = a / b;
  return Number.isFinite(r) ? r : 0; // sheet's IFERROR(...,0)
};

/**
 * @param {object} inputs
 * @param {number} inputs.externalLinearFt   B5  linear feet of external wall (free number)
 * @param {number} inputs.wallWidthIn        B6  external wall width, inches (7|8|10|12|14|18|20)
 * @param {number} inputs.wallHeightFt       B8  external wall height, feet (8-14, or 0 for N/A)
 * @param {number} inputs.internalLinearFt   B18 linear feet of internal wall
 * @param {number} inputs.internalWallHeightFt B21 internal wall height, feet
 * @param {string} inputs.externalBlockType  B29 'Un-stabilized' | '8% cement/lime stabilized'
 * @param {string} inputs.internalBlockType  B41 same choices
 * @param {number} inputs.earthCostPerYd     B34 $/yd3 of earth incl. delivery (0-35)
 * @param {number} inputs.cementCostPerYd    B35 $/yd3 of cement/lime (250-430)
 * @param {number} inputs.crewSize           B53 laborers (3-7)
 * @param {number} inputs.laborRate          B54 $/hr per laborer (10-30, 0 = volunteer)
 * @param {number} inputs.incidentalsPerBlock B60 $/block wrap/fuel/oil/water/maint
 * @param {number} inputs.palletsPerBlock    B61 $/block for pallets
 * @param {string} inputs.state              B76 US state name
 */
function calculate(inputs = {}) {
  const extFt = num(inputs.externalLinearFt);
  const width = num(inputs.wallWidthIn);
  const height = num(inputs.wallHeightFt);
  const intFt = num(inputs.internalLinearFt);
  const intHeight = num(inputs.internalWallHeightFt);
  const earth$ = num(inputs.earthCostPerYd);
  const cement$ = num(inputs.cementCostPerYd);
  const crew = num(inputs.crewSize);
  const rate = num(inputs.laborRate);
  const incid = num(inputs.incidentalsPerBlock);
  const pallet = num(inputs.palletsPerBlock);
  const state = STATES[inputs.state];

  // --- External wall ---
  const extWallCuFt = extFt * height * (width / 12) * EXTERNAL_MORTAR_FACTOR; // B9
  const blockSize = BLOCK_SIZE_BY_WALL_WIDTH[width] || ''; // B10
  const extBlockVol = BLOCK_VOLUME_CUFT[blockSize] || 0; // B12
  const externalBlocks = safeDiv(extWallCuFt, extBlockVol); // B14 = F5

  // --- Machine (driven by external block size + external block count only) ---
  const m = MACHINE_BY_BLOCK_SIZE[blockSize];
  const machine = m ? (externalBlocks > MACHINE_BLOCK_THRESHOLD ? m.over : m.atOrUnder) : 0; // B15 = F10 (0 if none)
  const machineInfo = MACHINES[machine];
  const machineCost = machineInfo ? machineInfo.price : 0; // B16 = F17

  // --- Internal wall ---
  const internalWallWidthIn = INTERNAL_WALL_WIDTH_BY_MACHINE[machine] ?? ''; // B19
  const intWallCuFt = intFt * intHeight * (num(internalWallWidthIn) / 12) * INTERNAL_MORTAR_FACTOR; // B22
  const row = INTERNAL_BLOCK_SIZE_ROWS.find(([mm, w]) => w === internalWallWidthIn && mm === machine);
  const internalBlockSize = row ? row[2] : ''; // B23
  const intBlockVol = BLOCK_VOLUME_CUFT[internalBlockSize] || 0; // B24
  const internalBlocks = safeDiv(intWallCuFt, intBlockVol); // B27 = F6

  const totalBlocks = externalBlocks + internalBlocks; // F8

  // --- Materials ---
  const extMat = MATERIAL_PER_CUFT[inputs.externalBlockType] || { earth: 0, cement: 0 };
  const intMat = MATERIAL_PER_CUFT[inputs.internalBlockType] || { earth: 0, cement: 0 };
  const extEarthYd = extWallCuFt * extMat.earth; // B32
  const extCementYd = extWallCuFt * extMat.cement; // B33
  const intEarthYd = intWallCuFt * intMat.earth; // B44
  const intCementYd = intWallCuFt * intMat.cement; // B45
  const extMaterialCost = earth$ * extEarthYd + cement$ * extCementYd; // B38
  const intMaterialCost = earth$ * intEarthYd + cement$ * intCementYd; // B50
  const earthYd = extEarthYd + intEarthYd; // F18
  const cementYd = extCementYd + intCementYd; // F19
  const materialCost = extMaterialCost + intMaterialCost; // F21

  // --- Labor ---
  const effectiveBlocksPerHour = machineInfo ? machineInfo.blocksPerHour * PRODUCTION_EFFICIENCY : 0; // B55
  const productionHours = safeDiv(totalBlocks, effectiveBlocksPerHour); // B56
  const laborCost = productionHours * rate * crew; // B57 = F23

  // --- Incidentals ---
  const incidentalCost = (pallet + incid) * totalBlocks; // B64, B63 = F28

  // --- Option 1: buy machine & produce your own ---
  const produceTotal = materialCost + laborCost + incidentalCost; // F29
  const produceCostPerBlock = safeDiv(produceTotal, totalBlocks); // F34 = B96

  // --- Option 2: rent AECT machinery with operator ---
  const mobilizationCost = state ? state.setup : 0; // B87 = F40
  const rentalMaterialLaborIncidental = materialCost + incidentalCost + laborCost; // F41
  const rentalMachineryCost = RENTAL_PER_BLOCK * totalBlocks; // F52
  const rentalTotal = mobilizationCost + rentalMaterialLaborIncidental + rentalMachineryCost; // F53
  const rentalCostPerBlock = safeDiv(rentalTotal, totalBlocks); // F54 = B97

  // --- Option 3: buy CEBs from AECT and ship ---
  const blockPrice = AECT_BLOCK_PRICE[blockSize] || 0; // B80 (external block size price applied to ALL blocks)
  const purchaseCost = blockPrice * totalBlocks; // B81 = F60
  const palletsNeeded = (earthYd + cementYd) * PALLETS_PER_CUYD; // F61
  const truckloads = (extWallCuFt + intWallCuFt) / CUFT_PER_TRUCK; // B78 = F74 (not rounded up)
  const deliveryCostPerTruck = state ? state.shipping : 0; // B77 = F75
  const deliveryCost = deliveryCostPerTruck * truckloads; // F76
  const purchaseTotal = purchaseCost + deliveryCost; // F85
  const purchaseCostPerBlock = safeDiv(purchaseTotal, totalBlocks); // F86 = B98

  return {
    externalBlocks, internalBlocks, totalBlocks,
    blockSize, machine, machineCost,
    internalWallWidthIn, internalBlockSize,
    earthYd, cementYd,
    materialCost, laborCost, incidentalCost,
    produceTotal, produceCostPerBlock,
    mobilizationCost, rentalMaterialLaborIncidental, rentalMachineryCost, rentalTotal, rentalCostPerBlock,
    blockPrice, purchaseCost, palletsNeeded, truckloads, deliveryCostPerTruck, deliveryCost,
    purchaseTotal, purchaseCostPerBlock,
    comparison: {
      buyMachineProduceOwn: produceCostPerBlock,
      rentWithOperator: rentalCostPerBlock,
      buyStabilizedCEBs: purchaseCostPerBlock,
    },
    // intermediates useful for UI/debugging
    _intermediate: { extWallCuFt, intWallCuFt, extBlockVol, intBlockVol, effectiveBlocksPerHour, productionHours },
  };
}

const TABLES = {
  BLOCK_SIZE_BY_WALL_WIDTH, BLOCK_VOLUME_CUFT, AECT_BLOCK_PRICE, MACHINES, MACHINE_BLOCK_THRESHOLD,
  MACHINE_BY_BLOCK_SIZE, INTERNAL_WALL_WIDTH_BY_MACHINE, INTERNAL_BLOCK_SIZE_ROWS, MATERIAL_PER_CUFT, STATES,
};

if (typeof module !== 'undefined') module.exports = { calculate, TABLES, OPTIONS };
if (typeof window !== 'undefined') window.AECTCalc = { calculate, TABLES, OPTIONS };
