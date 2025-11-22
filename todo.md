# WebRTC Screen Sharing App - Development Plan

## Project Overview
A WebRTC-based screen sharing application similar to Google Meet's screenshare feature, allowing a host to share their screen and audio with multiple viewers in real-time.

## Core Features
1. Host Interface - Screen sharing controls, start/stop sharing
2. Viewer Interface - Join rooms and watch shared content
3. Real-time Chat - Messaging between host and viewers
4. Room System - Create/join rooms via shareable links
5. WebRTC Management - Handle multiple peer connections

## File Structure (Max 8 files)

### 1. `src/App.tsx` (Main routing and app structure)
- Route handling for home, host, and viewer pages
- Room ID management

### 2. `src/pages/Home.tsx` (Landing page)
- Create room button (generates unique room ID)
- Join room input field
- Navigation to host or viewer interfaces

### 3. `src/pages/Host.tsx` (Host interface)
- Screen sharing controls (start/stop)
- Audio sharing toggle
- Display room link for sharing
- Show connected viewers count
- Chat interface
- WebRTC connection management for broadcasting

### 4. `src/pages/Viewer.tsx` (Viewer interface)
- Video element to display shared screen
- Audio playback
- Chat interface
- Connection status indicator
- WebRTC connection management for receiving

### 5. `src/components/Chat.tsx` (Chat component)
- Message display area
- Message input field
- Send button
- Real-time message updates via WebRTC data channel

### 6. `src/components/VideoPlayer.tsx` (Video display component)
- Video element with controls
- Full-screen support
- Loading states

### 7. `src/lib/webrtc.ts` (WebRTC utility functions)
- Peer connection creation
- Screen capture API integration
- Audio capture handling
- ICE candidate management
- Data channel setup for chat
- Connection state management

### 8. `src/lib/signaling.ts` (Signaling server simulation)
- Simple in-memory signaling for MVP
- Room management
- Peer discovery
- Message relay between peers

## Implementation Strategy (MVP - Simplest Approach)
- Use simple peer-to-peer WebRTC without external signaling server initially
- Implement basic room system with URL parameters
- Use WebRTC data channels for chat
- Focus on 1 host to multiple viewers architecture
- Minimal UI with essential controls only

## Tech Stack
- React with TypeScript
- Shadcn-ui components
- Tailwind CSS
- WebRTC APIs (getUserMedia, getDisplayMedia, RTCPeerConnection)
- React Router for navigation

## Development Steps
1. Set up basic routing structure
2. Create Home page with room creation/joining
3. Implement WebRTC utilities for screen/audio capture
4. Build Host interface with sharing controls
5. Build Viewer interface with playback
6. Add Chat component with data channels
7. Test and fix connection issues
8. Lint and build check