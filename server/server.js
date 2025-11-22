import { WebSocketServer } from 'ws';
import express from 'express';
import { createServer } from 'http';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 5000;

// Store rooms and their connections
// Structure: { roomId: { host: WebSocket, viewers: Set<WebSocket> } }
const rooms = new Map();

// Store connection metadata
// Structure: { ws: { roomId: string, role: 'host' | 'viewer', userId: string } }
const connections = new WeakMap();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    rooms: rooms.size,
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'WatchTogether Signaling Server',
    version: '1.0.0',
    status: 'running'
  });
});

wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('Received message:', message.type, message.roomId);

      switch (message.type) {
        case 'create-room':
          handleCreateRoom(ws, message);
          break;
        case 'join-room':
          handleJoinRoom(ws, message);
          break;
        case 'offer':
        case 'answer':
        case 'ice-candidate':
          handleSignaling(ws, message);
          break;
        case 'leave-room':
          handleLeaveRoom(ws, message);
          break;
        case 'chat-message':
          handleChatMessage(ws, message);
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Invalid message format' 
      }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
    handleDisconnect(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    handleDisconnect(ws);
  });

  // Send welcome message
  ws.send(JSON.stringify({ 
    type: 'connected', 
    message: 'Connected to signaling server' 
  }));
});

function handleCreateRoom(ws, message) {
  const { roomId, userId } = message;

  if (rooms.has(roomId)) {
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'Room already exists' 
    }));
    return;
  }

  rooms.set(roomId, {
    host: ws,
    viewers: new Set()
  });

  connections.set(ws, { roomId, role: 'host', userId });

  ws.send(JSON.stringify({ 
    type: 'room-created', 
    roomId,
    userId
  }));

  console.log(`Room created: ${roomId} by host ${userId}`);
}

function handleJoinRoom(ws, message) {
  const { roomId, userId } = message;

  if (!rooms.has(roomId)) {
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'Room not found' 
    }));
    return;
  }

  const room = rooms.get(roomId);
  room.viewers.add(ws);
  connections.set(ws, { roomId, role: 'viewer', userId });

  // Notify the host about the new viewer
  if (room.host.readyState === 1) { // OPEN
    room.host.send(JSON.stringify({
      type: 'viewer-joined',
      roomId,
      userId
    }));
  }

  // Notify the viewer they've joined successfully
  ws.send(JSON.stringify({ 
    type: 'room-joined', 
    roomId,
    userId
  }));

  console.log(`Viewer ${userId} joined room ${roomId}`);
}

function handleSignaling(ws, message) {
  const { roomId, targetId, type } = message;
  const connection = connections.get(ws);

  if (!connection || connection.roomId !== roomId) {
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'Not in this room' 
    }));
    return;
  }

  const room = rooms.get(roomId);
  if (!room) {
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'Room not found' 
    }));
    return;
  }

  // Forward signaling message to the target peer
  if (connection.role === 'host') {
    // Host sending to a specific viewer
    for (const viewer of room.viewers) {
      const viewerConnection = connections.get(viewer);
      if (viewerConnection && viewerConnection.userId === targetId) {
        if (viewer.readyState === 1) {
          viewer.send(JSON.stringify({
            ...message,
            fromId: connection.userId
          }));
        }
        break;
      }
    }
  } else {
    // Viewer sending to host
    if (room.host.readyState === 1) {
      room.host.send(JSON.stringify({
        ...message,
        fromId: connection.userId
      }));
    }
  }
}

function handleChatMessage(ws, message) {
  const { roomId, text, userId, username } = message;
  const connection = connections.get(ws);

  if (!connection || connection.roomId !== roomId) {
    return;
  }

  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  const chatMessage = {
    type: 'chat-message',
    roomId,
    userId,
    username,
    text,
    timestamp: Date.now()
  };

  // Broadcast to host
  if (room.host.readyState === 1) {
    room.host.send(JSON.stringify(chatMessage));
  }

  // Broadcast to all viewers
  for (const viewer of room.viewers) {
    if (viewer.readyState === 1) {
      viewer.send(JSON.stringify(chatMessage));
    }
  }
}

function handleLeaveRoom(ws, message) {
  const { roomId } = message;
  const connection = connections.get(ws);

  if (!connection || connection.roomId !== roomId) {
    return;
  }

  removeFromRoom(ws, roomId, connection);
}

function handleDisconnect(ws) {
  const connection = connections.get(ws);
  if (connection) {
    removeFromRoom(ws, connection.roomId, connection);
  }
}

function removeFromRoom(ws, roomId, connection) {
  const room = rooms.get(roomId);
  if (!room) return;

  if (connection.role === 'host') {
    // Host disconnected - notify all viewers and close room
    for (const viewer of room.viewers) {
      if (viewer.readyState === 1) {
        viewer.send(JSON.stringify({
          type: 'host-left',
          roomId
        }));
      }
    }
    rooms.delete(roomId);
    console.log(`Room ${roomId} closed - host disconnected`);
  } else {
    // Viewer disconnected - remove from room and notify host
    room.viewers.delete(ws);
    if (room.host.readyState === 1) {
      room.host.send(JSON.stringify({
        type: 'viewer-left',
        roomId,
        userId: connection.userId
      }));
    }
    console.log(`Viewer ${connection.userId} left room ${roomId}`);
  }
}

server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});