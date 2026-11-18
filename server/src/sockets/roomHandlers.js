import { emitError, socketError } from './MessageHandler.js';
import { context, requireHost } from './helpers.js';
import { PHASES } from '../game/Game.js';

const success = (ack, payload = {}) => { if (typeof ack === 'function') ack({ ok: true, ...payload }); };

export function registerRoomHandlers({ socket, manager, register }) {
  register('create_room', ({ hostName, avatar, deviceId, settings }, ack) => {
    if (socket.data.roomId) return emitError(socket, 'ALREADY_IN_ROOM', 'Leave the current room first.', ack);
    const room = manager.create(settings);
    const player = room.addPlayer({ socketId: socket.id, deviceId, name: hostName, avatar, isHost: true });
    room.bindSocket(player, socket);
    socket.data.roomId = room.roomId;
    socket.data.playerId = player.id;
    const snapshot = room.snapshotFor(player.id);
    success(ack, { roomId: room.roomId, playerId: player.id, name: player.name, player: player.publicState(), snapshot });
    room.broadcastState();
  });

  register('join_room', ({ roomId, playerName, avatar, deviceId }, ack) => {
    if (socket.data.roomId) return emitError(socket, 'ALREADY_IN_ROOM', 'Leave the current room first.', ack);
    const room = manager.find(roomId);
    if (!room) return emitError(socket, 'ROOM_NOT_FOUND', 'That room does not exist.', ack);
    if (room.players.size >= room.settings.maxPlayers) return emitError(socket, 'ROOM_FULL', 'That room is full.', ack);
    if (room.game.phase !== PHASES.LOBBY) return emitError(socket, 'GAME_ALREADY_STARTED', 'That game has already started.', ack);
    const player = room.addPlayer({ socketId: socket.id, deviceId, name: playerName, avatar });
    room.bindSocket(player, socket);
    socket.data.roomId = room.roomId;
    socket.data.playerId = player.id;
    success(ack, { roomId: room.roomId, playerId: player.id, name: player.name, player: player.publicState(), snapshot: room.snapshotFor(player.id) });
    room.broadcast('player_joined', player.publicState());
    room.broadcastState();
  });

  register('rejoin_room', ({ roomId, playerId }, ack) => {
    if (socket.data.roomId || socket.data.playerId) {
      const currentRoom = manager.find(socket.data.roomId);
      const currentPlayer = currentRoom?.players.get(socket.data.playerId);
      const isExactBinding = currentRoom?.roomId === roomId && currentPlayer?.id === playerId && currentPlayer.socketId === socket.id;
      if (!isExactBinding) return emitError(socket, 'ALREADY_IN_ROOM', 'Leave the current room before changing player sessions.', ack);
      return success(ack, {
        roomId: currentRoom.roomId,
        playerId: currentPlayer.id,
        name: currentPlayer.name,
        player: currentPlayer.publicState(),
        snapshot: currentRoom.snapshotFor(currentPlayer.id)
      });
    }
    const room = manager.find(roomId);
    if (!room) return emitError(socket, 'ROOM_NOT_FOUND', 'That room no longer exists.', ack);
    const player = room.players.get(playerId);
    if (!player) return emitError(socket, 'PLAYER_NOT_FOUND', 'That player session has expired.', ack);
    room.bindSocket(player, socket);
    socket.data.roomId = room.roomId;
    socket.data.playerId = player.id;
    const snapshot = room.snapshotFor(player.id);
    success(ack, { roomId: room.roomId, playerId: player.id, name: player.name, player: player.publicState(), snapshot });
    room.broadcast('player_updated', player.publicState());
    room.broadcastState();
  });

  register('leave_room', (_payload, ack) => {
    const result = context(socket, manager, ack);
    if (!result) return;
    result.room.removePlayer(result.player.id, 'LEFT');
    socket.leave(result.room.roomId);
    socket.data.roomId = null;
    socket.data.playerId = null;
    success(ack);
  });

  register('update_settings', (payload, ack) => {
    const result = requireHost(socket, manager, ack);
    if (!result) return;
    const settings = payload.settings || payload;
    if (!result.room.updateSettings(settings)) return emitError(socket, 'GAME_ALREADY_STARTED', 'Settings cannot change during a game.', ack);
    success(ack, { settings: result.room.settings });
  });

  register('ready_toggle', ({ ready }, ack) => {
    const result = context(socket, manager, ack);
    if (!result) return;
    result.player.isReady = ready ?? !result.player.isReady;
    result.room.broadcast('player_updated', result.player.publicState());
    result.room.broadcastState();
    success(ack, { ready: result.player.isReady });
  });

  register('kick_player', ({ playerId }, ack) => {
    const result = requireHost(socket, manager, ack);
    if (!result) return;
    if (playerId === result.player.id) return emitError(socket, 'INVALID_PAYLOAD', 'The host cannot kick themselves.', ack);
    const target = result.room.players.get(playerId);
    if (!target) return emitError(socket, 'PLAYER_NOT_FOUND', 'That player is no longer here.', ack);
    const targetSocket = result.room.io.sockets.sockets.get(target.socketId);
    targetSocket?.emit('error_message', socketError('KICKED'));
    result.room.removePlayer(playerId, 'KICKED');
    if (targetSocket) {
      targetSocket.data.roomId = null;
      targetSocket.data.playerId = null;
    }
    success(ack);
  });
}
