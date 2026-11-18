import { Eraser, Paintbrush, Trash2, Undo2 } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setColor, setSize, setTool } from '../features/game/gameSlice';
import { CANVAS_COLOR, DRAWING_COLORS } from '../lib/drawingPalette';
import { messages } from '../lib/messages';
import { socket } from '../lib/socket';
import { BottomSheet, Button, Tooltip } from './ui';

const sizes = [
  { value: 3, key: 'thin' },
  { value: 7, key: 'medium' },
  { value: 12, key: 'thick' },
  { value: 20, key: 'large' },
];

function Toolbar() {
  const dispatch = useDispatch();
  const roomId = useSelector((state) => state.room.roomId);
  const { tool, color, size } = useSelector((state) => state.game);
  const [showClear, setShowClear] = useState(false);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target?.isContentEditable) return;
      if (event.key.toLowerCase() === 'b') dispatch(setTool('brush'));
      if (event.key.toLowerCase() === 'e') dispatch(setTool('eraser'));
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        socket.emit('draw_undo', { roomId });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch, roomId]);

  const clear = () => {
    socket.emit('canvas_clear', { roomId });
    setShowClear(false);
  };

  const control = 'inline-flex h-11 min-h-11 w-11 min-w-11 shrink-0 items-center justify-center rounded-xl border text-violet-100 transition duration-150 hover:bg-white/10 active:scale-95 focus-visible:ring-2 focus-visible:ring-amber-300 disabled:opacity-40';

  return (
    <>
      <section data-game-toolbar className="shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-violet-950/55 p-2 shadow-xl backdrop-blur-xl" aria-label={messages.toolbar.label}>
        <div className="flex min-w-max items-center gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin] md:grid md:min-w-0 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start md:overflow-visible md:pb-0">
          <div className="flex shrink-0 gap-1.5" role="group" aria-label={messages.toolbar.label}>
            <Tooltip content={messages.toolbar.brush} side="bottom">
              <button
                type="button"
                className={`${control} ${tool === 'brush' ? 'border-amber-300 bg-amber-300/15 text-amber-200 ring-1 ring-amber-300/60' : 'border-white/10 bg-white/5'}`}
                aria-label={messages.toolbar.brush}
                title={messages.toolbar.brush}
                aria-keyshortcuts="B"
                aria-pressed={tool === 'brush'}
                onClick={() => dispatch(setTool('brush'))}
              >
                <Paintbrush aria-hidden="true" size={19} />
              </button>
            </Tooltip>
            <Tooltip content={messages.toolbar.eraser} side="bottom">
              <button
                type="button"
                className={`${control} ${tool === 'eraser' ? 'border-amber-300 bg-amber-300/15 text-amber-200 ring-1 ring-amber-300/60' : 'border-white/10 bg-white/5'}`}
                aria-label={messages.toolbar.eraser}
                title={messages.toolbar.eraser}
                aria-keyshortcuts="E"
                aria-pressed={tool === 'eraser'}
                onClick={() => dispatch(setTool('eraser'))}
              >
                <Eraser aria-hidden="true" size={19} />
              </button>
            </Tooltip>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 md:justify-center" role="group" aria-label={messages.toolbar.brushSize}>
            {sizes.map(({ value, key }) => {
              const label = messages.toolbar[key] || messages.toolbar.thick;
              return (
                <button
                  key={value}
                  type="button"
                  className={`${control} ${size === value ? 'border-violet-300 bg-violet-400/20 text-violet-100 ring-1 ring-violet-300' : 'border-white/10 bg-white/5 text-violet-300'}`}
                  aria-label={messages.toolbar.sizeLabel(label)}
                  title={messages.toolbar.sizeLabel(label)}
                  aria-pressed={size === value}
                  onClick={() => dispatch(setSize(value))}
                >
                  <span className="rounded-full bg-current" style={{ width: Math.max(5, value), height: Math.max(5, value) }} aria-hidden="true" />
                </button>
              );
            })}
          </div>

          <div className="flex shrink-0 gap-1.5 md:justify-end">
            <Tooltip content={messages.toolbar.undo}>
              <button
                type="button"
                className={`${control} border-white/10 bg-white/5`}
                aria-label={messages.toolbar.undo}
                title={messages.toolbar.undo}
                aria-keyshortcuts="Control+Z Meta+Z"
                onClick={() => socket.emit('draw_undo', { roomId })}
              >
                <Undo2 aria-hidden="true" size={19} />
              </button>
            </Tooltip>
            <Tooltip content={messages.toolbar.clear}>
              <button
                type="button"
                className={`${control} border-red-400/30 bg-red-400/10 text-red-200 hover:bg-red-400/20`}
                aria-label={messages.toolbar.clear}
                title={messages.toolbar.clear}
                onClick={() => setShowClear(true)}
              >
                <Trash2 aria-hidden="true" size={19} />
              </button>
            </Tooltip>
          </div>

          <div className="flex shrink-0 gap-1.5 md:col-span-3 md:grid md:grid-flow-col md:grid-rows-2 md:justify-center md:gap-1" role="group" aria-label={messages.toolbar.colors}>
            {DRAWING_COLORS.map((item) => (
              <button
                key={item}
                type="button"
                className={`h-11 min-h-11 w-11 min-w-11 shrink-0 rounded-xl border-2 shadow-sm transition duration-150 active:scale-90 focus-visible:ring-2 focus-visible:ring-amber-300 ${color === item && tool === 'brush' ? 'border-amber-300 ring-2 ring-amber-300/50' : item === CANVAS_COLOR ? 'border-slate-400' : 'border-white/20'}`}
                style={{ backgroundColor: item }}
                aria-label={messages.toolbar.useColor(messages.toolbar.colorNames[item])}
                title={messages.toolbar.useColor(messages.toolbar.colorNames[item])}
                aria-pressed={color === item && tool === 'brush'}
                onClick={() => dispatch(setColor(item))}
              />
            ))}
          </div>
        </div>
      </section>

      {showClear && (
        <BottomSheet title={messages.toolbar.clearTitle}>
          <p className="mt-3 text-center text-base leading-relaxed text-violet-200">{messages.toolbar.clearText}</p>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button full variant="secondary" onClick={() => setShowClear(false)}>{messages.common.cancel}</Button>
            <Button full variant="danger" onClick={clear}>{messages.toolbar.confirmClear}</Button>
          </div>
        </BottomSheet>
      )}
    </>
  );
}

export default memo(Toolbar);
