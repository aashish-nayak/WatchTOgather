# WatchTogether Signaling Server

WebSocket signaling server for the WatchTogether WebRTC screen sharing application.

## Features

- WebSocket-based real-time signaling
- Room management (create, join, leave)
- WebRTC signaling relay (offer, answer, ICE candidates)
- Chat message broadcasting
- Multiple concurrent rooms support
- Health check endpoint
- Automatic cleanup on disconnect

## Local Development

### Prerequisites

- Node.js 16+ installed

### Setup

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

The server will start on port 8080 by default. You can change this by setting the `PORT` environment variable:

```bash
PORT=3001 npm start
```

### Health Check

Visit `http://localhost:8080/health` to check server status.

## Deployment

### Deploy to Render.com (Recommended for WebSocket)

1. Create a new Web Service on [Render](https://render.com)
2. Connect your GitHub repository
3. Configure the service:
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`
   - **Environment**: Node
4. Add environment variable (optional):
   - `PORT`: Will be automatically set by Render
5. Deploy

Your WebSocket server URL will be: `wss://your-app-name.onrender.com`

### Deploy to Railway.app

1. Create a new project on [Railway](https://railway.app)
2. Connect your GitHub repository
3. Configure:
   - **Root Directory**: `server`
   - **Start Command**: `npm start`
4. Deploy

### Deploy to Fly.io

1. Install Fly CLI: `https://fly.io/docs/hands-on/install-flyctl/`
2. Login: `flyctl auth login`
3. Create `fly.toml` in the server directory:

```toml
app = "watchtogether-signaling"

[build]
  builder = "heroku/buildpacks:20"

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443
```

4. Deploy: `flyctl deploy`

### Environment Variables

- `PORT`: Server port (default: 8080)

## API Documentation

### WebSocket Messages

#### Client → Server

**Create Room**
```json
{
  "type": "create-room",
  "roomId": "room123",
  "userId": "host-id"
}
```

**Join Room**
```json
{
  "type": "join-room",
  "roomId": "room123",
  "userId": "viewer-id"
}
```

**WebRTC Signaling**
```json
{
  "type": "offer|answer|ice-candidate",
  "roomId": "room123",
  "targetId": "peer-id",
  "data": { /* WebRTC data */ }
}
```

**Chat Message**
```json
{
  "type": "chat-message",
  "roomId": "room123",
  "userId": "user-id",
  "username": "User Name",
  "text": "Hello!"
}
```

**Leave Room**
```json
{
  "type": "leave-room",
  "roomId": "room123"
}
```

#### Server → Client

**Room Created**
```json
{
  "type": "room-created",
  "roomId": "room123",
  "userId": "host-id"
}
```

**Room Joined**
```json
{
  "type": "room-joined",
  "roomId": "room123",
  "userId": "viewer-id"
}
```

**Viewer Joined** (to host)
```json
{
  "type": "viewer-joined",
  "roomId": "room123",
  "userId": "viewer-id"
}
```

**Host Left** (to viewers)
```json
{
  "type": "host-left",
  "roomId": "room123"
}
```

**Error**
```json
{
  "type": "error",
  "message": "Error description"
}
```

## Testing

You can test the WebSocket server using tools like:
- [Postman](https://www.postman.com/) (supports WebSocket)
- [wscat](https://github.com/websockets/wscat): `npm install -g wscat`

Example with wscat:
```bash
wscat -c ws://localhost:8080
> {"type":"create-room","roomId":"test123","userId":"host1"}
```

## Troubleshooting

### Connection Issues

- Ensure the server is running and accessible
- Check firewall settings
- Verify WebSocket URL format: `ws://` for local, `wss://` for production

### CORS Issues

The server accepts WebSocket connections from any origin. If you need to restrict origins, modify the WebSocket server configuration.

## License

MIT