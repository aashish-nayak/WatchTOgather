// WebSocket-based signaling for WebRTC connections

// Use environment variable or default to localhost for development
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';

export type SignalingMessage = {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave' | 'chat-message';
  roomId: string;
  userId: string;
  targetId?: string;
  data?: Record<string, unknown>;
  text?: string;
  username?: string;
};

export type SignalingCallback = (message: SignalingMessage) => void;

class SignalingService {
  private ws: WebSocket | null = null;
  private callbacks: Map<string, SignalingCallback[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isIntentionallyClosed = false;
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private currentRole: 'host' | 'viewer' | null = null;

  constructor() {
    this.connect();
  }

  private connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      console.log('Connecting to signaling server:', WS_URL);
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('Connected to signaling server');
        this.reconnectAttempts = 0;
        
        // Rejoin room if we were in one
        if (this.currentRoomId && this.currentUserId) {
          if (this.currentRole === 'host') {
            this.createRoom(this.currentRoomId, this.currentUserId);
          } else if (this.currentRole === 'viewer') {
            this.joinRoom(this.currentRoomId, this.currentUserId);
          }
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('Received signaling message:', message.type);
          
          // Notify all registered callbacks for this message type
          const callbacks = this.callbacks.get(message.type) || [];
          callbacks.forEach(callback => callback(message));
          
          // Also notify wildcard listeners
          const wildcardCallbacks = this.callbacks.get('*') || [];
          wildcardCallbacks.forEach(callback => callback(message));
        } catch (error) {
          console.error('Error parsing signaling message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('Disconnected from signaling server');
        this.ws = null;
        
        if (!this.isIntentionallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          this.reconnectTimer = setTimeout(() => {
            this.connect();
          }, this.reconnectDelay * this.reconnectAttempts);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
    }
  }

  private send(message: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
      // Try to reconnect
      this.connect();
    }
  }

  public on(type: string, callback: SignalingCallback) {
    if (!this.callbacks.has(type)) {
      this.callbacks.set(type, []);
    }
    this.callbacks.get(type)!.push(callback);
  }

  public off(type: string, callback: SignalingCallback) {
    const callbacks = this.callbacks.get(type);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  public createRoom(roomId: string, userId: string) {
    this.currentRoomId = roomId;
    this.currentUserId = userId;
    this.currentRole = 'host';
    
    this.send({
      type: 'create-room',
      roomId,
      userId
    });
  }

  public joinRoom(roomId: string, userId: string) {
    this.currentRoomId = roomId;
    this.currentUserId = userId;
    this.currentRole = 'viewer';
    
    this.send({
      type: 'join-room',
      roomId,
      userId
    });
  }

  public sendOffer(roomId: string, targetId: string, offer: RTCSessionDescriptionInit) {
    this.send({
      type: 'offer',
      roomId,
      targetId,
      data: offer
    });
  }

  public sendAnswer(roomId: string, targetId: string, answer: RTCSessionDescriptionInit) {
    this.send({
      type: 'answer',
      roomId,
      targetId,
      data: answer
    });
  }

  public sendIceCandidate(roomId: string, targetId: string, candidate: RTCIceCandidate) {
    this.send({
      type: 'ice-candidate',
      roomId,
      targetId,
      data: candidate
    });
  }

  public sendChatMessage(roomId: string, userId: string, username: string, text: string) {
    this.send({
      type: 'chat-message',
      roomId,
      userId,
      username,
      text
    });
  }

  public leaveRoom(roomId: string) {
    this.send({
      type: 'leave-room',
      roomId
    });
    
    this.currentRoomId = null;
    this.currentUserId = null;
    this.currentRole = null;
  }

  public disconnect() {
    this.isIntentionallyClosed = true;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.callbacks.clear();
    this.currentRoomId = null;
    this.currentUserId = null;
    this.currentRole = null;
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Export singleton instance
export const signalingService = new SignalingService();

// Generate unique peer ID
export function generatePeerId(): string {
  return `peer_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
}

// Generate unique room ID
export function generateRoomId(): string {
  return Math.random().toString(36).substr(2, 9);
}