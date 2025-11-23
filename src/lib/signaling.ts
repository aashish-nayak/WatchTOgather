/* eslint-disable @typescript-eslint/no-explicit-any */
// signaling-service.ts
// Robust, queue-based WebSocket signaling service for WebRTC
// Usage:
// 1) import { signalingService, generatePeerId, generateRoomId } from './signaling-service';
// 2) signalingService.start(); // optionally pass autoConnect = true
// 3) signalingService.on('*', (msg) => { ... })
// 4) signalingService.joinRoom(roomId, userId);

const WS_URL = (import.meta.env?.VITE_WS_URL as string) || (window as any)?.__WS_URL__ || 'ws://localhost:8080';

export type SignalingMessage = {
  type: string; // 'offer'|'answer'|'ice-candidate'|'create-room'|'join-room'|'leave-room'|'chat-message' etc
  roomId?: string;
  userId?: string;
  targetId?: string;
  data?: any;
  text?: string;
  username?: string;
  [key: string]: unknown;
};

export type SignalingCallback = (message: SignalingMessage) => void;

class SignalingService {
  private ws: WebSocket | null = null;
  private sendQueue: string[] = [];
  private callbacks: Map<string, SignalingCallback[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000; // ms
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private currentRole: 'host' | 'viewer' | null = null;
  private autoReconnect = true;
  private heartbeatIntervalMs = 25000; // send ping every 25s
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Do not auto-connect in constructor by default. Call start() to begin.
  }

  /** Start the service and optionally auto-connect */
  public start(autoConnect = true) {
    this.autoReconnect = true;
    this.intentionallyClosed = false;
    if (autoConnect) this.connect();
  }

  /** Stop completely (no reconnects) */
  public stop() {
    this.autoReconnect = false;
    this.intentionallyClosed = true;
    this.clearReconnectTimer();
    this.clearHeartbeat();
    if (this.ws) {
      try { this.ws.close(); } catch (e) { /* ignore */ }
      this.ws = null;
    }
    this.sendQueue = [];
    this.callbacks.clear();
    this.currentRoomId = null;
    this.currentUserId = null;
    this.currentRole = null;
  }

  private connect() {
    // Prevent creating multiple sockets if one is CONNECTING or OPEN
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.debug('WebSocket already connecting/open; skipping new connect');
      return;
    }

    try {
      console.info('Connecting to signaling server:', WS_URL);
      this.ws = new WebSocket(WS_URL);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = (ev) => {
        console.warn('WS onclose', ev.code, ev.reason, 'wasClean', ev.wasClean);
        this.handleClose(ev);
      };
      this.ws.onerror = (err) => {
        console.error('WS onerror', err);
        this.handleError(err);
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      this.scheduleReconnect();
    }
  }

  private handleOpen(ev: Event) {
    console.info('WebSocket open');
    this.reconnectAttempts = 0;

    // Flush queue
    while (this.sendQueue.length > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const payload = this.sendQueue.shift()!;
      try { this.ws.send(payload); } catch (e) { console.warn('Failed to flush queued message', e); this.sendQueue.unshift(payload); break; }
    }

    // Start heartbeat/ping
    this.startHeartbeat();

    // If we were in a room before reconnect, rejoin/recreate
    if (this.currentRoomId && this.currentUserId && this.currentRole) {
      console.info('Rejoining room after reconnect', this.currentRoomId, this.currentRole);
      if (this.currentRole === 'host') {
        this.createRoom(this.currentRoomId, this.currentUserId);
      } else {
        this.joinRoom(this.currentRoomId, this.currentUserId);
      }
    }
  }

  private handleMessage(ev: MessageEvent) {
    try {
      const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
      // If server sends plain strings, attempt JSON parse safely
      const message: SignalingMessage = (typeof data === 'string') ? JSON.parse(data) : data;
      console.debug('Received signaling message:', message.type, message);

      // Call exact-type callbacks
      const list = this.callbacks.get(message.type ?? '') || [];
      list.forEach(cb => safeCall(cb, message));

      // Call wildcard listeners
      const wildcard = this.callbacks.get('*') || [];
      wildcard.forEach(cb => safeCall(cb, message));
    } catch (err) {
      console.error('Error parsing or dispatching message', err, ev.data);
    }
  }

  private handleClose(ev: CloseEvent) {
    console.warn('WebSocket closed', ev.code, ev.reason, 'clean=', ev.wasClean);
    this.ws = null;
    this.clearHeartbeat();

    if (!this.intentionallyClosed && this.autoReconnect) {
      this.scheduleReconnect();
    }
  }

  private handleError(ev: Event | any) {
    console.error('WebSocket error', ev);
    // Error events are followed by close usually; don't aggressively reconnect here.
  }

  private scheduleReconnect() {
    if (!this.autoReconnect) return;

    this.reconnectAttempts++;
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    const delay = this.baseReconnectDelay * Math.min(30, this.reconnectAttempts);
    console.info(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat() {
    this.clearHeartbeat();
    try {
      this.heartbeatTimer = setInterval(() => {
        // lightweight ping - a minimal JSON we expect server to ignore or respond
        this.safeSend({ type: 'ping', ts: Date.now() }).catch(() => { /* no-op */ });
      }, this.heartbeatIntervalMs);
    } catch (e) {
      // ignore
    }
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /** Queue-aware safe send. Returns a promise that resolves when message is sent (or queued). */
  public safeSend(message: SignalingMessage, timeoutMs = 5000): Promise<void> {
    const payload = JSON.stringify(message);

    return new Promise((resolve, reject) => {
      // If ws open send immediately
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try { this.ws.send(payload); resolve(); } catch (err) { console.error('send failed', err); this.sendQueue.push(payload); resolve(); }
        return;
      }

      // If connecting, queue
      if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
        console.debug('WebSocket CONNECTING - queueing message:', message.type);
        this.sendQueue.push(payload);
        resolve();
        return;
      }

      // If no ws or closed, queue and attempt to connect
      console.debug('WebSocket not open - queueing and attempting to (re)connect');
      this.sendQueue.push(payload);
      this.connect();
      resolve();

      // Note: we do not reject on timeout; caller can choose to await confirmation via other signaling flow.
    });
  }

  // Helper that logs before sending; keeps API parity with previous implementation
  private send(message: SignalingMessage) {
    this.safeSend(message).catch(() => { /* ignore */ });
  }

  // Public API: event listeners
  public on(type: string, cb: SignalingCallback) {
    if (!this.callbacks.has(type)) this.callbacks.set(type, []);
    this.callbacks.get(type)!.push(cb);
  }

  public off(type: string, cb: SignalingCallback) {
    const arr = this.callbacks.get(type);
    if (!arr) return;
    const idx = arr.indexOf(cb);
    if (idx >= 0) arr.splice(idx, 1);
  }

  // Convenience methods for signaling actions
  public createRoom(roomId: string, userId: string) {
    this.currentRoomId = roomId;
    this.currentUserId = userId;
    this.currentRole = 'host';
    this.send({ type: 'create-room', roomId, userId });
  }

  public joinRoom(roomId: string, userId: string) {
    this.currentRoomId = roomId;
    this.currentUserId = userId;
    this.currentRole = 'viewer';
    this.send({ type: 'join-room', roomId, userId });
  }

  public leaveRoom(roomId?: string) {
    const rid = roomId ?? this.currentRoomId;
    if (!rid) return;
    this.send({ type: 'leave-room', roomId: rid });
    this.currentRoomId = null;
    this.currentRole = null;
    this.currentUserId = null;
  }

  public sendOffer(roomId: string, targetId: string, offer: RTCSessionDescriptionInit) {
    this.send({ type: 'offer', roomId, targetId, data: offer });
  }

  public sendAnswer(roomId: string, targetId: string, answer: RTCSessionDescriptionInit) {
    this.send({ type: 'answer', roomId, targetId, data: answer });
  }

  public sendIceCandidate(roomId: string, targetId: string, candidate: RTCIceCandidate | null) {
    this.send({ type: 'ice-candidate', roomId, targetId, data: candidate });
  }

  public sendChatMessage(roomId: string, userId: string, username: string, text: string) {
    this.send({ type: 'chat-message', roomId, userId, username, text });
  }

  public isConnected() { return this.ws?.readyState === WebSocket.OPEN; }
}

function safeCall(cb: SignalingCallback, message: SignalingMessage) {
  try { cb(message); } catch (err) { console.error('Signaling callback error', err); }
}

export const signalingService = new SignalingService();

export function generatePeerId(prefix = 'peer') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

export function generateRoomId() {
  return Math.random().toString(36).slice(2, 10);
}
