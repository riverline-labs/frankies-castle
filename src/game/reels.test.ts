import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildStrip, idleStrip, reelPath, sampleReelY } from './motion';
import {
  BANNER_MULTIPLE,
  BETS,
  JACKPOT_RESET,
  PAYLINES,
  START_BALANCE,
  START_JACKPOT,
  SYMBOLS,
  TOTAL_WEIGHT,
  evaluate,
  pickSymbol,
  playSpin,
  type Grid,
  type SymbolId,
} from './reels';
import { STORAGE_KEY, loadBank, saveBank } from './storage';
import { layout } from '../scene/layout';

const FILL: SymbolId[] = ['wolf', 'moth', 'bat', 'bride', 'creature'];

function blank(): Grid {
  return FILL.map((id) => [id, id, id]);
}

function withLine(lineIndex: number, symbol: SymbolId, count = 5): Grid {
  const grid = blank();
  const rows = PAYLINES[lineIndex].rows;
  for (let reel = 0; reel < count; reel += 1) grid[reel][rows[reel]] = symbol;
  return grid;
}

describe('paytable', () => {
  it('keeps the five paylines and the weight table', () => {
    expect(PAYLINES.map((line) => [...line.rows])).toEqual([
      [1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0],
      [2, 2, 2, 2, 2],
      [0, 1, 2, 1, 0],
      [2, 1, 0, 1, 2],
    ]);
    expect(SYMBOLS.map((symbol) => [symbol.id, symbol.weight, symbol.pay[3], symbol.pay[4], symbol.pay[5]])).toEqual([
      ['wolf', 26, 5, 20, 80],
      ['moth', 26, 6, 24, 100],
      ['bat', 21, 10, 35, 150],
      ['bride', 14, 15, 60, 250],
      ['creature', 9, 25, 120, 500],
      ['crow', 8, 0, 0, 0],
      ['frank', 5, 50, 250, 1000],
    ]);
    expect(TOTAL_WEIGHT).toBe(109);
    expect(BETS).toEqual([5, 10, 25, 50, 100]);
    expect(SYMBOLS.find((symbol) => symbol.id === 'crow')?.name).toBe('Elixir');
  });

  it('walks weight boundaries', () => {
    expect(pickSymbol(() => 0)).toBe('wolf');
    expect(pickSymbol(() => 26 / 109 - 1e-12)).toBe('wolf');
    expect(pickSymbol(() => 26 / 109)).toBe('moth');
    expect(pickSymbol(() => 104 / 109)).toBe('frank');
    expect(pickSymbol(() => 0.999999)).toBe('frank');
  });
});

describe('evaluate', () => {
  it('pays 3+ from the left only', () => {
    const grid = blank();
    grid[0][1] = 'wolf';
    grid[1][1] = 'wolf';
    grid[2][1] = 'bat';
    grid[3][1] = 'wolf';
    grid[4][1] = 'wolf';
    expect(evaluate(grid)).toEqual([]);

    const three = withLine(0, 'wolf', 3);
    const hit = evaluate(three);
    expect(hit).toHaveLength(1);
    expect(hit[0]).toMatchObject({ lineName: 'Middle', symbolId: 'wolf', count: 3, mult: 5 });
  });

  it('reads every payline, including the V shapes', () => {
    const down = evaluate(withLine(3, 'bride', 5));
    expect(down.map((line) => line.lineName)).toEqual(['V Down']);
    expect(down[0].mult).toBe(250);
    const up = evaluate(withLine(4, 'bat', 4));
    expect(up.map((line) => line.lineName)).toEqual(['V Up']);
    expect(up[0].mult).toBe(35);
  });

  it('ignores elixir unless five land on one line', () => {
    expect(evaluate(withLine(1, 'crow', 4))).toEqual([]);
    const five = evaluate(withLine(1, 'crow', 5));
    expect(five).toHaveLength(1);
    expect(five[0]).toMatchObject({ symbolId: 'crow', count: 5, mult: 0, lineName: 'Top' });
  });
});

describe('playSpin', () => {
  const bank = { balance: START_BALANCE, jackpot: START_JACKPOT, freeSpins: 0 };

  it('deducts a paid bet and feeds the jackpot', () => {
    const spin = playSpin(bank, 25, blank());
    expect(spin).not.toBeNull();
    expect(spin?.during).toEqual({ balance: 2475, jackpot: 13667.25, freeSpins: 0 });
    expect(spin?.payout).toBe(0);
    expect(spin?.final.balance).toBe(2475);
    expect(spin?.banner).toBeNull();
  });

  it('pays a normal line win and banners at 5×', () => {
    const spin = playSpin(bank, 10, withLine(0, 'wolf', 3));
    expect(spin?.payout).toBe(50);
    expect(spin?.final.balance).toBe(2540);
    expect(spin?.final.jackpot).toBe(13666.5);
    expect(spin?.banner).toEqual({ amount: 50, jackpot: false });
    expect(spin?.sound).toBe('thunder');
    expect(50 / 10).toBe(BANNER_MULTIPLE);
  });

  it('sums every paying line', () => {
    const grid = blank();
    for (let reel = 0; reel < 3; reel += 1) {
      grid[reel][1] = 'wolf';
      grid[reel][0] = 'moth';
    }
    const spin = playSpin(bank, 10, grid);
    expect(spin?.lines.map((line) => line.symbolId).sort()).toEqual(['moth', 'wolf']);
    expect(spin?.payout).toBe(110);
  });

  it('uses the howl and laugh tiers by absolute payout', () => {
    expect(playSpin(bank, 10, withLine(1, 'bat', 4))?.sound).toBe('howl');
    expect(playSpin(bank, 10, withLine(1, 'bat', 4))?.payout).toBe(350);
    expect(playSpin(bank, 100, withLine(0, 'wolf', 5))?.sound).toBe('laugh');
    expect(playSpin(bank, 100, withLine(0, 'wolf', 5))?.payout).toBe(8000);
    expect(playSpin(bank, 5, withLine(0, 'wolf', 4))?.sound).toBe('thunder');
  });

  it('awards five free spins for five elixirs and does not pay them', () => {
    const spin = playSpin(bank, 10, withLine(2, 'crow', 5));
    expect(spin?.payout).toBe(0);
    expect(spin?.freeSpinsAwarded).toBe(5);
    expect(spin?.final.freeSpins).toBe(5);
    expect(spin?.final.balance).toBe(2490);
    expect(spin?.banner).toBeNull();
    expect(spin?.sound).toBe('none');
  });

  it('pays the progressive once for five Frankies and resets it', () => {
    const grid = withLine(0, 'frank', 5);
    const spin = playSpin(bank, 10, grid);
    expect(spin?.isJackpot).toBe(true);
    expect(spin?.payout).toBe(13666);
    expect(spin?.payout).not.toBe(1000 * 10);
    expect(spin?.final.jackpot).toBe(JACKPOT_RESET);
    expect(spin?.final.balance).toBe(16156);
    expect(spin?.banner).toEqual({ amount: 13666, jackpot: true });
    expect(spin?.sound).toBe('buzz');

    const full = Array.from({ length: 5 }, () => ['frank', 'frank', 'frank'] as SymbolId[]);
    const all = playSpin({ balance: 2500, jackpot: 13666, freeSpins: 0 }, 100, full);
    expect(all?.lines.filter((line) => line.count === 5)).toHaveLength(5);
    expect(all?.payout).toBe(13671);
    expect(all?.final.jackpot).toBe(2500);
    expect(all?.final.balance).toBe(2500 - 100 + 13671);
  });

  it('buzzes on any Frankie line instead of the payout tier', () => {
    const spin = playSpin(bank, 100, withLine(0, 'frank', 3));
    expect(spin?.payout).toBe(5000);
    expect(spin?.sound).toBe('buzz');
    expect(spin?.isJackpot).toBe(false);
  });

  it('does not charge or grow the jackpot on a free spin', () => {
    const spin = playSpin({ balance: 40, jackpot: 3000, freeSpins: 2 }, 100, blank());
    expect(spin?.during).toEqual({ balance: 40, jackpot: 3000, freeSpins: 1 });
    expect(spin?.final).toEqual({ balance: 40, jackpot: 3000, freeSpins: 1 });
  });

  it('pays the current jackpot on a free-spin Frankie', () => {
    const spin = playSpin({ balance: 80, jackpot: 3000, freeSpins: 1 }, 50, withLine(4, 'frank', 5));
    expect(spin?.payout).toBe(3000);
    expect(spin?.final).toEqual({ balance: 3080, jackpot: 2500, freeSpins: 0 });
  });

  it('refuses a paid spin the balance cannot cover', () => {
    expect(playSpin({ balance: 4, jackpot: 100, freeSpins: 0 }, 5, blank())).toBeNull();
    expect(playSpin({ balance: 4, jackpot: 100, freeSpins: 1 }, 5, blank())?.final.balance).toBe(4);
  });
});

describe('reel motion', () => {
  it('moves the strip downward and lands the result in the window', () => {
    const cell = 0.22;
    const center = 1.24;
    const n = 20;
    const path = reelPath(center, n, cell);
    expect(path.endY).toBeLessThan(path.startY);

    const start = sampleReelY(path, 0, cell, false);
    const end = sampleReelY(path, 1, cell, false);
    expect(start + 2 * cell).toBeCloseTo(center + cell);
    expect(end + (n - 1) * cell).toBeCloseTo(center + cell);
    expect(end + (n - 3) * cell).toBeCloseTo(center - cell);

    let prev = start;
    for (let step = 1; step <= 20; step += 1) {
      const y = sampleReelY(path, step / 20, cell, false);
      expect(y).toBeLessThanOrEqual(prev + 1e-9);
      prev = y;
    }
  });

  it('lets the last reel overshoot and tick back', () => {
    const path = reelPath(1.24, 18, 0.22);
    const end = sampleReelY(path, 1, 0.22, true);
    const dipped = sampleReelY(path, 0.84, 0.22, true);
    expect(dipped).toBeLessThan(end - 0.05);
    expect(sampleReelY(path, 1, 0.22, true)).toBeCloseTo(sampleReelY(path, 1, 0.22, false));
  });

  it('builds a strip whose ends are the previous and next windows', () => {
    const strip = buildStrip(['wolf', 'moth', 'bat'], ['frank', 'frank', 'bride'], 2, () => 'crow' as const);
    expect(strip[2]).toBe('wolf');
    expect(strip.at(-1)).toBe('frank');
    expect(strip.at(-2)).toBe('frank');
    expect(strip.at(-3)).toBe('bride');
    expect(idleStrip(['frank', 'frank', 'bride'])).toEqual(['bride', 'frank', 'frank']);
    expect(reelPath(1.24, 3, 0.22).startY).toBeCloseTo(reelPath(1.24, 3, 0.22).endY);
  });
});

describe('layout', () => {
  it('puts a slightly low camera in front of the cabinet', () => {
    expect(layout.camera.position[2]).toBeGreaterThan(layout.camera.target[2]);
    expect(layout.camera.position[1]).toBeLessThan(layout.camera.target[1]);
    expect(layout.reelX).toHaveLength(5);
    expect(layout.cell * 3).toBeCloseTo(layout.window.height);
  });
});

describe('storage', () => {
  it('persists balance and jackpot and rejects junk', () => {
    const mem = new Map<string, string>();
    const store = {
      getItem: (key: string) => mem.get(key) ?? null,
      setItem: (key: string, value: string) => {
        mem.set(key, value);
      },
      removeItem: (key: string) => {
        mem.delete(key);
      },
      clear: () => mem.clear(),
      key: () => null,
      length: 0,
    };
    Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true });
    expect(loadBank()).toEqual({ balance: START_BALANCE, jackpot: START_JACKPOT });
    saveBank({ balance: 12, jackpot: 99.5 });
    expect(loadBank()).toEqual({ balance: 12, jackpot: 99.5 });
    mem.set(STORAGE_KEY, '{');
    expect(loadBank()).toEqual({ balance: START_BALANCE, jackpot: START_JACKPOT });
    mem.set(STORAGE_KEY, JSON.stringify({ balance: -5, jackpot: 10 }));
    expect(loadBank()).toEqual({ balance: START_BALANCE, jackpot: START_JACKPOT });
  });
});

describe('purity', () => {
  it('keeps three.js out of the reel modules', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
      const text = readFileSync(join(dir, file), 'utf8');
      expect(text, file).not.toMatch(/from ['"]three['"]/);
      expect(text, file).not.toMatch(/@react-three/);
    }
  });
});
