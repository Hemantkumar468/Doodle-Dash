import { Clock3, Sparkles } from 'lucide-react';
import { Button, BottomSheet } from './ui';
import { messages } from '../lib/messages';

export default function WordPicker({ options = [], seconds = 15, onPick }) {
  if (!options.length) return null;
  return (
    <BottomSheet title={messages.wordPicker.title} className="md:max-w-2xl">
      <div className="mx-auto mt-2 flex w-fit items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-sm font-semibold text-amber-200">
        <Clock3 className="h-4 w-4" aria-hidden="true" />
        <span>{messages.wordPicker.timer(seconds)}</span>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((word) => (
          <Button key={word} variant="secondary" full className="group min-h-20 flex-col break-words px-4 py-3" onClick={() => onPick(word)}>
            <span className="flex items-center gap-2 font-display text-xl font-bold"><Sparkles className="h-4 w-4 text-amber-300 transition-transform group-hover:rotate-12" aria-hidden="true" />{word}</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-violet-300">{messages.wordPicker.choice}</span>
          </Button>
        ))}
      </div>
    </BottomSheet>
  );
}
