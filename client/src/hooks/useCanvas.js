import { useCallback, useEffect, useRef } from 'react';
import { cacheCanvasHistory, readCanvasHistory, subscribeCanvasHistory } from '../lib/canvasHistory';
import { CANVAS_COLOR, DEFAULT_DRAWING_COLOR } from '../lib/drawingPalette';
import { socket } from '../lib/socket';

const WIDTH = 800;
const HEIGHT = 600;

function pointFromEvent(rect, event) {
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
  };
}

function renderStroke(ctx, stroke) {
  const points = Array.isArray(stroke?.points) ? stroke.points : [];
  if (!points.length) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Number(stroke.size) || 7;
  ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = stroke.color || DEFAULT_DRAWING_COLOR;
  ctx.fillStyle = stroke.color || DEFAULT_DRAWING_COLOR;
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x * WIDTH, points[0].y * HEIGHT, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(points[0].x * WIDTH, points[0].y * HEIGHT);
    for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x * WIDTH, points[index].y * HEIGHT);
    ctx.stroke();
  }
  ctx.restore();
}

function blank(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = CANVAS_COLOR;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.restore();
}

export function useCanvas({ roomId, isDrawer, tool, color, size }) {
  const canvasRef = useRef(null);
  const strokesRef = useRef(readCanvasHistory());
  const activeRef = useRef(null);
  const activePointerRef = useRef(null);
  const activeRectRef = useRef(null);
  const lastSentRef = useRef(0);

  const context = useCallback(() => canvasRef.current?.getContext('2d') || null, []);
  const redraw = useCallback((strokes = strokesRef.current) => {
    const ctx = context();
    if (!ctx) return;
    blank(ctx);
    strokes.forEach((stroke) => renderStroke(ctx, stroke));
  }, [context]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let frame = 0;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const pixelWidth = Math.round(WIDTH * dpr);
        const pixelHeight = Math.round(HEIGHT * dpr);
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
          canvas.width = pixelWidth;
          canvas.height = pixelHeight;
        }
        const ctx = canvas.getContext('2d');
        ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
        redraw();
      });
    };
    resize();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);
    if (canvas.parentElement) observer?.observe(canvas.parentElement);
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('orientationchange', resize, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
    };
  }, [redraw]);

  useEffect(() => subscribeCanvasHistory((nextHistory) => {
    // Preserve the drawer's richer local samples if a hint snapshot arrives
    // while the pointer is still down.
    if (isDrawer && activeRef.current) return;
    const activeId = activeRef.current?.id;
    strokesRef.current = nextHistory;
    activeRef.current = activeId
      ? strokesRef.current.find((stroke) => stroke.id === activeId) || null
      : null;
    redraw();
  }), [isDrawer, redraw]);

  useEffect(() => {
    const receive = (payload = {}) => {
      const action = String(payload.action || payload.type || payload.event || '').replace('draw_', '');
      const point = payload.point || (payload.x !== undefined ? { x: payload.x, y: payload.y } : null);
      if (action === 'start') {
        const stroke = payload.stroke || { id: payload.id || payload.strokeId, tool: payload.tool, color: payload.color, size: payload.size, points: Array.isArray(payload.points) ? payload.points : point ? [point] : [] };
        activeRef.current = stroke;
        strokesRef.current.push(stroke);
        renderStroke(context(), stroke);
      } else if (action === 'move' && point) {
        let stroke = activeRef.current;
        if (payload.strokeId && stroke?.id !== payload.strokeId) {
          stroke = strokesRef.current.find((item) => item.id === payload.strokeId) || null;
          activeRef.current = stroke;
        }
        if (!stroke) {
          stroke = { id: payload.strokeId, tool: payload.tool, color: payload.color, size: payload.size, points: [] };
          activeRef.current = stroke;
          strokesRef.current.push(stroke);
        }
        const previous = stroke.points.at(-1);
        stroke.points.push(point);
        if (previous) renderStroke(context(), { ...stroke, points: [previous, point] });
      } else if (action === 'end') {
        activeRef.current = null;
      } else if (payload.stroke) {
        strokesRef.current.push(payload.stroke);
        renderStroke(context(), payload.stroke);
      }
      cacheCanvasHistory(strokesRef.current);
    };
    const clear = () => { strokesRef.current = []; activeRef.current = null; cacheCanvasHistory([]); redraw([]); };
    const undo = (payload) => {
      if (Array.isArray(payload?.strokeHistory)) strokesRef.current = payload.strokeHistory;
      else strokesRef.current.pop();
      activeRef.current = null;
      cacheCanvasHistory(strokesRef.current);
      redraw();
    };
    socket.on('draw_data', receive);
    socket.on('canvas_clear', clear);
    socket.on('draw_undo', undo);
    return () => { socket.off('draw_data', receive); socket.off('canvas_clear', clear); socket.off('draw_undo', undo); };
  }, [context, redraw]);

  const start = (event) => {
    if (!isDrawer || event.button > 0 || activePointerRef.current !== null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerRef.current = event.pointerId;
    activeRectRef.current = event.currentTarget.getBoundingClientRect();
    const point = pointFromEvent(activeRectRef.current, event);
    const strokeId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const stroke = { id: strokeId, tool, color, size, points: [point] };
    activeRef.current = stroke;
    strokesRef.current.push(stroke);
    cacheCanvasHistory(strokesRef.current);
    renderStroke(context(), stroke);
    socket.emit('draw_start', { roomId, strokeId, ...point, tool, color, size });
  };
  const move = (event) => {
    if (!isDrawer || !activeRef.current || event.pointerId !== activePointerRef.current) return;
    event.preventDefault();
    const events = event.getCoalescedEvents?.() || [event];
    const rect = activeRectRef.current || event.currentTarget.getBoundingClientRect();
    for (const sample of events) {
      const point = pointFromEvent(rect, sample);
      const previous = activeRef.current.points.at(-1);
      activeRef.current.points.push(point);
      if (previous) renderStroke(context(), { ...activeRef.current, points: [previous, point] });
    }
    cacheCanvasHistory(strokesRef.current);
    const now = performance.now();
    if (now - lastSentRef.current >= 20) {
      const point = activeRef.current.points.at(-1);
      socket.emit('draw_move', { roomId, strokeId: activeRef.current.id, ...point });
      lastSentRef.current = now;
    }
  };
  const end = (event) => {
    if (!isDrawer || !activeRef.current || event.pointerId !== activePointerRef.current) return;
    event.preventDefault();
    const point = event.type === 'pointercancel'
      ? activeRef.current.points.at(-1)
      : pointFromEvent(activeRectRef.current || event.currentTarget.getBoundingClientRect(), event);
    const previous = activeRef.current.points.at(-1);
    activeRef.current.points.push(point);
    cacheCanvasHistory(strokesRef.current);
    if (previous) renderStroke(context(), { ...activeRef.current, points: [previous, point] });
    socket.emit('draw_move', { roomId, strokeId: activeRef.current.id, ...point });
    socket.emit('draw_end', { roomId, strokeId: activeRef.current.id, ...point });
    activeRef.current = null;
    activePointerRef.current = null;
    activeRectRef.current = null;
  };

  return { canvasRef, handlers: { onPointerDown: start, onPointerMove: move, onPointerUp: end, onPointerCancel: end }, width: WIDTH, height: HEIGHT };
}
