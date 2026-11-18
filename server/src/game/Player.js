import { randomUUID } from 'node:crypto';

export class Player {
  constructor({ id = randomUUID(), socketId, deviceId = null, name, avatar = '1', isHost = false }) {
    this.id = id;
    this.socketId = socketId;
    this.deviceId = deviceId;
    this.name = name;
    this.avatar = String(avatar || '1');
    this.score = 0;
    this.isHost = isHost;
    this.isReady = false;
    this.hasGuessed = false;
    this.isConnected = true;
    this.removalTimer = null;
  }

  publicState() {
    return {
      id: this.id,
      name: this.name,
      avatar: this.avatar,
      score: this.score,
      isHost: this.isHost,
      isConnected: this.isConnected,
      hasGuessed: this.hasGuessed
    };
  }

  clearRemovalTimer() {
    if (this.removalTimer) clearTimeout(this.removalTimer);
    this.removalTimer = null;
  }
}
