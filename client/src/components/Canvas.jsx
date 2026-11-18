import { Eye } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectIsDrawer } from '../features/game/gameSlice';
import { useCanvas } from '../hooks/useCanvas';
import { messages } from '../lib/messages';

const RATIO = 4 / 3;

function Canvas() {
  const roomId = useSelector((state) => state.room.roomId);
  const isDrawer = useSelector(selectIsDrawer);
  const phase = useSelector((state) => state.game.phase);
  const drawerName = useSelector((state) => state.room.players.find((player) => player.id === state.game.drawerId)?.name);
  const { tool, color, size } = useSelector((state) => state.game);
  const { canvasRef, handlers, width, height } = useCanvas({ roomId, isDrawer, tool, color, size });
  const fitRef = useRef(null);
  const [fit, setFit] = useState({ width: 0, height: 0 });
  const [cursor, setCursor] = useState(null);
  const stateMessage = phase === 'WORD_SELECTION'
    ? messages.game.choosingWord(drawerName || messages.common.player)
    : phase === 'DRAWING'
      ? isDrawer ? messages.game.yourTurn : messages.game.playerDrawing(drawerName || messages.common.player)
      : '';

  useEffect(() => {
    const container = fitRef.current;
    if (!container) return undefined;
    let frame = 0;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const styles = window.getComputedStyle(container);
        const horizontalPadding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
        const verticalPadding = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
        const availableWidth = Math.max(1, container.clientWidth - horizontalPadding);
        const contentHeight = container.clientHeight - verticalPadding;
        const availableHeight = contentHeight > 1 ? contentHeight : availableWidth / RATIO;
        const fittedWidth = Math.min(availableWidth, availableHeight * RATIO);
        setFit({ width: Math.max(1, Math.floor(fittedWidth)), height: Math.max(1, Math.floor(fittedWidth / RATIO)) });
      });
    };
    resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(container);
    window.addEventListener('resize', resize, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  const cursorDiameter = useMemo(() => {
    if (!fit.width) return 8;
    return Math.max(6, Math.round((Number(size) || 7) * fit.width / width));
  }, [fit.width, size, width]);

  const moveCursor = (event) => {
    handlers.onPointerMove(event);
    if (!isDrawer || event.pointerType === 'touch') return;
    const nativeEvent = event.nativeEvent || event;
    if (Number.isFinite(nativeEvent.offsetX) && Number.isFinite(nativeEvent.offsetY)) {
      setCursor({ x: nativeEvent.offsetX, y: nativeEvent.offsetY });
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  return (
    <div ref={fitRef} className="relative flex h-full min-h-0 w-full min-w-0 items-center justify-center overflow-hidden rounded-2xl bg-violet-950/30 p-1.5 ring-1 ring-white/10">
      {stateMessage && (
        <span className="pointer-events-none absolute left-3 top-3 z-10 max-w-[calc(100%-1.5rem)] rounded-full border border-violet-200/25 bg-violet-950/85 px-3 py-1 text-center text-[11px] font-semibold leading-tight text-violet-100 shadow-lg backdrop-blur" role="status">
          {stateMessage}
        </span>
      )}
      <div
        className="relative max-h-full max-w-full overflow-hidden rounded-xl bg-canvas shadow-canvas ring-1 ring-black/10"
        style={{ width: fit.width || '100%', aspectRatio: '4 / 3' }}
      >
        <canvas
          ref={canvasRef}
          {...handlers}
          onPointerMove={moveCursor}
          onPointerEnter={moveCursor}
          onPointerLeave={() => setCursor(null)}
          width={width}
          height={height}
          className="canvas-grid block h-full w-full select-none"
          style={{ touchAction: isDrawer ? 'none' : 'pan-y', cursor: isDrawer ? 'none' : 'default' }}
          onContextMenu={(event) => { if (isDrawer) event.preventDefault(); }}
          aria-label={isDrawer ? messages.canvas.drawerLabel : messages.canvas.guesserLabel}
        />

        {isDrawer && cursor && (
          <span
            className={`pointer-events-none absolute rounded-full border shadow-sm ring-1 ring-slate-900/70 ${tool === 'eraser' ? 'border-slate-600 bg-white/45' : 'border-white/90'}`}
            style={{
              width: cursorDiameter,
              height: cursorDiameter,
              left: cursor.x - cursorDiameter / 2,
              top: cursor.y - cursorDiameter / 2,
              backgroundColor: tool === 'eraser' ? undefined : color,
            }}
            aria-hidden="true"
          />
        )}

        {!isDrawer && (
          <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full border border-violet-200/70 bg-violet-950/85 px-2.5 py-1 text-xs font-bold text-violet-100 shadow-lg backdrop-blur">
            <Eye aria-hidden="true" size={14} />
            {messages.canvas.watching}
          </span>
        )}
      </div>
    </div>
  );
}

export default memo(Canvas);
