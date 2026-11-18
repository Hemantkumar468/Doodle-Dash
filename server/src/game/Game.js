import { ScoreCalculator } from './ScoreCalculator.js';
import { matchGuess } from './wordMatcher.js';
import { chooseHintIndexes, makeBlank } from './hints.js';
import { buildHistoryRecord, compactStrokes, logHistoryWriteFailure, saveHistoryRecord } from '../history/historyStorage.js';

export const PHASES = Object.freeze({
  LOBBY: 'LOBBY',
  WORD_SELECTION: 'WORD_SELECTION',
  DRAWING: 'DRAWING',
  ROUND_END: 'ROUND_END',
  GAME_OVER: 'GAME_OVER'
});

export class Game {
  constructor(room, wordService, { selectionMs = 15_000, roundPauseMs = 4_000, historyWriter = saveHistoryRecord } = {}) {
    this.room = room;
    this.wordService = wordService;
    this.selectionMs = selectionMs;
    this.roundPauseMs = roundPauseMs;
    this.phase = PHASES.LOBBY;
    this.round = 0;
    this.turnIndex = -1;
    this.drawerId = null;
    this.turnOrder = [];
    this.queue = [];
    this.currentWord = null;
    this.wordOptions = [];
    this.usedWords = new Set();
    this.revealed = new Set();
    this.hintOrder = [];
    this.turnEndsAt = null;
    this.guessOrder = 0;
    this.eligibleAtTurnStart = 0;
    this.turnDeltas = new Map();
    this.strokeHistory = [];
    this.activeStroke = null;
    this.gameOver = null;
    this.timers = new Set();
    this.transitioning = false;
    this.historyWriter = historyWriter;
    this.historyStartedAt = null;
    this.historySettings = null;
    this.historyParticipants = new Map();
    this.historyTurns = [];
    this.historySaveQueued = false;
    this.turnGuessers = [];
    this.turnStartedAt = null;
    this.lifecycleVersion = 0;
  }

  setTimer(callback, delay) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, Math.max(0, delay));
    timer.unref?.();
    this.timers.add(timer);
    return timer;
  }

  clearTimers() {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }

  stateFor(playerId) {
    const isDrawer = playerId === this.drawerId;
    return {
      phase: this.phase,
      round: this.round,
      totalRounds: this.room.settings.rounds,
      drawerId: this.drawerId,
      blanks: this.phase === PHASES.DRAWING && !isDrawer
        ? makeBlank(this.currentWord, this.revealed, this.room.settings.wordMode === 'Hidden') : '',
      hints: [...this.revealed],
      turnEndsAt: this.turnEndsAt,
      strokeHistory: this.strokeHistory,
      ...(this.phase === PHASES.GAME_OVER && this.gameOver ? { gameOver: this.gameOver } : {}),
      ...((isDrawer || this.phase === PHASES.ROUND_END) && this.currentWord ? { word: this.currentWord } : {}),
      ...(isDrawer && this.phase === PHASES.WORD_SELECTION ? { wordOptions: this.wordOptions } : {})
    };
  }

  async start() {
    if (this.phase !== PHASES.LOBBY) return false;
    const players = [...this.room.players.values()].filter((player) => player.isConnected);
    if (players.length < 2) return false;
    this.lifecycleVersion += 1;
    this.clearTimers();
    this.historyStartedAt = new Date();
    this.historySettings = { ...this.room.settings };
    this.historyParticipants = new Map(players.map((player) => [player.id, player]));
    this.historyTurns = [];
    this.historySaveQueued = false;
    this.turnGuessers = [];
    this.turnStartedAt = null;
    this.turnOrder = players.map((player) => player.id);
    this.queue = Array.from({ length: this.room.settings.rounds }, () => this.turnOrder).flat();
    this.turnIndex = -1;
    this.gameOver = null;
    this.usedWords.clear();
    for (const player of this.room.players.values()) {
      player.score = 0;
      player.hasGuessed = false;
      player.isReady = false;
    }
    return Boolean(await this.nextTurn());
  }

  async nextTurn() {
    if (this.transitioning || this.phase === PHASES.GAME_OVER) return false;
    const lifecycleVersion = this.lifecycleVersion;
    this.transitioning = true;
    this.clearTimers();
    let nextId;
    while (++this.turnIndex < this.queue.length) {
      const candidate = this.room.players.get(this.queue[this.turnIndex]);
      if (candidate?.isConnected) { nextId = candidate.id; break; }
    }
    if (!nextId) {
      this.transitioning = false;
      const connectedPlayers = [...this.room.players.values()].filter((player) => player.isConnected).length;
      await this.endGame({ endedEarly: connectedPlayers < 2 });
      return false;
    }
    this.drawerId = nextId;
    this.round = Math.min(this.room.settings.rounds, Math.floor(this.turnIndex / Math.max(1, this.turnOrder.length)) + 1);
    this.phase = PHASES.WORD_SELECTION;
    this.currentWord = null;
    const wordOptions = await this.wordService.choices({
      count: this.room.settings.wordChoices,
      customWords: this.room.settings.customWords,
      used: this.usedWords,
      mode: this.room.settings.wordMode
    });
    if (lifecycleVersion !== this.lifecycleVersion) return false;
    const selectedDrawer = this.room.players.get(nextId);
    if (this.phase === PHASES.GAME_OVER) {
      this.transitioning = false;
      return false;
    }
    if (!selectedDrawer?.isConnected) {
      this.transitioning = false;
      return this.nextTurn();
    }
    this.wordOptions = wordOptions;
    this.strokeHistory = [];
    this.activeStroke = null;
    this.revealed.clear();
    this.turnEndsAt = Date.now() + this.selectionMs;
    this.turnDeltas.clear();
    this.guessOrder = 0;
    for (const player of this.room.players.values()) player.hasGuessed = false;
    this.room.emitPerPlayer('round_start', (player) => ({
      round: this.round,
      drawerId: this.drawerId,
      turnEndsAt: this.turnEndsAt,
      ...(player.id === this.drawerId ? { options: this.wordOptions } : {})
    }));
    this.room.broadcastState();
    this.setTimer(() => this.chooseWord(this.drawerId, this.wordOptions[Math.floor(Math.random() * this.wordOptions.length)]), this.selectionMs);
    this.transitioning = false;
    return true;
  }

  chooseWord(playerId, requestedWord) {
    if (this.phase !== PHASES.WORD_SELECTION || playerId !== this.drawerId) return false;
    const selected = this.wordOptions.includes(requestedWord) ? requestedWord : this.wordOptions[0];
    if (!selected) return false;
    this.clearTimers();
    this.currentWord = selected;
    this.usedWords.add(selected.toLocaleLowerCase('en'));
    this.phase = PHASES.DRAWING;
    this.turnStartedAt = Date.now();
    this.turnGuessers = [];
    this.turnEndsAt = Date.now() + this.room.settings.drawTime * 1000;
    this.eligibleAtTurnStart = [...this.room.players.values()].filter((p) => p.id !== this.drawerId && p.isConnected).length;
    this.hintOrder = chooseHintIndexes(selected, this.room.settings.hints);
    this.room.emitPerPlayer('word_chosen', (player) => player.id === this.drawerId
      ? { word: selected, turnEndsAt: this.turnEndsAt }
      : { blanks: makeBlank(selected, this.revealed, this.room.settings.wordMode === 'Hidden'), turnEndsAt: this.turnEndsAt });
    this.room.broadcastState();
    this.setTimer(() => this.endTurn('TIME_UP'), this.room.settings.drawTime * 1000);
    this.hintOrder.forEach((index, order) => {
      const delay = Math.floor(this.room.settings.drawTime * 1000 * (order + 1) / (this.hintOrder.length + 1));
      this.setTimer(() => this.revealHint(index), delay);
    });
    return true;
  }

  revealHint(index) {
    if (this.phase !== PHASES.DRAWING || this.revealed.has(index)) return;
    this.revealed.add(index);
    this.room.emitPerPlayer('game_state', (player) => this.room.snapshotFor(player.id));
  }

  handleGuess(playerId, guess) {
    if (this.phase !== PHASES.DRAWING) return { accepted: false, reason: 'NOT_DRAWING' };
    const player = this.room.players.get(playerId);
    if (!player || player.id === this.drawerId || player.hasGuessed || !player.isConnected) {
      return { accepted: false, reason: 'CANNOT_GUESS' };
    }
    const result = matchGuess(guess, this.currentWord);
    if (result.exact) {
      const timeLeft = Math.max(0, (this.turnEndsAt - Date.now()) / 1000);
      const delta = ScoreCalculator.guesser({ timeLeft, drawTime: this.room.settings.drawTime, guessOrder: this.guessOrder++ });
      player.score += delta;
      player.hasGuessed = true;
      this.turnDeltas.set(player.id, (this.turnDeltas.get(player.id) || 0) + delta);
      this.turnGuessers.push({
        name: player.name,
        points: delta,
        guessedAtSec: Math.max(0, Math.round((Date.now() - (this.turnStartedAt || Date.now())) / 1_000))
      });
      this.room.broadcast('guess_result', { playerId: player.id, name: player.name, correct: true, message: `${player.name} guessed the word!` });
      this.room.broadcastState();
      const remaining = [...this.room.players.values()].filter((p) => p.id !== this.drawerId && p.isConnected && !p.hasGuessed);
      if (!remaining.length) this.endTurn('ALL_GUESSED');
      return { accepted: true, exact: true, delta };
    }
    return { accepted: true, exact: false, close: result.close };
  }

  async endTurn(reason = 'ENDED') {
    if (![PHASES.DRAWING, PHASES.WORD_SELECTION].includes(this.phase) || this.transitioning) return false;
    this.transitioning = true;
    this.clearTimers();
    const completedDrawing = this.phase === PHASES.DRAWING && Boolean(this.currentWord);
    const word = this.currentWord || this.wordOptions[0] || '';
    const drawer = this.room.players.get(this.drawerId);
    const historyDrawer = drawer || this.historyParticipants.get(this.drawerId);
    const guessedCount = [...this.room.players.values()].filter((p) => p.id !== this.drawerId && p.hasGuessed).length;
    if (drawer) {
      const delta = ScoreCalculator.drawer({ guessedCount, eligibleCount: this.eligibleAtTurnStart });
      drawer.score += delta;
      this.turnDeltas.set(drawer.id, (this.turnDeltas.get(drawer.id) || 0) + delta);
    }
    if (completedDrawing) {
      this.historyTurns.push({
        round: this.round,
        turnIndex: this.turnIndex,
        drawerName: historyDrawer?.name || '',
        word,
        guessers: this.turnGuessers.map((guesser) => ({ ...guesser })),
        drawerPoints: drawer ? this.turnDeltas.get(drawer.id) || 0 : 0,
        strokes: compactStrokes(this.strokeHistory)
      });
    }
    this.phase = PHASES.ROUND_END;
    this.turnEndsAt = null;
    const scores = [...this.room.players.values()].map((player) => ({
      playerId: player.id,
      name: player.name,
      avatar: player.avatar,
      delta: this.turnDeltas.get(player.id) || 0,
      total: player.score
    }));
    const nextDrawer = this.findNextDrawer();
    this.room.broadcast('round_end', { word, scores, nextDrawer });
    this.room.broadcastState();
    this.transitioning = false;
    this.setTimer(() => this.nextTurn(), this.roundPauseMs);
    return true;
  }

  findNextDrawer() {
    for (let index = this.turnIndex + 1; index < this.queue.length; index += 1) {
      const player = this.room.players.get(this.queue[index]);
      if (player?.isConnected) return player.publicState();
    }
    return null;
  }

  async endGame({ endedEarly = false } = {}) {
    if (this.phase === PHASES.GAME_OVER && this.gameOver) return this.gameOver;
    this.lifecycleVersion += 1;
    this.transitioning = false;
    this.clearTimers();
    this.phase = PHASES.GAME_OVER;
    this.turnEndsAt = null;
    const sorted = [...this.room.players.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    let lastScore = null;
    let rank = 0;
    const leaderboard = sorted.map((player, index) => {
      if (player.score !== lastScore) rank = index + 1;
      lastScore = player.score;
      return { rank, playerId: player.id, name: player.name, avatar: player.avatar, score: player.score };
    });
    const first = leaderboard[0] || { playerId: '', name: '', score: 0 };
    const historySorted = [...(this.historyParticipants.size ? this.historyParticipants.values() : this.room.players.values())]
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    let historyRank = 0;
    let previousScore = null;
    const historyPlayers = historySorted.map((player, index) => {
      if (player.score !== previousScore) historyRank = index + 1;
      previousScore = player.score;
      return { deviceId: player.deviceId, name: player.name, avatar: player.avatar, finalScore: player.score, rank: historyRank };
    });
    const historyRecord = buildHistoryRecord({
      roomId: this.room.roomId,
      startedAt: this.historyStartedAt,
      endedAt: new Date(),
      settings: this.historySettings || this.room.settings,
      players: historyPlayers,
      turns: this.historyTurns,
      endedEarly
    });
    const payload = {
      winner: { playerId: first.playerId, name: first.name, score: first.score },
      leaderboard,
      ...(historyRecord ? { historyId: String(historyRecord._id) } : {})
    };
    this.gameOver = payload;
    this.room.broadcast('game_over', payload);
    this.room.broadcastState();
    if (historyRecord && !this.historySaveQueued) {
      this.historySaveQueued = true;
      Promise.resolve().then(() => this.historyWriter(historyRecord)).catch(logHistoryWriteFailure);
    }
    return payload;
  }

  reset() {
    this.lifecycleVersion += 1;
    this.transitioning = false;
    this.clearTimers();
    this.phase = PHASES.LOBBY;
    this.round = 0;
    this.turnIndex = -1;
    this.drawerId = null;
    this.currentWord = null;
    this.gameOver = null;
    this.wordOptions = [];
    this.turnEndsAt = null;
    this.strokeHistory = [];
    this.historyStartedAt = null;
    this.historySettings = null;
    this.historyParticipants = new Map();
    this.historyTurns = [];
    this.historySaveQueued = false;
    this.turnGuessers = [];
    this.turnStartedAt = null;
    for (const player of this.room.players.values()) {
      player.score = 0;
      player.hasGuessed = false;
      player.isReady = false;
    }
    this.room.broadcastState();
  }

  onPlayerRemoved(playerId) {
    if (this.drawerId === playerId && [PHASES.WORD_SELECTION, PHASES.DRAWING].includes(this.phase)) this.endTurn('DRAWER_LEFT');
    if (this.phase !== PHASES.LOBBY && this.phase !== PHASES.GAME_OVER && this.room.players.size < 2) this.endGame({ endedEarly: true });
  }

  onPlayerDisconnected(playerId) {
    if (this.phase !== PHASES.DRAWING || playerId === this.drawerId) return;
    const remaining = [...this.room.players.values()]
      .filter((player) => player.id !== this.drawerId && player.isConnected && !player.hasGuessed);
    if (!remaining.length) this.endTurn('ALL_GUESSED');
  }

  addStroke(point) {
    const stroke = { id: point.strokeId, tool: point.tool, color: point.color, size: point.size, points: [{ x: point.x, y: point.y }] };
    this.activeStroke = stroke;
    this.strokeHistory.push(stroke);
    return stroke;
  }

  moveStroke(point) {
    if (!this.activeStroke || (point.strokeId && this.activeStroke.id !== point.strokeId)) return null;
    const previous = this.activeStroke.points.at(-1);
    if (previous?.x === point.x && previous?.y === point.y) return { stroke: this.activeStroke, added: false };
    this.activeStroke.points.push({ x: point.x, y: point.y });
    return { stroke: this.activeStroke, added: true };
  }

  endStroke() { this.activeStroke = null; }
  clearCanvas() { this.strokeHistory = []; this.activeStroke = null; }
  undo() { this.activeStroke = null; return this.strokeHistory.pop() || null; }
}
