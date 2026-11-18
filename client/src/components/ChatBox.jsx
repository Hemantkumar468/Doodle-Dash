import { MessageCircle, Send } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { guessNotice, noticeCleared, setActiveTab } from '../features/chat/chatSlice';
import { selectIsDrawer } from '../features/game/gameSlice';
import { getErrorCode, getFriendlyError, messages } from '../lib/messages';
import { safeText } from '../lib/safeText';
import { emitSocket } from '../middleware/socketMiddleware';
import PlayerList from './PlayerList';
import { Button, FormField, Tabs, Toast } from './ui';

function ChatBox({ mobileTabs = false }) {
  const dispatch = useDispatch();
  const [text, setText] = useState('');
  const [validationError, setValidationError] = useState('');
  const [playersUnread, setPlayersUnread] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const refocusAfterSendRef = useRef(false);
  const priorPlayersRef = useRef('');
  const { messages: chatMessages, notice, unread, activeTab } = useSelector((state) => state.chat);
  const roomId = useSelector((state) => state.room.roomId);
  const selfId = useSelector((state) => state.session.playerId);
  const players = useSelector((state) => state.room.players);
  const self = players.find((player) => player.id === selfId);
  const playerSignature = players.map((player) => `${player.id}:${player.score}:${player.isConnected}:${player.hasGuessed}`).join('|');
  const phase = useSelector((state) => state.game.phase);
  const isDrawer = useSelector(selectIsDrawer);
  const disabled = isDrawer || phase !== 'DRAWING';

  const scrollLatest = useCallback((behavior = 'auto') => {
    requestAnimationFrame(() => {
      const list = listRef.current;
      if (list) list.scrollTo({ top: list.scrollHeight, behavior });
    });
  }, []);

  const keepInputVisible = useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (activeTab === 'chat') {
      scrollLatest(reduceMotion ? 'auto' : 'smooth');
      if (document.activeElement === inputRef.current) keepInputVisible();
    }
  }, [chatMessages, activeTab, keepInputVisible, scrollLatest]);

  useEffect(() => {
    if (priorPlayersRef.current && priorPlayersRef.current !== playerSignature && activeTab !== 'players') setPlayersUnread(true);
    priorPlayersRef.current = playerSignature;
    if (activeTab === 'players') setPlayersUnread(false);
  }, [activeTab, playerSignature]);

  useEffect(() => {
    if (text !== '' || disabled || !refocusAfterSendRef.current) return;
    inputRef.current?.focus();
    scrollLatest('auto');
    keepInputVisible();
    refocusAfterSendRef.current = false;
  }, [disabled, keepInputVisible, scrollLatest, text]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const keepVisible = () => {
      scrollLatest('auto');
      if (document.activeElement === inputRef.current) keepInputVisible();
    };
    viewport?.addEventListener('resize', keepVisible, { passive: true });
    viewport?.addEventListener('scroll', keepVisible, { passive: true });
    return () => {
      viewport?.removeEventListener('resize', keepVisible);
      viewport?.removeEventListener('scroll', keepVisible);
    };
  }, [keepInputVisible, scrollLatest]);

  const switchTab = (tab) => {
    dispatch(setActiveTab(tab));
    if (tab === 'players') setPlayersUnread(false);
  };

  const send = (event) => {
    event.preventDefault();
    const value = text.trim();
    if (disabled) return;
    if (!value) {
      if (!self?.hasGuessed) setValidationError(messages.validation.guessEmpty);
      return;
    }
    setValidationError('');
    const socketEvent = self?.hasGuessed ? 'chat' : 'guess';
    const ack = socketEvent === 'guess' ? (response) => {
      if (response?.correct) dispatch(guessNotice({ ...response, playerId: selfId, name: self?.name }));
      else if (response?.error || response?.ok === false) {
        const failure = response?.error || response;
        dispatch(guessNotice({ code: failure?.code || '', message: getFriendlyError(failure) }));
      }
    } : undefined;
    dispatch(emitSocket(socketEvent, { roomId, text: value }, ack));
    refocusAfterSendRef.current = true;
    setText('');
  };

  const tabs = [
    { value: 'chat', label: messages.chat.tab, unread: unread > 0 },
    { value: 'players', label: messages.chat.playersTab, unread: playersUnread },
  ];
  const inputLabel = self?.hasGuessed ? messages.fields.chat.label : messages.fields.guess.label;
  const noticeText = !notice
    ? ''
    : notice.close
      ? messages.chat.closeGuess
      : notice.correct
        ? notice.playerId === selfId && Number.isFinite(Number(notice.delta))
          ? messages.chat.correctYou(Number(notice.delta))
          : messages.chat.correctOther(notice.name || self?.name || messages.chat.defaultPlayer)
        : getFriendlyError(notice);
  const noticeCanRetry = notice
    && !notice.correct
    && !notice.close
    && !['RATE_LIMITED', 'CANNOT_GUESS', 'NOT_DRAWER'].includes(getErrorCode(notice));
  const retryNotice = () => {
    dispatch(noticeCleared());
    inputRef.current?.focus();
    keepInputVisible();
  };

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-violet-950/45 shadow-xl backdrop-blur-xl" aria-label={messages.chat.panelLabel}>
      <div className="hidden h-12 shrink-0 items-center gap-2 border-b border-white/10 px-3 lg:flex">
        <MessageCircle className="text-violet-300" aria-hidden="true" size={18} />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-violet-200">{messages.chat.tab}</h2>
      </div>

      {mobileTabs && <Tabs tabs={tabs} value={activeTab} onChange={switchTab} label={messages.chat.tabsLabel} className="m-2 mb-0 shrink-0 lg:hidden" />}

      {mobileTabs && activeTab === 'players' && (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2.5 lg:hidden" role="tabpanel" aria-label={messages.chat.playersPanel}>
          <PlayerList />
        </div>
      )}

      <div className={`${mobileTabs && activeTab === 'players' ? 'hidden lg:flex' : 'flex'} min-h-0 flex-1 flex-col`} role="tabpanel" aria-label={messages.chat.chatPanel}>
        <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-2.5" role="log" aria-live="polite" aria-relevant="additions">
          {!chatMessages.length && (
            <div className="flex h-full min-h-12 flex-col items-center justify-center px-3 text-center text-violet-300">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10" aria-hidden="true">
                <MessageCircle size={20} />
              </span>
              <p className="mt-2 text-sm font-semibold leading-snug text-violet-100">{messages.chat.emptyTitle}</p>
              <p className="mt-0.5 text-xs leading-snug text-violet-300">{messages.chat.emptyHint}</p>
            </div>
          )}

          {chatMessages.map((message, index) => {
            const system = message.type === 'system' || !message.playerId;
            const name = message.name || message.playerName || messages.chat.defaultPlayer;
            return system ? (
              <div key={message.id || `${message.createdAt || message.timestamp || 0}-${index}`} className="mx-auto max-w-[95%] rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-center text-xs font-semibold leading-snug text-emerald-200">
                <span className="break-words">{messages.chat.correctOther(name)}</span>
              </div>
            ) : (
              <div key={message.id || `${message.createdAt || message.timestamp || 0}-${index}`} className="flex min-w-0 items-start gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-400/20 text-[11px] font-bold uppercase text-violet-100 ring-1 ring-violet-300/20" aria-hidden="true">
                  {String(name).trim().charAt(0)}
                </span>
                <div className="min-w-0 rounded-2xl rounded-tl-md bg-white/[.07] px-3 py-2 text-sm leading-snug text-violet-100 ring-1 ring-white/[.06]">
                  <span className="mr-1.5 font-semibold text-white">{name}</span>
                  <span className="break-words text-violet-200">{safeText(message.text)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {notice && (
          <Toast tone={notice.correct ? 'success' : notice.close ? 'warning' : 'error'} className="mx-2 mb-1 shrink-0 py-2 text-center" onDismiss={() => dispatch(noticeCleared())} action={noticeCanRetry ? <Button variant="secondary" className="shrink-0 !px-3" onClick={retryNotice}>{messages.common.tryAgain}</Button> : null}>
            {noticeText}
          </Toast>
        )}

        <form className="shrink-0 border-t border-white/10 bg-violet-950/70 p-2 pb-[max(.5rem,env(safe-area-inset-bottom))]" onSubmit={send}>
          {isDrawer && <p className="game-drawer-hint mb-1 text-center text-[11px] font-medium text-violet-300">{messages.chat.drawerHint}</p>}
          <FormField id="game-message" label={inputLabel} error={validationError} className="[&>label]:sr-only">
            <div className="flex min-w-0 items-center gap-2">
              <textarea
                ref={inputRef}
                id="game-message"
                data-keyboard-anchor
                className="min-h-12 min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-white/[.06] px-3 py-2 text-base leading-snug text-white placeholder:text-violet-300 focus:border-violet-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:bg-white/[.035] disabled:text-violet-400"
                rows={1}
                value={text}
                onChange={(event) => { setText(event.target.value); if (event.target.value.trim()) setValidationError(''); }}
                onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) send(event); }}
                onBlur={() => { if (!disabled && !self?.hasGuessed && !text.trim()) setValidationError(messages.validation.guessEmpty); }}
                onFocus={() => { scrollLatest('auto'); keepInputVisible(); }}
                placeholder={isDrawer ? messages.chat.drawerPlaceholder : phase === 'DRAWING' ? self?.hasGuessed ? messages.chat.guessedPlaceholder : messages.chat.guessPlaceholder : messages.chat.waitingPlaceholder}
                disabled={disabled}
                maxLength={100}
                inputMode="text"
                autoComplete="off"
                autoCapitalize="sentences"
                enterKeyHint="send"
                aria-label={inputLabel}
                aria-invalid={Boolean(validationError)}
                aria-describedby={validationError ? 'game-message-error' : undefined}
              />
              {!disabled && (
                <Button type="submit" className="!h-12 !min-h-12 !w-12 !min-w-12 shrink-0 !p-0" disabled={self?.hasGuessed && !text.trim()} aria-label={messages.chat.send} title={messages.chat.send}>
                  <Send aria-hidden="true" size={19} />
                </Button>
              )}
            </div>
          </FormField>
        </form>
      </div>
    </section>
  );
}

export default memo(ChatBox);
