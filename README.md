# WatchTogether - WebRTC Screen Sharing Application

A real-time screen sharing application built with React, TypeScript, and WebRTC. Share your screen and audio with multiple viewers, similar to Google Meet's screen sharing feature.

## Features

- 🖥️ **Real-time Screen Sharing**: Share your screen and audio with multiple viewers
- 💬 **Live Chat**: Real-time messaging between hosts and viewers
- 🔒 **Room-based Sessions**: Create private rooms with unique IDs
- 🌐 **WebRTC Technology**: Peer-to-peer connections for low latency
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🎨 **Modern UI**: Built with Shadcn-ui and Tailwind CSS

## Architecture

The application consists of two parts:

1. **Frontend**: React + Vite application
   - WebRTC peer connections
   - Screen capture API
   - Real-time chat interface

2. **Backend**: Node.js WebSocket signaling server
   - Room management
   - WebRTC signaling relay
   - Message broadcasting

## Quick Start

### Prerequisites

- Node.js 16+
- pnpm (or npm/yarn)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd shadcn-ui
   ```

2. **Install frontend dependencies**
   ```bash
   pnpm install
   ```

3. **Install server dependencies**
   ```bash
   cd server
   npm install
   cd ..
   ```

4. **Start the signaling server**
   ```bash
   cd server
   npm start
   ```
   
   The server will start on `http://localhost:8080`

5. **Start the frontend** (in a new terminal)
   ```bash
   pnpm run dev
   ```
   
   The app will be available at `http://localhost:5173`

6. **Open the application**
   - Navigate to `http://localhost:5173`
   - Click "Start as Host" to create a room
   - Share the room link with viewers

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy Summary

1. **Deploy Signaling Server** to Render/Railway/Fly.io
2. **Deploy Frontend** to Vercel
3. **Configure Environment Variables**:
   - Set `VITE_WS_URL` to your WebSocket server URL

## Project Structure

```
shadcn-ui/
├── server/                 # WebSocket signaling server
│   ├── server.js          # Main server file
│   ├── package.json       # Server dependencies
│   └── README.md          # Server documentation
├── src/
│   ├── components/        # React components
│   ├── pages/            # Page components
│   │   ├── Home.tsx      # Landing page
│   │   ├── Host.tsx      # Host interface
│   │   └── Viewer.tsx    # Viewer interface
│   ├── lib/
│   │   ├── webrtc.ts     # WebRTC utilities
│   │   └── signaling.ts  # WebSocket signaling
│   └── App.tsx           # Main app component
├── public/               # Static assets
├── DEPLOYMENT.md         # Deployment guide
└── README.md            # This file
```

## Usage

### As a Host

1. Click "Start as Host" on the home page
2. Enter a room name
3. Click "Start Sharing" and select your screen
4. Share the room link with viewers
5. Use the chat to communicate with viewers

### As a Viewer

1. Click on the shared room link
2. Enter your name
3. Click "Join Room"
4. Watch the host's screen and participate in chat

## Technology Stack

- **Frontend**:
  - React 18
  - TypeScript
  - Vite
  - Shadcn-ui
  - Tailwind CSS
  - React Router
  - WebRTC API

- **Backend**:
  - Node.js
  - WebSocket (ws library)
  - Express (for health checks)

## Environment Variables

### Frontend

Create a `.env.local` file:

```env
VITE_WS_URL=ws://localhost:8080
```

For production, create `.env.production`:

```env
VITE_WS_URL=wss://your-signaling-server.onrender.com
```

### Backend

The server uses the `PORT` environment variable (default: 8080).

## Development

### Build for Production

```bash
pnpm run build
```

### Lint Code

```bash
pnpm run lint
```

### Preview Production Build

```bash
pnpm run preview
```

## Browser Support

- Chrome/Edge 74+
- Firefox 66+
- Safari 12.1+
- Opera 62+

Note: Screen sharing requires HTTPS in production.

## Troubleshooting

### WebSocket Connection Failed

- Verify the signaling server is running
- Check the `VITE_WS_URL` environment variable
- Ensure you're using `wss://` for production (HTTPS)

### Screen Sharing Not Working

- Ensure you're using HTTPS (required for screen capture API)
- Check browser permissions
- Try a different browser

### No Video/Audio

- Check WebRTC peer connection status
- Verify firewall settings
- Consider using a TURN server for NAT traversal

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.

## Acknowledgments

- Built with [Shadcn-ui](https://ui.shadcn.com/)
- WebRTC implementation inspired by various open-source projects
- Icons from [Lucide React](https://lucide.dev/)