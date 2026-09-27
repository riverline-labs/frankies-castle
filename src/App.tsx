import { Canvas } from '@react-three/fiber';
import { Component, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { PerspectiveCamera } from 'three';
import { duckWins, playGears, playWin, unlockAudio } from './game/audio';
import { spinTotalMs } from './game/motion';
import {
  BETS,
  JACKPOT_RATE,
  JACKPOT_RESET,
  START_BET,
  canAfford,
  playSpin,
  round2,
  spinGrid,
  type Bet,
  type Grid,
  type LineWin,
  type ResolvedSpin,
} from './game/reels';
import { loadBank, saveBank } from './game/storage';
import { layout } from './scene/layout';
import { Machine, configureRenderer } from './scene/Machine';
import { Hud } from './ui/Hud';
import { Vault } from './ui/Vault';

function usePhone(): boolean {
  const query = '(max-width: 820px), (max-height: 520px)';
  const [phone, setPhone] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const apply = () => setPhone(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);
  return phone;
}

class Boundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }
  render() {
    if (this.state.message) {
      return <div className="loading">The laboratory failed to wake. {this.state.message}</div>;
    }
    return this.props.children;
  }
}

export function App() {
  const saved = useRef(loadBank());
  const [balance, setBalance] = useState(saved.current.balance);
  const [jackpot, setJackpot] = useState(saved.current.jackpot);
  const [readyStore, setReadyStore] = useState(false);
  const [bet, setBet] = useState<Bet>(START_BET);
  const [grid, setGrid] = useState<Grid>(() => spinGrid());
  const [previous, setPrevious] = useState<Grid>(() => spinGrid());
  const [spinId, setSpinId] = useState(0);
  const [pullId, setPullId] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [lines, setLines] = useState<LineWin[]>([]);
  const [freeSpins, setFreeSpins] = useState(0);
  const [lastWin, setLastWin] = useState(0);
  const [banner, setBanner] = useState<ResolvedSpin['banner']>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [autoLeft, setAutoLeft] = useState(0);
  const [autoPick, setAutoPick] = useState<Bet | 0>(0);
  const [soundOn, setSoundOn] = useState(true);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const phone = usePhone();

  const balanceRef = useRef(balance);
  const jackpotRef = useRef(jackpot);
  const freeRef = useRef(freeSpins);
  const betRef = useRef(bet);
  const gridRef = useRef(grid);
  const spinningRef = useRef(false);
  const autoRef = useRef(0);
  const soundRef = useRef(true);
  const forced = useRef<Grid | null>(null);
  const finishTimer = useRef<number | null>(null);
  const bannerTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  balanceRef.current = balance;
  jackpotRef.current = jackpot;
  freeRef.current = freeSpins;
  betRef.current = bet;
  gridRef.current = grid;
  soundRef.current = soundOn;

  useEffect(() => {
    setReadyStore(true);
  }, []);
  useEffect(() => {
    if (readyStore) saveBank({ balance, jackpot });
  }, [readyStore, balance, jackpot]);

  useEffect(() => {
    const unlock = () => {
      void unlockAudio();
    };
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  const toastMsg = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  const showBanner = useCallback((next: ResolvedSpin['banner'], jackpotHit: boolean) => {
    if (bannerTimer.current) window.clearTimeout(bannerTimer.current);
    setBanner(next);
    if (!next) return;
    bannerTimer.current = window.setTimeout(() => setBanner(null), jackpotHit ? 4800 : 2400);
  }, []);

  const finish = useCallback(
    (outcome: ResolvedSpin) => {
      spinningRef.current = false;
      setSpinning(false);
      setLines(outcome.lines);
      setBalance((value) => value + outcome.payout);
      if (outcome.isJackpot) setJackpot(JACKPOT_RESET);
      if (outcome.freeSpinsAwarded) setFreeSpins((value) => value + outcome.freeSpinsAwarded);
      setLastWin(outcome.payout > 0 ? outcome.payout : 0);
      showBanner(outcome.banner, outcome.isJackpot);
      if (outcome.freeSpinsAwarded) toastMsg(`+${outcome.freeSpinsAwarded} free spins`);
      if (outcome.isJackpot) toastMsg('Jackpot');
      if (soundRef.current) void playWin(outcome.sound);
      if (autoRef.current > 0) {
        window.setTimeout(() => {
          if (autoRef.current <= 0 || spinningRef.current) return;
          autoRef.current -= 1;
          setAutoLeft(autoRef.current);
          spin();
        }, 700);
      }
    },
    [showBanner, toastMsg],
  );

  const spin = useCallback(() => {
    if (spinningRef.current) return false;
    const state = {
      balance: balanceRef.current,
      jackpot: jackpotRef.current,
      freeSpins: freeRef.current,
    };
    const stake = betRef.current;
    const nextGrid = forced.current ?? spinGrid(Math.random);
    forced.current = null;
    const outcome = playSpin(state, stake, nextGrid);
    if (!outcome) {
      autoRef.current = 0;
      setAutoLeft(0);
      setAutoPick(0);
      toastMsg('Out of tokens');
      return false;
    }
    const paid = state.freeSpins <= 0;
    spinningRef.current = true;
    setSpinning(true);
    setPrevious(gridRef.current.map((column) => [...column]));
    gridRef.current = outcome.grid;
    setGrid(outcome.grid);
    setSpinId((value) => value + 1);
    setPullId((value) => value + 1);
    setLines([]);
    showBanner(null, false);
    setLastWin(0);
    if (paid) {
      setBalance((value) => value - stake);
      setJackpot((value) => round2(value + round2(stake * JACKPOT_RATE)));
    } else {
      setFreeSpins((value) => value - 1);
    }
    if (soundRef.current) {
      duckWins();
      void playGears();
    }
    if (finishTimer.current) window.clearTimeout(finishTimer.current);
    finishTimer.current = window.setTimeout(() => finish(outcome), spinTotalMs());
    return true;
  }, [finish, showBanner, toastMsg]);

  const onSpin = useCallback(() => {
    if (autoRef.current > 0) {
      autoRef.current = 0;
      setAutoLeft(0);
      setAutoPick(0);
      return;
    }
    spin();
  }, [spin]);

  const armAuto = useCallback(
    (count: Bet) => {
      setAutoPick(count);
      if (spinningRef.current) {
        autoRef.current = count;
        setAutoLeft(count);
        return;
      }
      autoRef.current = count - 1;
      setAutoLeft(count - 1);
      spin();
    },
    [spin],
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__forceNextGrid = (next) => {
      forced.current = next;
    };
    return () => {
      delete window.__forceNextGrid;
    };
  }, []);

  const onReady = useCallback(() => setSceneReady(true), []);
  const betIndex = BETS.indexOf(bet);
  const afford = canAfford({ balance, jackpot, freeSpins }, bet);

  return (
    <div className="app">
      <Boundary>
        <Canvas
          dpr={[1, 1.75]}
          gl={{ antialias: true, alpha: false }}
          camera={{ position: [...layout.camera.position], fov: layout.camera.fov, near: 0.08, far: 40 }}
          onCreated={({ gl, camera }) => {
            configureRenderer(gl);
            (camera as PerspectiveCamera).lookAt(...layout.camera.target);
          }}
        >
          <Suspense fallback={null}>
            <Machine
              phone={phone}
              grid={grid}
              previous={previous}
              spinId={spinId}
              lines={lines}
              jackpot={jackpot}
              leverDisabled={!afford && autoLeft === 0}
              pullId={pullId}
              onPull={onSpin}
              onReady={onReady}
            />
          </Suspense>
        </Canvas>
      </Boundary>
      <Hud
        balance={balance}
        jackpot={jackpot}
        bet={bet}
        betIndex={betIndex}
        betCount={BETS.length}
        spinning={spinning}
        freeSpins={freeSpins}
        lastWin={lastWin}
        autoLeft={autoLeft}
        autoPick={autoPick}
        soundOn={soundOn}
        canSpin={!spinning && afford}
        onDec={() => setBet(BETS[Math.max(0, betIndex - 1)])}
        onInc={() => setBet(BETS[Math.min(BETS.length - 1, betIndex + 1)])}
        onSpin={onSpin}
        onAuto={armAuto}
        onToggleSound={() => setSoundOn((value) => !value)}
        onVault={() => setVaultOpen(true)}
      />
      {banner && (
        <div className={banner.jackpot ? 'banner jackpot' : 'banner'} data-testid="banner" role="status">
          <div className="banner-label">{banner.jackpot ? 'Jackpot' : 'Win'}</div>
          <div className="banner-amt">+{banner.amount.toLocaleString()}</div>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      <Vault
        open={vaultOpen}
        onClose={() => setVaultOpen(false)}
        onGrant={(tokens) => {
          setBalance((value) => value + tokens);
          setVaultOpen(false);
          toastMsg(`+${tokens.toLocaleString()} tokens`);
        }}
      />
      {!sceneReady && <div className="loading">Waking the laboratory…</div>}
      <div className="vignette" aria-hidden="true" />
    </div>
  );
}
