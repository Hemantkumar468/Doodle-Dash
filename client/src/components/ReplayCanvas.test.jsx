import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReplayCanvas from './ReplayCanvas';

const labels = {
  region: 'Drawing replay',
  canvas: 'Saved drawing',
  unavailable: "The drawing for this turn wasn't saved.",
  play: 'Play',
  pause: 'Pause',
  restart: 'Restart',
  saveImage: 'Save as image',
  progress: 'Replay progress',
  speed: 'Playback speed',
  speedOption: (value) => `Play at ${value} times speed`,
};

function contextMock() {
  return {
    save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fillRect: vi.fn(),
    lineCap: '', lineJoin: '', lineWidth: 0, globalCompositeOperation: '', strokeStyle: '', fillStyle: '',
  };
}

describe('ReplayCanvas', () => {
  let context;
  let frames;
  let downloadedAs;

  beforeEach(() => {
    context = contextMock();
    frames = [];
    downloadedAs = '';
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['png'], { type: 'image/png' })));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function rememberDownload() { downloadedAs = this.download; });
    window.requestAnimationFrame = vi.fn((callback) => { frames.push(callback); return frames.length; });
    window.cancelAnimationFrame = vi.fn();
    URL.createObjectURL = vi.fn(() => 'blob:replay');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => vi.restoreAllMocks());

  it('shows the friendly unavailable state when no drawing was saved', () => {
    render(<ReplayCanvas strokes={[]} labels={labels} />);
    expect(screen.getByText(labels.unavailable)).toBeInTheDocument();
  });

  it('draws saved strokes and exposes playback controls without errors', () => {
    const strokes = [
      { color: '#ef4444', size: 7, tool: 'brush', points: [[0.1, 0.2], [0.5, 0.6], [0.8, 0.7]] },
      { color: '#111827', size: 12, tool: 'eraser', points: [[0.4, 0.4]] },
    ];
    render(<ReplayCanvas strokes={strokes} word="Red Apple" endedAt="2026-11-19T10:00:00.000Z" labels={labels} />);

    fireEvent.change(screen.getByRole('slider', { name: labels.progress }), { target: { value: '3' } });
    expect(context.lineTo).toHaveBeenCalled();
    expect(context.arc).toHaveBeenCalled();
    expect(screen.getByText('100%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: labels.restart }));
    expect(screen.getByText('0%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: labels.play }));
    expect(screen.getByRole('button', { name: labels.pause })).toBeInTheDocument();
    act(() => {
      frames.shift()?.(1);
      frames.shift()?.(1001);
    });

    fireEvent.click(screen.getByRole('button', { name: labels.speedOption(2) }));
    expect(screen.getByRole('button', { name: labels.speedOption(2) })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: labels.saveImage }));
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(downloadedAs).toBe('drawing-red-apple-2026-11-19.png');
  });
});
