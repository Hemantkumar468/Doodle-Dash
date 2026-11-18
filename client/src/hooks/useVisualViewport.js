import { useEffect } from 'react';

/** Publishes keyboard-safe measurements while the document keeps its dvh layout. */
export function useVisualViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = viewport?.height || window.innerHeight;
        const offsetTop = viewport?.offsetTop || 0;
        const keyboardInset = Math.max(0, window.innerHeight - height - offsetTop);
        root.style.setProperty('--visual-viewport-height', `${height}px`);
        root.style.setProperty('--visual-viewport-offset', `${offsetTop}px`);
        root.style.setProperty('--keyboard-inset', `${keyboardInset}px`);

        const focused = document.activeElement;
        if (focused?.matches?.('[data-keyboard-anchor]')) {
          focused.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      });
    };

    update();
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('orientationchange', update, { passive: true });
    viewport?.addEventListener('resize', update, { passive: true });
    viewport?.addEventListener('scroll', update, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      root.style.removeProperty('--visual-viewport-height');
      root.style.removeProperty('--visual-viewport-offset');
      root.style.removeProperty('--keyboard-inset');
    };
  }, []);
}
