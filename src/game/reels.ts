// Reel outcomes for Frankie's Castle. No three.js imports.
// A grid is grid[reel][row], row 0 at the top. Wins are left to right.

export const SYMBOLS = [
  { id: 'wolf', name: 'Werewolf', weight: 26, pay: { 3: 5, 4: 20, 5: 80 } },
  { id: 'moth', name: "Death's Moth", weight: 26, pay: { 3: 6, 4: 24, 5: 100 } },
  { id: 'bat', name: 'Bat', weight: 21, pay: { 3: 10, 4: 35, 5: 150 } },
  { id: 'bride', name: 'The Bride', weight: 14, pay: { 3: 15, 4: 60, 5: 250 } },
  { id: 'creature', name: 'The Creature', weight: 9, pay: { 3: 25, 4: 120, 5: 500 } },
  { id: 'crow', name: 'Elixir', weight: 8, pay: { 3: 0, 4: 0, 5: 0 } },
  { id: 'frank', name: 'Frankie', weight: 5, pay: { 3: 50, 4: 250, 5: 1000 } },
] as const;

export type SymbolId = (typeof SYMBOLS)[number]['id'];
export type Grid = SymbolId[][];

export const PAYLINES = [
  { name: 'Middle', rows: [1, 1, 1, 1, 1] },
  { name: 'Top', rows: [0, 0, 0, 0, 0] },
  { name: 'Bottom', rows: [2, 2, 2, 2, 2] },
  { name: 'V Down', rows: [0, 1, 2, 1, 0] },
  { name: 'V Up', rows: [2, 1, 0, 1, 2] },
] as const;

export const BETS = [5, 10, 25, 50, 100] as const;
export type Bet = (typeof BETS)[number];

export const START_BALANCE = 2500;
export const START_JACKPOT = 13666;
export const JACKPOT_RESET = 2500;
export const JACKPOT_RATE = 0.05;
export const FREE_SPINS_AWARD = 5;
export const BANNER_MULTIPLE = 5;
export const START_BET: Bet = 10;

export const TOTAL_WEIGHT = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);

const BY_ID = Object.fromEntries(SYMBOLS.map((symbol) => [symbol.id, symbol])) as Record<
  SymbolId,
  (typeof SYMBOLS)[number]
>;

export const SYMBOL_COLOR: Record<SymbolId, string> = {
  wolf: '#a8abbe',
  moth: '#e4d3ae',
  bat: '#8d4cb5',
  bride: '#e4e8ee',
  creature: '#6ea896',
  crow: '#6fce4e',
  frank: '#7dce4a',
};

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function isBet(n: number): n is Bet {
  return (BETS as readonly number[]).includes(n);
}

export function pickSymbol(rng: () => number): SymbolId {
  let r = rng() * TOTAL_WEIGHT;
  for (const symbol of SYMBOLS) {
    r -= symbol.weight;
    if (r < 0) return symbol.id;
  }
  return 'frank';
}

export function spinGrid(rng: () => number = Math.random): Grid {
  return Array.from({ length: 5 }, () =>
    Array.from({ length: 3 }, () => pickSymbol(rng)),
  );
}

export interface LineWin {
  lineIndex: number;
  lineName: string;
  symbolId: SymbolId;
  count: number;
  mult: number;
  cells: Array<[number, number]>;
  full: Array<[number, number]>;
}

export type WinSound = 'buzz' | 'laugh' | 'howl' | 'thunder' | 'none';

export interface Bank {
  balance: number;
  jackpot: number;
  freeSpins: number;
}

export interface ResolvedSpin {
  grid: Grid;
  lines: LineWin[];
  payout: number;
  isJackpot: boolean;
  freeSpinsAwarded: number;
  banner: { amount: number; jackpot: boolean } | null;
  sound: WinSound;
  during: Bank;
  final: Bank;
}

export function evaluate(grid: Grid): LineWin[] {
  const lines: LineWin[] = [];
  PAYLINES.forEach((line, lineIndex) => {
    const seq = line.rows.map((row, reel) => grid[reel][row]);
    const first = seq[0];
    let count = 1;
    for (let i = 1; i < seq.length; i += 1) {
      if (seq[i] === first) count += 1;
      else break;
    }
    if (count < 3) return;
    const mult = BY_ID[first].pay[count as 3 | 4 | 5] ?? 0;
    const elixirFive = first === 'crow' && count === 5;
    if (mult <= 0 && !elixirFive) return;
    lines.push({
      lineIndex,
      lineName: line.name,
      symbolId: first,
      count,
      mult,
      cells: Array.from({ length: count }, (_, i) => [i, line.rows[i]]),
      full: line.rows.map((row, reel) => [reel, row]),
    });
  });
  return lines;
}

export function winSound(payout: number, lines: LineWin[]): WinSound {
  if (lines.some((line) => line.symbolId === 'frank')) return 'buzz';
  if (payout >= 1000) return 'laugh';
  if (payout >= 200) return 'howl';
  if (payout > 0) return 'thunder';
  return 'none';
}

export function canAfford(state: Bank, bet: number): boolean {
  return state.freeSpins > 0 || state.balance >= bet;
}

/** Paid spins add 5% of the bet to the jackpot. Five Frankies pays that pot and resets it. */
export function playSpin(state: Bank, bet: number, grid: Grid): ResolvedSpin | null {
  if (!isBet(bet)) throw new Error(`bet ${bet} is not on the ladder`);
  const paid = state.freeSpins <= 0;
  if (paid && state.balance < bet) return null;

  let balance = state.balance;
  let jackpot = state.jackpot;
  let freeSpins = state.freeSpins;
  if (paid) {
    balance -= bet;
    jackpot = round2(jackpot + round2(bet * JACKPOT_RATE));
  } else {
    freeSpins -= 1;
  }
  const during: Bank = { balance, jackpot, freeSpins };

  const lines = evaluate(grid);
  const isJackpot = lines.some((line) => line.symbolId === 'frank' && line.count === 5);
  const elixir = lines.some((line) => line.symbolId === 'crow' && line.count === 5);
  let payout = 0;
  if (isJackpot) {
    payout = Math.floor(jackpot);
    jackpot = JACKPOT_RESET;
  } else {
    payout = lines.reduce((sum, line) => sum + line.mult, 0) * bet;
  }
  balance += payout;
  if (elixir) freeSpins += FREE_SPINS_AWARD;

  const multiple = payout / bet;
  return {
    grid,
    lines,
    payout,
    isJackpot,
    freeSpinsAwarded: elixir ? FREE_SPINS_AWARD : 0,
    banner: isJackpot || multiple >= BANNER_MULTIPLE ? { amount: payout, jackpot: isJackpot } : null,
    sound: winSound(payout, lines),
    during,
    final: { balance, jackpot, freeSpins },
  };
}
