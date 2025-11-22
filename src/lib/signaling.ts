// Simple signaling mechanism using localStorage and custom events for MVP
// In production, this should be replaced with a WebSocket server

export interface SignalingData {
  target?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave';
  roomId: string;
  peerId: string;
  data?: SignalingData;
  timestamp: number;
}

export class SignalingService {
  private roomId: string;
  private peerId: string;
  private messageHandlers: Map<string, (message: SignalingMessage) => void> =
    new Map();

  constructor(roomId: string, peerId: string) {
    this.roomId = roomId;
    this.peerId = peerId;
    this.setupListener();
  }

  private setupListener() {
    window.addEventListener('storage', (event) => {
      if (event.key === `signaling_${this.roomId}`) {
        const messages: SignalingMessage[] = JSON.parse(event.newValue || '[]');
        messages.forEach((message) => {
          if (message.peerId !== this.peerId) {
            const handler = this.messageHandlers.get(message.type);
            if (handler) {
              handler(message);
            }
          }
        });
      }
    });

    // Also check for messages periodically (for same-tab communication)
    setInterval(() => {
      this.checkMessages();
    }, 500);
  }

  private checkMessages() {
    const key = `signaling_${this.roomId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const messages: SignalingMessage[] = JSON.parse(stored);
      const recentMessages = messages.filter(
        (m) => Date.now() - m.timestamp < 5000 && m.peerId !== this.peerId
      );

      recentMessages.forEach((message) => {
        const handler = this.messageHandlers.get(message.type);
        if (handler) {
          handler(message);
        }
      });
    }
  }

  sendMessage(type: SignalingMessage['type'], data?: SignalingData) {
    const key = `signaling_${this.roomId}`;
    const stored = localStorage.getItem(key);
    const messages: SignalingMessage[] = stored ? JSON.parse(stored) : [];

    const message: SignalingMessage = {
      type,
      roomId: this.roomId,
      peerId: this.peerId,
      data,
      timestamp: Date.now(),
    };

    // Keep only recent messages (last 10 seconds)
    const recentMessages = messages.filter(
      (m) => Date.now() - m.timestamp < 10000
    );
    recentMessages.push(message);

    localStorage.setItem(key, JSON.stringify(recentMessages));

    // Trigger storage event manually for same-tab communication
    window.dispatchEvent(
      new StorageEvent('storage', {
        key,
        newValue: JSON.stringify(recentMessages),
      })
    );
  }

  onMessage(type: SignalingMessage['type'], handler: (message: SignalingMessage) => void) {
    this.messageHandlers.set(type, handler);
  }

  cleanup() {
    this.sendMessage('leave');
    this.messageHandlers.clear();
  }
}

// Generate unique peer ID
export function generatePeerId(): string {
  return `peer_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
}

// Generate unique room ID
export function generateRoomId(): string {
  return Math.random().toString(36).substr(2, 9);
}