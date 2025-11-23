/* eslint-disable @typescript-eslint/no-explicit-any */
// Fixed signaling service with proper initialization
const WS_URL = (import.meta.env?.VITE_WS_URL as string) || (window as any)?.__WS_URL__ || 'ws://localhost:5000'; // Changed from 8080 to 5000

export type SignalingMessage = {
  type: string;
  roomId?: string;
  userId?: string;
  targetId?: string;
  fromId?: string; // Added missing fromId
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
  private baseReconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private currentRole: 'host' | 'viewer' | null = null;
  private autoReconnect = true;
  private heartbeatIntervalMs = 25000;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private isStarted = false;

  constructor() {
    // Do not auto-connect in constructor
  }

  public start(autoConnect = true) {
    if (this.isStarted) {
      console.warn('Signaling service already started');
      return;
    }
    
    this.isStarted = true;
    this.autoReconnect = true;
    this.intentionallyClosed = false;
    
    if (autoConnect) {
      this.connect();
    }
  }

  public stop() {
    this.isStarted = false;
    this.autoReconnect = false;
    this.intentionallyClosed = true;
    this.clearReconnectTimer();
    this.clearHeartbeat();
    
    if (this.ws) {
      try { 
        this.ws.close(); 
      } catch (e) { 
        console.warn('Error closing WebSocket:', e);
      }
      this.ws = null;
    }
    
    this.sendQueue = [];
    this.callbacks.clear();
    this.currentRoomId = null;
    this.currentUserId = null;
    this.currentRole = null;
  }

  private connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.debug('WebSocket already connecting/open');
      return;
    }

    try {
      console.info('Connecting to signaling server:', WS_URL);
      this.ws = new WebSocket(WS_URL);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      this.scheduleReconnect();
    }
  }

  private handleOpen(_ev: Event) {
    console.info('WebSocket connected successfully');
    this.reconnectAttempts = 0;

    // Flush queue
    while (this.sendQueue.length > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const payload = this.sendQueue.shift()!;
      try { 
        this.ws.send(payload); 
      } catch (e) { 
        console.warn('Failed to flush queued message', e); 
        this.sendQueue.unshift(payload); 
        break; 
      }
    }

    this.startHeartbeat();

    // Rejoin room if needed
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
      const data = typeof ev.data === 'string' ? ev.data : String(ev.data);
      const message: SignalingMessage = JSON.parse(data);
      
      console.debug('Received:', message.type, message);

      // Call type-specific callbacks
      const list = this.callbacks.get(message.type ?? '') || [];
      list.forEach(cb => safeCall(cb, message));

      // Call wildcard listeners
      const wildcard = this.callbacks.get('*') || [];
      wildcard.forEach(cb => safeCall(cb, message));
    } catch (err) {
      console.error('Error parsing message:', err, ev.data);
    }
  }

  private handleClose(ev: CloseEvent) {
    console.warn('WebSocket closed:', ev.code, ev.reason);
    this.ws = null;
    this.clearHeartbeat();

    if (!this.intentionallyClosed && this.autoReconnect && this.isStarted) {
      this.scheduleReconnect();
    }
  }

  private handleError(ev: Event | any) {
    console.error('WebSocket error:', ev);
  }

  private scheduleReconnect() {
    if (!this.autoReconnect || !this.isStarted) return;

    this.reconnectAttempts++;
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    const delay = this.baseReconnectDelay * Math.min(30, this.reconnectAttempts);
    console.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
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
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
        } catch (e) {
          console.warn('Heartbeat failed:', e);
        }
      }
    }, this.heartbeatIntervalMs);
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  public safeSend(message: SignalingMessage): Promise<void> {
    const payload = JSON.stringify(message);

    return new Promise((resolve) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try { 
          this.ws.send(payload); 
          resolve(); 
        } catch (err) { 
          console.error('Send failed:', err); 
          this.sendQueue.push(payload); 
          resolve(); 
        }
        return;
      }

      if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
        console.debug('Queueing message (connecting):', message.type);
        this.sendQueue.push(payload);
        resolve();
        return;
      }

      console.debug('Queueing message (no connection):', message.type);
      this.sendQueue.push(payload);
      this.connect();
      resolve();
    });
  }

  private send(message: SignalingMessage) {
    this.safeSend(message).catch(() => { /* ignore */ });
  }

  public on(type: string, cb: SignalingCallback) {
    if (!this.callbacks.has(type)) {
      this.callbacks.set(type, []);
    }
    this.callbacks.get(type)!.push(cb);
  }

  public off(type: string, cb: SignalingCallback) {
    const arr = this.callbacks.get(type);
    if (!arr) return;
    const idx = arr.indexOf(cb);
    if (idx >= 0) arr.splice(idx, 1);
  }

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

  public isConnected() { 
    return this.ws?.readyState === WebSocket.OPEN; 
  }

  public getConnectionState() {
    if (!this.ws) return 'closed';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'open';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'closed';
      default: return 'unknown';
    }
  }
}

function safeCall(cb: SignalingCallback, message: SignalingMessage) {
  try { 
    cb(message); 
  } catch (err) { 
    console.error('Callback error:', err); 
  }
}

export const signalingService = new SignalingService();

export function generatePeerId(prefix = 'peer') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

export function generateRoomId() {
  return Math.random().toString(36).slice(2, 10);
}