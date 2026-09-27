import { START_BALANCE, START_JACKPOT } from './reels';

export const STORAGE_KEY = 'frankies-castle';

export interface SavedBank {
  balance: number;
  jackpot: number;
}

function browserStore(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadBank(): SavedBank {
  const fallback = { balance: START_BALANCE, jackpot: START_JACKPOT };
  const store = browserStore();
  if (!store) return fallback;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const data = JSON.parse(raw) as Partial<SavedBank>;
    const balance = Number(data.balance);
    const jackpot = Number(data.jackpot);
    if (!Number.isFinite(balance) || balance < 0) return fallback;
    if (!Number.isFinite(jackpot) || jackpot < 0) return fallback;
    return { balance, jackpot };
  } catch {
    return fallback;
  }
}

export function saveBank(bank: SavedBank): void {
  const store = browserStore();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(bank));
  } catch {
    // Private mode can refuse the write. The session still plays.
  }
}
