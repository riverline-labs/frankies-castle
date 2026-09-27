import { useEffect, useState } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { SYMBOLS, SYMBOL_COLOR, type SymbolId } from '../game/reels';

function canvasTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

async function readyFonts(): Promise<void> {
  await document.fonts.load('700 92px Cinzel');
  await document.fonts.load('600 28px Cinzel');
  await document.fonts.load('600 22px "DM Sans"');
}

function drawMarquee(jackpot: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = '#10121c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#a68448';
  ctx.lineWidth = 10;
  ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);
  ctx.fillStyle = '#7dce4a';
  ctx.font = '700 86px Cinzel, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText("FRANKIE'S CASTLE", canvas.width / 2, 108);
  ctx.fillStyle = '#f0d48a';
  ctx.font = '600 26px Cinzel, serif';
  ctx.fillText('THE GALVANIC REELS', canvas.width / 2, 168);
  ctx.font = '600 20px Cinzel, serif';
  ctx.fillText('JACKPOT', canvas.width / 2, 230);
  ctx.fillStyle = '#f4efe2';
  ctx.font = '700 72px Cinzel, serif';
  ctx.fillText(Math.floor(jackpot).toLocaleString(), canvas.width / 2, 292);
  return canvas;
}

function payLabel(id: SymbolId, count: 3 | 4 | 5, value: number): string {
  if (id === 'frank' && count === 5) return 'JACK';
  if (id === 'crow' && count === 5) return 'FREE';
  if (id === 'crow') return '—';
  return `×${value}`;
}

function drawBelly(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 420;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = '#12141c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#8d7040';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  const rows = [...SYMBOLS].reverse();
  const col = canvas.width / rows.length;
  rows.forEach((symbol, index) => {
    const x = col * index + col / 2;
    ctx.fillStyle = SYMBOL_COLOR[symbol.id];
    ctx.beginPath();
    ctx.arc(x, 78, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f4efe2';
    ctx.font = '700 26px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol.name.toUpperCase(), x, 128);
    ([3, 4, 5] as const).forEach((count, row) => {
      ctx.font = '600 28px "DM Sans", sans-serif';
      ctx.fillStyle = '#f0d48a';
      ctx.fillText(`${count}  ${payLabel(symbol.id, count, symbol.pay[count])}`, x, 190 + row * 42);
    });
  });
  return canvas;
}

export function useMarqueeTexture(jackpot: number): CanvasTexture | null {
  const [texture, setTexture] = useState<CanvasTexture | null>(null);
  useEffect(() => {
    let cancel = false;
    readyFonts()
      .catch(() => undefined)
      .then(() => {
        if (cancel) return;
        const next = canvasTexture(drawMarquee(jackpot));
        setTexture((prev) => {
          prev?.dispose();
          return next;
        });
      });
    return () => {
      cancel = true;
    };
  }, [jackpot]);
  return texture;
}

export function useBellyTexture(): CanvasTexture | null {
  const [texture, setTexture] = useState<CanvasTexture | null>(null);
  useEffect(() => {
    let cancel = false;
    readyFonts()
      .catch(() => undefined)
      .then(() => {
        if (cancel) return;
        setTexture(canvasTexture(drawBelly()));
      });
    return () => {
      cancel = true;
    };
  }, []);
  return texture;
}
