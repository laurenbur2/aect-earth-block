# AECT CEB Calculator: extracted logic

Source: SpreadsheetConverter export of the Excel workbook "CEB block number calculator_house build_2022_rev1", embedded at aectearthblock.com/ceb-calculator. I read the formulas from the compiled `calc(data)` function in `assets/js/app.min.js` and mapped cells to labels using the page HTML. Cell refs below (B14, F86, ...) are sheet-1 cells. "Sheet 2" refers to the hidden helper sheet. Field ids in the HTML are `XLEW_1_<row>_<col>`, where col 2 = B and col 6 = F.

I re-implemented the logic in `calculator.js` (`calculate(inputs)`). I checked it against the live calculator with 5 input sets, comparing the raw unrounded values the page computes. All 30 outputs matched to floating-point precision in every case (see Test cases).

## How unset values behave

Every dropdown starts on `select`. The sheet converts text to a number with "parse or 0", so `select`, `N/A` and `volunteer` all become **0**. Text lookups (block type, state) that fail return 0 or blank. Blank linear-feet fields also count as 0. A division by zero returns 0 (`IFERROR(...,0)`).

## Inputs

| Cell | HTML id | Label | Allowed values | Default |
|---|---|---|---|---|
| B5 | XLEW_1_5_2 | Linear FEET of wall needed - external | free number | blank (0) |
| B6 | XLEW_1_6_2 | Width of wall desired (inches) | 7, 8, 10, 12, 14, 18, 20 | select |
| B8 | XLEW_1_8_2 | Height of wall desired (feet), external | N/A, 8, 9, 10, 11, 12, 13, 14 | select |
| B18 | XLEW_1_18_2 | Linear FEET of wall needed - internal | free number | blank (0) |
| B21 | XLEW_1_21_2 | Height of wall desired (feet), internal | N/A, 8-14 | select |
| B29 | XLEW_1_29_2 | Type of block desired - external | N/A, Un-stabilized, 8% cement/lime stabilized | select |
| B34 | XLEW_1_34_2 | Your cost of earth per yard (incl. delivery), $/yd | 0-35 (steps of 1) | select |
| B35 | XLEW_1_35_2 | Cost of cement per yard, $/yd ("typically $350") | 250, 270, 290, 310, 330, 350, 370, 390, 410, 430 | select |
| B41 | XLEW_1_41_2 | Type of block desired - internal | N/A, Un-stabilized, 8% cement/lime stabilized | select |
| B53 | XLEW_1_53_2 | Crew size (typically 4 to 6) | 3, 4, 5, 6, 7 | select |
| B54 | XLEW_1_54_2 | Average hourly cost of your labor, $/hr | volunteer (=0), 10-30 (steps of 1) | select |
| B60 | XLEW_1_60_2 | Plastic wrap/fuel/oil/water/maint. per block (about $0.12) | 0.01-0.23 (steps of 0.01) | select |
| B61 | XLEW_1_61_2 | Pallets per block (typically about $0.15) | 0.01-0.23 (steps of 0.01) | select |
| B76 | XLEW_1_76_2 | What state are you in? | 48 states (no Alaska or Hawaii) | select |

The page also shows these derived fields:
- **B10** "Block size desired" is looked up from the wall width.
- **B19** "Width of internal wall (given machine selected above)" is looked up from the machine.
- **B23** "Block size required" (internal) is looked up from the machine and the internal width.

## Lookup tables (verbatim)

### Wall width to block size (BJ36:BK43)
| External wall width (in) | Block size |
|---|---|
| 7 | 7" x 14" holey, interlocking |
| 8 | 8" x 14" |
| 10 | 10" x 14" |
| 12 | 6" x 12" |
| 14 | 10" x 14" |
| 18 | 6" x 12" |
| 20 | 10" x 14" |

### Block volume in cubic feet (A18:B24), using the sheet's literal constants
| Block size | Formula | ft³ |
|---|---|---|
| 4" x 12" | 0.333 x 1 x 0.33333 | 0.11099889 |
| 6" x 12" | 0.5 x 1 x 0.3333 | 0.16665 |
| 7" x 14" | 0.583333 x 1.166666 x 0.33333 | 0.22685... |
| 7" x 14" holey, interlocking | 0.583333 x 1.166666 x 0.33333 | 0.22685... |
| 8" x 14" | 0.6666666 x 1.166666 x 0.33333 | 0.25926... |
| 10" x 14" | 0.8333333 x 1.1666666 x 0.333333 | 0.32407... |

### Machines (F3:I11) and AECT block price (C3:C9, J3:J9)
| Machine | Blocks/hr (rated) | Price |
|---|---|---|
| AECT Impact 2001A | 300 | $39,000 |
| AECT 3500 | 480 | $149,000 |
| AECT BP714 | 200 | $59,000 |
| AECT 2500HD | 480 | $79,000 |

| Block size | AECT block price |
|---|---|
| 4" x 12" | $2.75 |
| 6" x 12" | $3.10 |
| 7" x 14" | $3.25 |
| 7" x 14" holey, interlocking | $3.50 |
| 8" x 14" | $3.35 |
| 10" x 14" | $3.50 |

### Machine required (sheet 2, C32:G43; threshold D30 = 30,000; first matching row wins)
The 30,000 threshold applies to the **external** block count (B14) only.

| Block size | External blocks > 30,000 | External blocks <= 30,000 |
|---|---|---|
| 4" x 12" | AECT Impact 2001A | AECT Impact 2001A |
| 6" x 12" | AECT 2500HD | AECT Impact 2001A |
| 7" x 14" | AECT 3500 | AECT 3500 |
| 7" x 14" holey, interlocking | AECT BP714 | AECT BP714 |
| 8" x 14" | AECT 3500 | AECT 3500 |
| 10" x 14" | AECT 3500 | AECT 3500 |

### Internal wall width by machine (BJ22:BK26)
| Machine | Internal wall width (in) |
|---|---|
| AECT Impact 2001A | 12 |
| AECT 2500HD | 12 |
| AECT 3500 | 8 |
| AECT BP714 | 7 |

### Internal block size by (machine, internal width) (sheet 2, B64:G78; first match wins)
| Machine | Width | Block size |
|---|---|---|
| AECT Impact 2001A | 6 | 6" x 12" |
| AECT 2500HD | 6 | 6" x 12" |
| AECT 3500 | 7 | 7" x 14" |
| AECT BP714 | 7 | 7" x 14" holey, interlocking |
| AECT 3500 | 8 | 8" x 14" |
| AECT 3500 | 10 | 10" x 14" |
| AECT Impact 2001A | 12 | 6" x 12" |
| AECT 2500HD | 12 | 6" x 12" |
| AECT 3500 | 14 | 10" x 14" |
| AECT Impact 2001A | 18 | 6" x 12" |
| AECT 2500HD | 18 | 6" x 12" |
| AECT 3500 | 20 | 10" x 14" |
| AECT Impact 2001A | 24 | 6" x 12" |
| AECT 2500HD | 24 | 6" x 12" |
| AECT 3500 | 24 | 10" x 14" |

Only four rows can ever match: (2001A, 12) and (2500HD, 12) give 6" x 12", (3500, 8) gives 8" x 14", and (BP714, 7) gives 7" x 14" holey. So in practice:
- 2001A and 2500HD give a 12" internal wall of 6x12 blocks.
- 3500 gives an 8" internal wall of 8x14 blocks.
- BP714 gives a 7" internal wall of 7x14 holey blocks.

### Material per ft³ of wall, in cubic yards (A26:C28)
| CEB type | Earth yd³ per ft³ | Cement/lime yd³ per ft³ |
|---|---|---|
| Un-stabilized | 0.037 x 1.8 = 0.0666 | 0 |
| 8% cement/lime stabilized | 0.0666 x 0.95 = 0.06327 | 0.0666 - 0.06327 = 0.00333 |

### Per-state costs (L1:N49): "Setup cost" (rental mobilization) and "shipping cost" (per truck)
There are three tiers:
- **$20,000 setup / $1,800 per truck:** Arkansas, Louisiana, New Mexico, Oklahoma, Texas
- **$25,000 setup / $2,600 per truck:** Alabama, Arizona, Colorado, Kansas, Mississippi, Missouri, Nebraska, Tennessee, Utah
- **$30,000 setup / $3,200 per truck:** California, Connecticut, Delaware, Florida, Georgia, Idaho, Illinois, Indiana, Iowa, Kentucky, Maine, Maryland, Massachusetts, Michigan, Minnesota, Montana, Nevada, New Hampshire, New Jersey, New York, North Carolina, North Dakota, Ohio, Oregon, Pennsylvania, Rhode Island, South Carolina, South Dakota, Vermont, Virginia, Washington, West Virginia, Wisconsin, Wyoming

The full table, keyed by state, is in `calculator.js` as `STATES`.

### Other constants
| Constant | Value | Cell |
|---|---|---|
| External wall volume factor | 0.8 | B9 |
| Internal wall volume factor | 0.85 | B22 |
| Production efficiency (applied to rated blocks/hr) | 0.2 | B55 |
| Machine threshold (external blocks) | 30,000 | sheet 2 D30 |
| AECT rental fee per block | $1 | B88 |
| Pallets per yd³ of material | 0.86 | F61 |
| Wall ft³ per truckload | 384 | B78 |

## Formulas (plain math; all intermediate values are unrounded)

**External wall**
- B9  extWallCuFt = extLinearFt x extHeight x (wallWidth / 12) x 0.8
- B10 blockSize = BLOCK_SIZE[wallWidth]
- B12 extBlockVol = VOLUME[blockSize]
- B14 / F5 **externalBlocks** = extWallCuFt / extBlockVol

**Machine**
- B15 / F10 **machine** = MACHINE_TABLE[blockSize][externalBlocks > 30000 ? over : atOrUnder]. If there is no block size, this is 0.
- B16 / F17 **machineCost** = MACHINES[machine].price

**Internal wall**
- B19 internalWidth = INTERNAL_WIDTH[machine]
- B22 intWallCuFt = intLinearFt x intHeight x (internalWidth / 12) x 0.85
- B23 internalBlockSize = INTERNAL_BLOCK[(machine, internalWidth)]
- B24 intBlockVol = VOLUME[internalBlockSize]
- B27 / F6 **internalBlocks** = intWallCuFt / intBlockVol
- F8 **totalBlocks** = externalBlocks + internalBlocks

**Materials**
- B32 extEarth = extWallCuFt x EARTH[extType]
- B33 extCement = extWallCuFt x CEMENT[extType]
- B44 intEarth = intWallCuFt x EARTH[intType]
- B45 intCement = intWallCuFt x CEMENT[intType]
- B38 extMaterialCost = earth$/yd x extEarth + cement$/yd x extCement
- B50 intMaterialCost = earth$/yd x intEarth + cement$/yd x intCement
- F18 **earthYd** = extEarth + intEarth
- F19 **cementYd** = extCement + intCement
- F21 **materialCost** = B38 + B50

**Labor**
- B55 effectiveRate = MACHINES[machine].blocksPerHour x 0.2
- B56 hours = totalBlocks / effectiveRate
- B57 / F23 **laborCost** = hours x laborRate x crewSize

**Incidentals**
- B64 perBlock = palletsPerBlock + incidentalsPerBlock
- B63 / F28 **incidentalCost** = perBlock x totalBlocks

**Option A: buy a machine and produce your own blocks** (does not include the machine price)
- F29 **produceTotal** = materialCost + laborCost + incidentalCost
- F34 / B96 **produceCostPerBlock** = F29 / totalBlocks

**Option B: rent AECT machinery with an operator**
- F40 **mobilizationCost** = STATES[state].setup
- F41 **materialLaborIncidental** = materialCost + incidentalCost + laborCost (same value as F29)
- F52 **rentalMachineryCost** = 1 x totalBlocks
- F53 **rentalTotal** = F40 + F41 + F52
- F54 / B97 **rentalCostPerBlock** = F53 / totalBlocks

**Option C: buy cement-stabilized CEBs from AECT and ship them**
- B80 blockPrice = AECT_PRICE[blockSize] (uses the external block size)
- F60 **purchaseCost** = blockPrice x totalBlocks
- F61 **palletsNeeded** = (earthYd + cementYd) x 0.86
- F74 **truckloads** = (extWallCuFt + intWallCuFt) / 384
- F75 **deliveryCostPerTruck** = STATES[state].shipping
- F76 **deliveryCost** = F75 x F74
- F85 **purchaseTotal** = F60 + F76
- F86 / B98 **purchaseCostPerBlock** = F85 / totalBlocks

**Comparison panel**
- B96 = F34
- B97 = F54
- B98 = F86

### How the page displays values
Rounding happens only when values are displayed:
- **Whole numbers with thousands separators:** block counts, yd³ and pallets.
- **One decimal place:** truckloads.
- **Whole dollars:** most cost totals, plus the machine price, cost of CEBs and total cost (incl. delivery).
- **Dollars with 2 decimals:** "Total cost to produce CEBs" (F29), the three cost-per-CEB fields, and the comparison panel.

## Test cases (verified against the live calculator, 2026-10-13)

My `calculate()` reproduced every case below: all 30 raw outputs matched the live page to about 1e-9 relative. The values shown here are as the live page displays them.

**Case 1: Texas, 12" wall, Impact 2001A**
Inputs: ext 500 ft, width 12, height 10, int 200 ft, int height 9, ext type 8% stabilized, int type Un-stabilized, earth $20, cement $350, crew 5, labor $15, incidentals 0.12, pallets 0.15, Texas.

| Output | Live value |
|---|---|
| External / internal / total CEBs | 24,002 / 9,181 / 33,183 |
| Block size | 6" x 12" |
| Machine | AECT Impact 2001A ($39,000) |
| Internal wall | 12" of 6" x 12" blocks |
| Earth / cement | 355 / 13 yd³ |
| Material / labor / incidental | $11,762 / $41,479 / $8,959 |
| Total to produce | $62,200.20 ($1.87 per CEB) |
| Rent | mobilization $20,000 + M/L/I $62,200 + rental $33,183 = $115,384 ($3.48 per CEB) |
| Buy | CEBs $102,868, 317 pallets, 14.4 trucks x $1,800 = $25,922, total $128,790 ($3.88 per CEB) |
| Comparison | $1.87 / $3.48 / $3.88 |

**Case 2: California, over 30,000 blocks, so 2500HD**
Inputs: ext 1500 ft, width 12, height 12, int 300 ft, int height 10, both types 8% stabilized, earth $25, cement $290, crew 4, labor volunteer, incidentals 0.05, pallets 0.10, California.

| Output | Live value |
|---|---|
| External / internal / total CEBs | 86,409 / 15,302 / 101,710 |
| Machine | AECT 2500HD ($79,000) |
| Earth / cement | 1,072 / 56 yd³ |
| Material / labor / incidental | $43,179 / $0 / $15,257 |
| Total to produce | $58,435.80 ($0.57 per CEB) |
| Rent | $30,000 + $58,436 + $101,710 = $190,146 ($1.87 per CEB) |
| Buy | CEBs $315,302, 971 pallets, 44.1 trucks x $3,200 = $141,250, total $456,552 ($4.49 per CEB) |

**Case 3: Colorado, 7" wall, BP714, unstabilized, free earth**
Inputs: ext 400 ft, width 7, height 8, int 150 ft, int height 9, both types Un-stabilized, earth $0, cement select, crew 6, labor $22, incidentals 0.12, pallets 0.15, Colorado.

| Output | Live value |
|---|---|
| External / internal / total CEBs | 6,583 / 2,951 / 9,534 |
| Block size | 7" x 14" holey, interlocking |
| Machine | AECT BP714 ($59,000) |
| Internal wall | 7" holey |
| Earth / cement | 144 / 0 yd³ |
| Material / labor / incidental | $0 / $31,461 / $2,574 |
| Total to produce | $34,035.23 ($3.57 per CEB) |
| Rent | $25,000 + $34,035 + $9,534 = $68,569 ($7.19 per CEB) |
| Buy | $33,368, 124 pallets, 5.6 trucks x $2,600 = $14,643, total $48,011 ($5.04 per CEB) |

**Case 4: New York, 10" wall, AECT 3500**
Inputs: ext 600 ft, width 10, height 10, int 250 ft, int height 9, ext type 8% stabilized, int type Un-stabilized, earth $15, cement $430, crew 7, labor $30, incidentals 0.23, pallets 0.01, New York.

| Output | Live value |
|---|---|
| External / internal / total CEBs | 12,343 / 4,918 / 17,261 |
| Block size | 10" x 14" |
| Machine | AECT 3500 ($149,000) |
| Internal wall | 8" of 8" x 14" blocks |
| Earth / cement | 338 / 13 yd³ |
| Material / labor / incidental | $10,798 / $37,758 / $4,143 |
| Total to produce | $52,698.07 ($3.05 per CEB) |
| Rent | $30,000 + $52,698 + $17,261 = $99,959 ($5.79 per CEB) |
| Buy | $60,413, 302 pallets, 13.7 trucks x $3,200 = $43,958, total $104,371 ($6.05 per CEB) |

**Case 5: everything left on "select"**
All outputs are 0 or blank. The machine field shows "$0" (a formatting quirk in the original).

## Oddities and likely bugs in the original spreadsheet

1. **"8% cement/lime stabilized" is really 5% by volume.** Cement is 0.05 x the earth figure, and earth is 0.95 x.
2. **Pallets needed is based on cubic yards of material, not blocks.** The formula is (earth yd³ + cement yd³) x 0.86. It is never rounded up, and the $15-per-pallet deposit mentioned in the note is not included anywhere.
3. **Truckloads are fractional.** Wall ft³ / 384 is not rounded up, so delivery is billed for 14.4 trucks, for example.
4. **The purchase price applies the external block size's price to every block,** internal blocks included. With a 10" external wall, the 8x14 internal blocks are priced at $3.50 instead of $3.35. The purchase option also ignores the chosen block type, since it always assumes stabilized blocks.
5. **Machine choice looks only at the external block count against 30,000.** Internal blocks are ignored. The threshold only matters for 6x12 blocks (12" and 18" walls): more than 30,000 gives the 2500HD, otherwise the 2001A.
6. **Labor assumes 20% of the machine's rated output** (blocks/hr x 0.2). For example, the 2001A works out to 60 blocks/hr. This may be intentional, but it is undocumented.
7. **The rental option still charges your full crew labor, materials and incidentals** (F41 is identical to F29), on top of mobilization and $1 per block. "With an operator" does not reduce your labor cost.
8. **The machine purchase price is never included in any total.** The page notes this for option A.
9. **Some table entries can never be reached.** The 4" x 12" and plain 7" x 14" sizes cannot be chosen from any wall width, so their prices and machine rows are dead. 11 of the 15 internal-block rows are also dead. 14" and 20" walls use 10x14 blocks, and 18" walls use 6x12. Block counts are pure volume division, not real coursing.
10. **The block-volume constants are rounded inconsistently.** For example, 0.333 x 0.33333 for 4" x 12", 0.3333 for 6" x 12", and 0.333333 for 10" x 14". The earth factor uses 0.037 instead of 1/27 = 0.037037.
11. **Wall volume is reduced by fixed factors:** x 0.8 for external walls and x 0.85 for internal walls. These presumably allow for openings and mortar, but this is undocumented.
12. **A height of "N/A" counts as 0,** so that wall contributes zero blocks. Volunteer labor counts as $0/hr.
13. **The internal wall width is forced by the machine.** It is 12" for 2001A/2500HD, 8" for 3500 and 7" for BP714, whatever the user wants.
14. **The state list has 48 entries** (no Alaska or Hawaii). When no state is selected, mobilization and delivery are $0.
15. **Display formatting quirk:** when no machine is resolved, the machine field shows "$0", because it is formatted as currency.
