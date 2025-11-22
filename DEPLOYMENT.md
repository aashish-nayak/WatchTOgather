# WatchTogether Deployment Guide

This guide covers deploying both the frontend (React app) and backend (WebSocket signaling server) for the WatchTogether screen sharing application.

## Architecture Overview

The application consists of two parts:
1. **Frontend**: React + Vite application (deployed to Vercel)
2. **Backend**: Node.js WebSocket signaling server (deployed to Render/Railway/Fly.io)

## Prerequisites

- Node.js 16+ installed
- pnpm installed (`npm install -g pnpm`)
- Git repository set up
- Accounts on Vercel and Render (or Railway/Fly.io)

## Part 1: Deploy the WebSocket Signaling Server

### Option A: Deploy to Render.com (Recommended)

Render provides excellent WebSocket support with a free tier.

1. **Create a Render Account**
   - Go to [render.com](https://render.com) and sign up

2. **Create a New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure the service:
     - **Name**: `watchtogether-signaling` (or your choice)
     - **Root Directory**: `server`
     - **Environment**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Plan**: Free (or paid for better performance)

3. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Your WebSocket URL will be: `wss://watchtogether-signaling.onrender.com`

4. **Note the WebSocket URL**
   - Copy the URL (e.g., `wss://watchtogether-signaling.onrender.com`)
   - You'll need this for the frontend deployment

### Option B: Deploy to Railway.app

1. **Create a Railway Account**
   - Go to [railway.app](https://railway.app) and sign up

2. **Create a New Project**
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Configure:
     - **Root Directory**: `server`
     - **Start Command**: `npm start`

3. **Deploy**
   - Railway will automatically deploy
   - Get your WebSocket URL from the deployment settings

### Option C: Deploy to Fly.io

1. **Install Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login to Fly**
   ```bash
   flyctl auth login
   ```

3. **Create fly.toml in server directory**
   ```bash
   cd server
   ```

   Create `fly.toml`:
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

4. **Deploy**
   ```bash
   flyctl deploy
   ```

5. **Get WebSocket URL**
   ```bash
   flyctl info
   ```

## Part 2: Deploy the Frontend to Vercel

### Step 1: Configure Environment Variables

1. **Create .env.production file**
   
   In the root directory (`/workspace/shadcn-ui`), create `.env.production`:
   ```
   VITE_WS_URL=wss://your-signaling-server.onrender.com
   ```
   
   Replace `your-signaling-server.onrender.com` with your actual WebSocket server URL from Part 1.

### Step 2: Deploy to Vercel

#### Method 1: Using Vercel CLI (Recommended)

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   cd /workspace/shadcn-ui
   vercel
   ```

4. **Follow the prompts**
   - Set up and deploy: Yes
   - Which scope: Select your account
   - Link to existing project: No
   - Project name: `watchtogether` (or your choice)
   - Directory: `./` (current directory)
   - Override settings: No

5. **Add Environment Variable**
   ```bash
   vercel env add VITE_WS_URL production
   ```
   Enter your WebSocket URL: `wss://your-signaling-server.onrender.com`

6. **Redeploy with environment variable**
   ```bash
   vercel --prod
   ```

#### Method 2: Using Vercel Dashboard

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Add WebSocket signaling and deployment config"
   git push origin main
   ```

2. **Import Project to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Configure:
     - **Framework Preset**: Vite
     - **Root Directory**: `./`
     - **Build Command**: `pnpm install && pnpm run build`
     - **Output Directory**: `dist`

3. **Add Environment Variables**
   - In project settings → Environment Variables
   - Add: `VITE_WS_URL` = `wss://your-signaling-server.onrender.com`
   - Select: Production, Preview, Development

4. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete

## Part 3: Testing the Deployment

1. **Open your Vercel URL**
   - Example: `https://watchtogether.vercel.app`

2. **Test as Host**
   - Click "Start as Host"
   - Enter a room name
   - Click "Start Sharing"
   - Share the room link with viewers

3. **Test as Viewer**
   - Open the shared link in another browser/device
   - You should see the host's screen

4. **Test Chat**
   - Send messages between host and viewers
   - Verify real-time communication

## Troubleshooting

### WebSocket Connection Failed

**Problem**: Frontend can't connect to WebSocket server

**Solutions**:
1. Verify the WebSocket URL in environment variables
2. Check if the signaling server is running (visit health endpoint)
3. Ensure you're using `wss://` (not `ws://`) for production
4. Check browser console for specific error messages

### CORS Issues

**Problem**: Cross-origin request blocked

**Solution**: The WebSocket server accepts connections from any origin by default. If you need to restrict origins, modify `server/server.js`.

### Screen Sharing Not Working

**Problem**: Screen sharing fails to start

**Solutions**:
1. Ensure you're using HTTPS (Vercel provides this automatically)
2. Check browser permissions for screen sharing
3. Verify WebRTC is supported in your browser
4. Check browser console for errors

### Render Free Tier Limitations

**Problem**: Server goes to sleep after inactivity

**Solution**: 
- Upgrade to paid tier for always-on service
- Or implement a keep-alive ping from the frontend

## Environment Variables Reference

### Frontend (.env.production)
```
VITE_WS_URL=wss://your-signaling-server.onrender.com
```

### Backend (Render/Railway/Fly.io)
```
PORT=8080  # Usually set automatically by the platform
```

## Local Development

### Running Locally

1. **Start the signaling server**
   ```bash
   cd server
   npm install
   npm start
   ```

2. **Start the frontend** (in a new terminal)
   ```bash
   cd /workspace/shadcn-ui
   pnpm install
   pnpm run dev
   ```

3. **Access the app**
   - Open `http://localhost:5173`

### Local Environment Variables

Create `.env.local` in the root directory:
```
VITE_WS_URL=ws://localhost:8080
```

## Production Checklist

- [ ] WebSocket server deployed and accessible
- [ ] Health check endpoint working (`/health`)
- [ ] Frontend deployed to Vercel
- [ ] Environment variable `VITE_WS_URL` set correctly
- [ ] HTTPS enabled (automatic on Vercel)
- [ ] Screen sharing works in production
- [ ] Chat functionality works
- [ ] Multiple viewers can join simultaneously
- [ ] Connection cleanup works when users leave

## Monitoring

### Check Server Health

Visit your signaling server's health endpoint:
```
https://your-signaling-server.onrender.com/health
```

Should return:
```json
{
  "status": "ok",
  "rooms": 0,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### Check Logs

**Render**: Dashboard → Logs tab
**Railway**: Dashboard → Deployments → View Logs
**Fly.io**: `flyctl logs`

## Scaling Considerations

For production use with many concurrent users:

1. **Upgrade Server Plan**: Move from free tier to paid for better performance
2. **Add Load Balancing**: Use multiple server instances
3. **Implement TURN Server**: For better NAT traversal (consider Twilio, Xirsys, or self-hosted coturn)
4. **Add Analytics**: Track usage and performance
5. **Implement Rate Limiting**: Prevent abuse

## Support

For issues or questions:
- Check the server logs
- Review browser console errors
- Verify environment variables
- Test WebSocket connection directly

## License

MIT