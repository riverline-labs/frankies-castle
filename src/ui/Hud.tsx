import type { Bet } from '../game/reels';

export function Hud({
  balance,
  jackpot,
  bet,
  betIndex,
  betCount,
  spinning,
  freeSpins,
  lastWin,
  autoLeft,
  autoPick,
  soundOn,
  canSpin,
  onDec,
  onInc,
  onSpin,
  onAuto,
  onToggleSound,
  onVault,
}: {
  balance: number;
  jackpot: number;
  bet: number;
  betIndex: number;
  betCount: number;
  spinning: boolean;
  freeSpins: number;
  lastWin: number;
  autoLeft: number;
  autoPick: Bet | 0;
  soundOn: boolean;
  canSpin: boolean;
  onDec: () => void;
  onInc: () => void;
  onSpin: () => void;
  onAuto: (count: Bet) => void;
  onToggleSound: () => void;
  onVault: () => void;
}) {
  const pullLabel = autoLeft > 0 ? 'Stop' : spinning ? '···' : freeSpins > 0 ? 'Free' : 'Pull';
  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brand-name">Frankie's Castle</div>
          <div className="brand-sub">the galvanic reels</div>
        </div>
        <div className="jackpot-readout" data-testid="jackpot">
          <span>Jackpot</span>
          <strong>{Math.floor(jackpot).toLocaleString()}</strong>
        </div>
        <div className="purse">
          <div className="balance" data-testid="balance">
            <span className="coin" aria-hidden="true">F</span>
            <span className="amount">{Math.floor(balance).toLocaleString()}</span>
            <span className="unit">tokens</span>
          </div>
          <button type="button" className="text-btn" onClick={onVault}>
            Voltage Vault
          </button>
          <button type="button" className="text-btn" aria-pressed={soundOn} onClick={onToggleSound}>
            {soundOn ? 'Sound on' : 'Sound off'}
          </button>
        </div>
      </header>
      <footer className="deck">
        <div className="bet">
          <button type="button" onClick={onDec} disabled={spinning || betIndex <= 0} aria-label="Lower bet">
            −
          </button>
          <div>
            <span>Bet</span>
            <strong data-testid="bet">{bet}</strong>
          </div>
          <button type="button" onClick={onInc} disabled={spinning || betIndex >= betCount - 1} aria-label="Raise bet">
            +
          </button>
        </div>
        <button
          type="button"
          className="pull"
          data-testid="spin"
          onClick={onSpin}
          disabled={!canSpin && autoLeft === 0}
        >
          {pullLabel}
        </button>
        <div className="stat" data-testid="free-spins">
          <span>Free spins</span>
          <strong>{freeSpins}</strong>
        </div>
        <div className="stat" data-testid="last-win">
          <span>Last win</span>
          <strong>{lastWin > 0 ? `+${lastWin.toLocaleString()}` : '—'}</strong>
        </div>
        <div className="auto">
          <span>Auto</span>
          {([10, 25, 50] as const).map((count) => (
            <button
              key={count}
              type="button"
              data-testid={`auto-${count}`}
              aria-pressed={autoLeft > 0 && autoPick === count}
              onClick={() => onAuto(count)}
            >
              ×{count}
            </button>
          ))}
          {autoLeft > 0 && <em data-testid="auto-left">{autoLeft} left</em>}
        </div>
      </footer>
    </>
  );
}
