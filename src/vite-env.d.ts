/// <reference types="vite/client" />
/// <reference types="@react-three/fiber" />

import type { Grid } from './game/reels';

declare global {
  interface Window {
    __forceNextGrid?: (grid: Grid) => void;
  }
}
