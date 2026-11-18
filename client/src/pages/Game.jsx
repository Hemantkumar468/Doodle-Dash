import { LogOut, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Canvas from '../components/Canvas';
import ChatBox from '../components/ChatBox';
import ErrorBoundary from '../components/ErrorBoundary';
import HintReveal from '../components/HintReveal';
import PlayerList from '../components/PlayerList';
import RoundEndOverlay from '../components/RoundEndOverlay';
import Timer from '../components/Timer';
import Toolbar from '../components/Toolbar';
import WordPicker from '../components/WordPicker';
import { BottomSheet, Button, IconButton } from '../components/ui';
import { selectIsDrawer } from '../features/game/gameSlice';
import { useVisualViewport } from '../hooks/useVisualViewport';
import { messages } from '../lib/messages';
import { clearSession } from '../lib/session';
import { emitSocket } from '../middleware/socketMiddleware';

export default function Game() {
  useVisualViewport();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const roomId = useSelector((state) => state.room.roomId);
  const settings = useSelector((state) => state.room.settings);
  const { phase, round, totalRounds, drawerId, blanks, word, wordOptions, turnEndsAt, roundEnd } = useSelector((state) => state.game);
  const players = useSelector((state) => state.room.players);
  const isDrawer = useSelector(selectIsDrawer);
  const previousBlanks = useRef('');
  const [hintReveal, setHintReveal] = useState('');
  const [showLeave, setShowLeave] = useState(false);
  const drawer = players.find((player) => player.id === drawerId);
  const timerDuration = phase === 'WORD_SELECTION' ? 15 : settings.drawTime;
  const displayedWord = isDrawer
    ? word || (phase === 'WORD_SELECTION' ? messages.game.chooseWord : messages.game.yourWord)
    : blanks || (settings.wordMode === 'Hidden' ? messages.game.hiddenPlaceholder : messages.game.unknownWord);
  const blankCharacters = !isDrawer && phase === 'DRAWING' && blanks
    ? Array.from(blanks).filter((character) => character !== ' ')
    : [];
  const roleMessage = isDrawer
    ? messages.game.yourTurn
    : drawer
      ? messages.game.playerDrawing(drawer.name)
      : messages.game.getReady;

  useEffect(() => {
    const previous = previousBlanks.current;
    if (!isDrawer && phase === 'DRAWING' && previous && blanks && blanks !== previous) setHintReveal(blanks);
    if (isDrawer || phase !== 'DRAWING') setHintReveal('');
    previousBlanks.current = blanks;
  }, [blanks, isDrawer, phase]);

  useEffect(() => {
    if (!hintReveal) return undefined;
    const timer = window.setTimeout(() => setHintReveal(''), 2400);
    return () => window.clearTimeout(timer);
  }, [hintReveal]);

  const leave = () => {
    dispatch(emitSocket('leave_room', { roomId }));
    clearSession();
    navigate('/');
  };

  return (
    <main
      data-game-screen
      className="app-bg game-ui flex h-dvh min-h-0 flex-col overflow-hidden p-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pl-[max(.5rem,env(safe-area-inset-left))] pr-[max(.5rem,env(safe-area-inset-right))] pt-[max(.5rem,env(safe-area-inset-top))] lg:p-4"
      onContextMenu={(event) => event.preventDefault()}
    >
      <header className="mx-auto mb-2 w-full max-w-[1600px] shrink-0 rounded-2xl border border-white/10 bg-violet-950/55 p-2 shadow-xl backdrop-blur-xl lg:mb-3 lg:min-h-16 lg:p-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2 [@media(max-height:500px)]:flex-nowrap">
          <div className="flex shrink-0 items-center gap-2">
            <IconButton label={messages.game.leave} className="!border-white/10 !bg-white/[.06] !text-violet-100 hover:!bg-white/10" onClick={() => setShowLeave(true)}>
              <LogOut aria-hidden="true" size={19} />
            </IconButton>
            <span className="inline-flex min-h-8 items-center whitespace-nowrap rounded-full border border-white/10 bg-white/[.06] px-3 text-xs font-semibold text-violet-100">
              {messages.game.round(round || 1, totalRounds || settings.rounds)}
            </span>
          </div>

          <div className="order-3 mx-auto min-w-0 basis-full sm:order-none sm:flex-1 [@media(max-height:500px)]:order-none [@media(max-height:500px)]:basis-auto [@media(max-height:500px)]:flex-1">
            <div className="mx-auto flex min-h-12 max-w-xl min-w-0 items-center justify-center rounded-xl border border-white/10 bg-white/[.055] px-3 py-1.5 text-center shadow-inner">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-violet-300">
                  {isDrawer ? messages.game.yourWord : settings.wordMode === 'Hidden' ? messages.game.hiddenWord : messages.game.guessWord}
                  {!!blankCharacters.length && <span className="ml-2 tracking-normal text-violet-400 sm:hidden">{messages.game.letterCount(blankCharacters.length)}</span>}
                </p>
                {blankCharacters.length ? (
                  <div className="mt-0.5 flex min-w-0 flex-wrap items-center justify-center gap-0.5 sm:gap-1" aria-live="polite" aria-label={displayedWord}>
                    {blankCharacters.map((character, index) => (
                      <span key={`${index}-${character}`} className="flex h-6 min-w-[.875rem] items-center justify-center rounded border border-white/10 bg-violet-950/45 px-0 font-display text-sm font-bold text-amber-200 sm:h-8 sm:min-w-6 sm:rounded-md sm:px-1 sm:text-xl">
                        {character === '_' ? '' : character}
                      </span>
                    ))}
                    <span className="ml-1 hidden whitespace-nowrap text-[10px] font-medium text-violet-300 sm:inline">{messages.game.letterCount(blankCharacters.length)}</span>
                  </div>
                ) : (
                  <p className={`mt-0.5 break-all font-display text-xl font-bold leading-none sm:text-3xl lg:text-4xl ${isDrawer ? 'tracking-[.14em] text-amber-200 sm:tracking-[.22em]' : 'text-white'}`} aria-live="polite">
                    {displayedWord}
                  </p>
                )}
              </div>
            </div>
            <p className="game-role-message mt-1 break-words text-center text-[11px] font-medium leading-tight text-violet-200 [@media(max-height:500px)]:hidden">{roleMessage}</p>
          </div>

          <Timer endsAt={turnEndsAt} duration={timerDuration} compact />
        </div>
      </header>

      <div
        data-game-main
        className="mx-auto flex w-full max-w-[1600px] min-h-0 flex-1 flex-col gap-2 overflow-hidden md:grid md:grid-cols-[minmax(0,1fr)_minmax(280px,.72fr)] md:gap-3 lg:grid-cols-[260px_minmax(0,1fr)_320px] lg:gap-4 xl:grid-cols-[300px_minmax(0,1fr)_360px] [@media(max-height:500px)]:grid [@media(max-height:500px)]:grid-cols-[minmax(0,1fr)_minmax(220px,.72fr)]"
      >
        <aside className="hidden min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-violet-950/45 shadow-xl backdrop-blur-xl lg:flex" aria-label={messages.game.players}>
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 px-3">
            <Users className="text-violet-300" aria-hidden="true" size={17} />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-violet-200">{messages.lobby.playersCount(players.length, settings.maxPlayers)}</h2>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
            <PlayerList />
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 shrink-0 flex-col gap-2 md:h-full md:shrink md:col-start-1 lg:col-start-2 [@media(max-height:500px)]:h-full [@media(max-height:500px)]:shrink [@media(max-height:500px)]:col-start-1 [@media(max-height:500px)]:row-start-1">
          <ErrorBoundary>
            <div className="game-canvas-slot aspect-[4/3] min-h-0 w-full shrink-0 md:aspect-auto md:flex-1 [@media(max-height:500px)]:aspect-auto [@media(max-height:500px)]:flex-1">
              <Canvas />
            </div>
            {isDrawer && phase === 'DRAWING' ? (
              <Toolbar />
            ) : (
              <div className="flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[.05] px-3 text-center text-xs font-medium text-violet-200">
                {phase === 'WORD_SELECTION' ? messages.game.chooseWord : messages.game.guessInChat || messages.chat.guessPlaceholder}
              </div>
            )}
          </ErrorBoundary>
        </section>

        <aside className="min-h-0 min-w-0 flex-1 md:col-start-2 md:row-start-1 lg:col-start-3 [@media(max-height:500px)]:col-start-2 [@media(max-height:500px)]:row-start-1" aria-label={messages.game.chatAndPlayers}>
          <ChatBox mobileTabs />
        </aside>
      </div>

      {isDrawer && phase === 'WORD_SELECTION' && (
        <WordPicker options={wordOptions} seconds={15} onPick={(selectedWord) => dispatch(emitSocket('word_chosen', { roomId, word: selectedWord }))} />
      )}
      {phase === 'ROUND_END' && <RoundEndOverlay result={roundEnd} />}
      {hintReveal && <HintReveal blanks={hintReveal} onDismiss={() => setHintReveal('')} />}
      {showLeave && (
        <BottomSheet title={messages.game.leaveTitle}>
          <p className="mt-3 text-center text-base leading-relaxed text-violet-200">{messages.game.leaveText}</p>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button full variant="secondary" onClick={() => setShowLeave(false)}>{messages.common.stay}</Button>
            <Button full variant="danger" onClick={leave}>{messages.common.leave}</Button>
          </div>
        </BottomSheet>
      )}
    </main>
  );
}
