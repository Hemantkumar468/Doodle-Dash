import { Download, Pause, Play, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CANVAS_COLOR, DEFAULT_DRAWING_COLOR } from '../lib/drawingPalette';
import { messages } from '../lib/messages';
import { Button } from './ui';

const WIDTH = 800;
const HEIGHT = 600;
const BASE_STEPS_PER_SECOND = 48;
const SPEEDS = [1, 2, 4];

function normalizedPoint(point) {
  if (Array.isArray(point)) return { x: Number(point[0]) || 0, y: Number(point[1]) || 0 };
  return { x: Number(point?.x) || 0, y: Number(point?.y) || 0 };
}

function buildSteps(strokes) {
  const steps = [];
  for (const stroke of Array.isArray(strokes) ? strokes : []) {
    const points = (Array.isArray(stroke?.points) ? stroke.points : []).map(normalizedPoint);
    if (!points.length) continue;
    if (points.length === 1) {
      steps.push({ type: 'dot', stroke, point: points[0] });
      continue;
    }
    for (let index = 1; index < points.length; index += 1) {
      steps.push({ type: 'line', stroke, from: points[index - 1], to: points[index] });
    }
  }
  return steps;
}

function prepareContext(ctx, stroke) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, Number(stroke?.size) || 7);
  ctx.globalCompositeOperation = stroke?.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = stroke?.color || DEFAULT_DRAWING_COLOR;
  ctx.fillStyle = stroke?.color || DEFAULT_DRAWING_COLOR;
}

function drawStep(ctx, step) {
  if (!ctx || !step) return;
  ctx.save();
  prepareContext(ctx, step.stroke);
  if (step.type === 'dot') {
    ctx.beginPath();
    ctx.arc(step.point.x * WIDTH, step.point.y * HEIGHT, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(step.from.x * WIDTH, step.from.y * HEIGHT);
    ctx.lineTo(step.to.x * WIDTH, step.to.y * HEIGHT);
    ctx.stroke();
  }
  ctx.restore();
}

function clearCanvas(ctx) {
  if (!ctx) return;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = CANVAS_COLOR;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.restore();
}

function safeDate(value) {
  const date = value ? new Date(value) : new Date();
  const valid = Number.isNaN(date.getTime()) ? new Date() : date;
  return [valid.getFullYear(), String(valid.getMonth() + 1).padStart(2, '0'), String(valid.getDate()).padStart(2, '0')].join('-');
}

function safeWord(value) {
  return String(value || 'drawing')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'drawing';
}

export default function ReplayCanvas({
  strokes = [],
  word = '',
  endedAt,
  labels = {},
  className = '',
}) {
  const copy = { ...(messages.history?.replay || {}), ...labels };
  const canvasRef = useRef(null);
  const steps = useMemo(() => buildSteps(strokes), [strokes]);
  const stepsRef = useRef(steps);
  const currentRef = useRef(0);
  const speedRef = useRef(1);
  const frameRef = useRef(0);
  const lastFrameRef = useRef(0);
  const carryRef = useRef(0);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const context = useCallback(() => canvasRef.current?.getContext('2d') || null, []);
  const drawThrough = useCallback((count, targetContext = context()) => {
    if (!targetContext) return;
    clearCanvas(targetContext);
    for (let index = 0; index < Math.min(count, stepsRef.current.length); index += 1) {
      drawStep(targetContext, stepsRef.current[index]);
    }
  }, [context]);

  useEffect(() => {
    stepsRef.current = steps;
    currentRef.current = 0;
    setProgress(0);
    setPlaying(false);
    drawThrough(0);
  }, [drawThrough, steps]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    if (!playing || !stepsRef.current.length) return undefined;
    lastFrameRef.current = 0;
    carryRef.current = 0;

    const tick = (timestamp) => {
      if (!lastFrameRef.current) lastFrameRef.current = timestamp;
      const elapsed = Math.max(0, timestamp - lastFrameRef.current);
      lastFrameRef.current = timestamp;
      carryRef.current += elapsed * BASE_STEPS_PER_SECOND * speedRef.current / 1000;
      const advance = Math.floor(carryRef.current);
      if (advance > 0) {
        carryRef.current -= advance;
        const next = Math.min(stepsRef.current.length, currentRef.current + advance);
        const ctx = context();
        for (let index = currentRef.current; index < next; index += 1) drawStep(ctx, stepsRef.current[index]);
        currentRef.current = next;
        setProgress(next);
        if (next >= stepsRef.current.length) {
          setPlaying(false);
          return;
        }
      }
      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameRef.current);
  }, [context, playing]);

  const play = () => {
    if (currentRef.current >= stepsRef.current.length) {
      currentRef.current = 0;
      setProgress(0);
      drawThrough(0);
    }
    setPlaying(true);
  };

  const restart = () => {
    setPlaying(false);
    currentRef.current = 0;
    setProgress(0);
    drawThrough(0);
  };

  const seek = (event) => {
    const next = Math.max(0, Math.min(stepsRef.current.length, Number(event.target.value) || 0));
    setPlaying(false);
    currentRef.current = next;
    setProgress(next);
    drawThrough(next);
  };

  const saveImage = () => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = WIDTH;
    exportCanvas.height = HEIGHT;
    const exportContext = exportCanvas.getContext('2d');
    drawThrough(stepsRef.current.length, exportContext);
    if (exportContext) {
      exportContext.save();
      exportContext.globalCompositeOperation = 'destination-over';
      exportContext.fillStyle = CANVAS_COLOR;
      exportContext.fillRect(0, 0, WIDTH, HEIGHT);
      exportContext.restore();
    }
    exportCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `drawing-${safeWord(word)}-${safeDate(endedAt)}.png`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    }, 'image/png');
  };

  if (!steps.length) {
    return <p className={`rounded-xl border border-dashed border-white/15 bg-white/[.035] p-4 text-center text-sm font-semibold text-violet-200 ${className}`} role="status">{copy.unavailable}</p>;
  }

  const percent = Math.round(progress / steps.length * 100);
  return (
    <section className={`min-w-0 space-y-3 ${className}`} aria-label={copy.region}>
      <div className="overflow-hidden rounded-xl bg-canvas shadow-canvas ring-1 ring-black/10">
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="block aspect-[4/3] h-auto w-full touch-pan-y" aria-label={copy.canvas} />
      </div>

      <div className="grid min-w-0 gap-3 rounded-xl border border-white/10 bg-white/[.045] p-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={playing ? () => setPlaying(false) : play} aria-label={playing ? copy.pause : copy.play}>
            {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
            {playing ? copy.pause : copy.play}
          </Button>
          <Button size="sm" variant="ghost" onClick={restart} aria-label={copy.restart}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {copy.restart}
          </Button>
          <Button size="sm" variant="secondary" className="ml-auto" onClick={saveImage} aria-label={copy.saveImage}>
            <Download className="h-4 w-4" aria-hidden="true" />
            {copy.saveImage}
          </Button>
        </div>

        <div className="flex min-w-0 items-center gap-3">
          <input
            type="range"
            min="0"
            max={steps.length}
            step="1"
            value={progress}
            onChange={seek}
            className="h-11 min-w-0 flex-1 cursor-pointer accent-violet-400"
            aria-label={copy.progress}
            style={{ touchAction: 'pan-x' }}
          />
          <span className="w-10 shrink-0 text-right text-xs font-bold tabular-nums text-violet-200" aria-live="polite">{percent}%</span>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2" role="group" aria-label={copy.speed}>
          <span className="w-full text-xs font-semibold text-violet-200 sm:mr-auto sm:w-auto">{copy.speed}</span>
          {SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              className={`min-h-11 min-w-11 flex-1 rounded-xl border px-2 text-sm font-bold transition focus-visible:ring-2 focus-visible:ring-amber-300 sm:flex-none ${speed === value ? 'border-violet-300 bg-violet-400/20 text-white' : 'border-white/10 bg-white/5 text-violet-200 hover:bg-white/10'}`}
              aria-label={copy.speedOption?.(value)}
              aria-pressed={speed === value}
              onClick={() => setSpeed(value)}
            >
              {copy.speedOption?.(value)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
