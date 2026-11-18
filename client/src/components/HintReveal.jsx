import { memo } from 'react';
import { Lightbulb } from 'lucide-react';
import { BottomSheet, Button } from './ui';
import { messages } from '../lib/messages';

function HintReveal({ blanks, onDismiss }) {
  return (
    <BottomSheet title={messages.hint.title}>
      <Lightbulb className="mx-auto mt-3 h-8 w-8 text-amber-300" aria-hidden="true" />
      <p className="mt-2 text-center text-sm font-semibold text-violet-200">{messages.hint.text}</p>
      <p className="mt-4 break-words rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-4 text-center font-display text-3xl font-bold leading-tight tracking-[.18em] text-amber-200" aria-live="assertive">
        {blanks}
      </p>
      <Button full className="mt-4" onClick={onDismiss}>{messages.hint.keepGuessing}</Button>
    </BottomSheet>
  );
}

export default memo(HintReveal);
