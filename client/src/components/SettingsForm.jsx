import { useEffect, useState } from 'react';
import { messages } from '../lib/messages';
import { FormField, Segmented, Stepper, Toggle } from './ui';

const LIMIT = 2000;
const WORD_LIMIT = 40;

const ranges = [
  { key: 'maxPlayers', label: messages.settings.players, unit: messages.settings.maximum, min: 2, max: 20, step: 1 },
  { key: 'rounds', label: messages.settings.rounds, unit: messages.settings.perGame, min: 2, max: 10, step: 1 },
  { key: 'drawTime', label: messages.settings.drawTime, unit: messages.settings.seconds, min: 15, max: 240, step: 5 },
  { key: 'wordChoices', label: messages.settings.wordChoices, unit: messages.settings.options, min: 1, max: 5, step: 1 },
  { key: 'hints', label: messages.settings.hints, unit: messages.settings.letters, min: 0, max: 5, step: 1 },
];

export default function SettingsForm({ settings, editable, onChange }) {
  const [customWords, setCustomWords] = useState(settings.customWords || '');
  const [wordsTouched, setWordsTouched] = useState(false);

  useEffect(() => setCustomWords(settings.customWords || ''), [settings.customWords]);

  const change = (key, value) => onChange?.({ ...settings, [key]: value });
  const customWordsError = customWords.split(',').map((word) => word.trim()).some((word) => word.length > WORD_LIMIT)
    ? messages.validation.customWord(WORD_LIMIT)
    : '';
  const commitWords = () => {
    setWordsTouched(true);
    if (editable && !customWordsError && customWords !== (settings.customWords || '')) change('customWords', customWords);
  };

  const renderRange = ({ key, min, max, ...range }) => (
    <Stepper
      key={key}
      {...range}
      min={min}
      max={max}
      value={Number(settings[key])}
      disabled={!editable}
      error={Number(settings[key]) < min || Number(settings[key]) > max ? messages.validation.range(min, max) : ''}
      onChange={(value) => change(key, value)}
    />
  );

  return (
    <fieldset className="grid min-w-0 grid-cols-1 gap-3" disabled={!editable}>
      <legend className="sr-only">{messages.settings.legend}</legend>

      <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-violet-300">{messages.settings.basics || messages.settings.legend}</h3>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          {ranges.slice(0, 2).map(renderRange)}
        </div>
      </div>

      <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-violet-300">{messages.settings.gameplay || messages.settings.drawTime}</h3>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ranges.slice(2).map(renderRange)}
        </div>
      </div>

      <div className="min-w-0 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-300">{messages.settings.words || messages.settings.wordMode}</h3>
        <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-3">
          <Segmented
            label={messages.settings.wordMode}
            value={settings.wordMode}
            disabled={!editable}
            options={[
              { value: 'Normal', label: messages.settings.normal },
              { value: 'Hidden', label: messages.settings.hidden },
              { value: 'Combination', label: messages.settings.combo },
            ]}
            onChange={(value) => change('wordMode', value)}
          />
        </div>

        <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-3">
          <Toggle
            checked={!settings.isPrivate}
            disabled={!editable}
            label={settings.isPrivate ? messages.settings.privateRoom : messages.settings.publicRoom}
            description={settings.isPrivate ? messages.settings.privateHelp : messages.settings.publicHelp}
            onChange={(isPublic) => change('isPrivate', !isPublic)}
          />
        </div>

        <FormField
          as="textarea"
          className="rounded-xl border border-white/10 bg-white/[0.035] p-3"
          fieldClassName="mt-2 min-h-28 resize-y"
          label={<span className="flex min-w-0 flex-wrap items-baseline justify-between gap-2"><span>{messages.fields.customWords.label}</span><span className="shrink-0 whitespace-nowrap text-xs font-semibold tabular-nums text-violet-300">{messages.settings.counter(customWords.length, LIMIT)}</span></span>}
          helper={messages.fields.customWords.helper}
          error={wordsTouched ? customWordsError : ''}
          value={customWords}
          placeholder={messages.fields.customWords.placeholder}
          onChange={(event) => { setCustomWords(event.target.value); if (wordsTouched) setWordsTouched(true); }}
          onBlur={commitWords}
          maxLength={LIMIT}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck="false"
          inputMode="text"
          disabled={!editable}
        />
      </div>

      {!editable && (
        <p className="text-center text-sm font-medium text-violet-300" role="note">
          {messages.settings.readOnly}
        </p>
      )}
    </fieldset>
  );
}
