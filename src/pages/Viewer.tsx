/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Wifi, WifiOff } from 'lucide-react';
import Chat, { ChatMessage } from '@/components/Chat';
import VideoPlayer from '@/components/VideoPlayer';
import { WebRTCManager } from '@/lib/webrtc';
import { signalingService, generatePeerId } from '@/lib/signaling';

export default function Viewer() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [webrtcManager] = useState(() => new WebRTCManager());
  const [peerId] = useState(() => generatePeerId('viewer'));
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const [isSignalingReady, setIsSignalingReady] = useState(false);
  const initRef = useRef(false);

  // Initialize signaling service
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    console.log('Starting signaling service...');
    signalingService.start(true);

    // Wait for connection
    const checkConnection = setInterval(() => {
      if (signalingService.isConnected()) {
        console.log('Signaling service connected');
        setIsSignalingReady(true);
        clearInterval(checkConnection);
      }
    }, 100);

    return () => {
      clearInterval(checkConnection);
    };
  }, []);

  useEffect(() => {
    if (!roomId || !isSignalingReady) {
      if (!roomId) navigate('/');
      return;
    }

    console.log('Joining room:', roomId, 'with peerId:', peerId);
    signalingService.joinRoom(roomId, peerId);

    const handleRoomJoined = (message: any) => {
      console.log('Room joined successfully:', message);
      toast.success('Joined room successfully');
    };

    const handleOffer = async (message: any) => {
      console.log('Received offer from host:', message.fromId);

      try {
        const peerConnection = webrtcManager.createViewerConnection(
          message.fromId,
          (stream) => {
            console.log('Received remote stream');
            setRemoteStream(stream);
            setIsConnected(true);
            setIsConnecting(false);
            toast.success('Connected to host');
          },
          (channel) => {
            console.log('Data channel received');
            setDataChannel(channel);
            channel.onopen = () => {
              console.log('Data channel opened');
            };
            channel.onmessage = (event) => {
              try {
                const chatMessage: ChatMessage = JSON.parse(event.data);
                setMessages((prev) => [...prev, chatMessage]);
              } catch (e) {
                console.error('Failed to parse chat message:', e);
              }
            };
          },
          (candidate) => {
            console.log('Sending ICE candidate');
            signalingService.sendIceCandidate(roomId, message.fromId, candidate);
          },
          (state) => {
            console.log('Connection state:', state);
            if (state === 'connected') {
              setIsConnected(true);
              setIsConnecting(false);
            } else if (state === 'disconnected' || state === 'failed') {
              setIsConnected(false);
              setIsConnecting(false);
              toast.error('Disconnected from host');
            }
          }
        );

        // Set remote description and create answer
        console.log('Setting remote description');
        await webrtcManager.setRemoteDescription(message.fromId, message.data);
        
        console.log('Creating answer');
        const answer = await webrtcManager.createAnswer(message.fromId);
        
        console.log('Sending answer to host');
        await signalingService.sendAnswer(roomId, message.fromId, answer);
      } catch (error) {
        console.error('Error handling offer:', error);
        setIsConnecting(false);
        toast.error('Failed to connect to host');
      }
    };

    const handleIceCandidate = async (message: any) => {
      console.log('Received ICE candidate from:', message.fromId);
      if (message.data) {
        try {
          await webrtcManager.addIceCandidate(message.fromId, message.data);
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    };

    const handleHostLeft = () => {
      console.log('Host left the room');
      setIsConnected(false);
      setRemoteStream(null);
      toast.error('Host has left the room');
    };

    const handleChatMessage = (message: any) => {
      console.log('Received chat message:', message);
      const chatMessage: ChatMessage = {
        id: `msg_${message.timestamp}`,
        sender: message.username || 'Host',
        text: message.text,
        timestamp: message.timestamp,
      };
      setMessages((prev) => [...prev, chatMessage]);
    };

    const handleError = (message: any) => {
      console.error('Signaling error:', message);
      toast.error(message.message || 'An error occurred');
    };

    signalingService.on('room-joined', handleRoomJoined);
    signalingService.on('offer', handleOffer);
    signalingService.on('ice-candidate', handleIceCandidate);
    signalingService.on('host-left', handleHostLeft);
    signalingService.on('chat-message', handleChatMessage);
    signalingService.on('error', handleError);

    return () => {
      console.log('Cleaning up viewer component');
      webrtcManager.closeAllConnections();
      signalingService.leaveRoom(roomId);
      signalingService.off('room-joined', handleRoomJoined);
      signalingService.off('offer', handleOffer);
      signalingService.off('ice-candidate', handleIceCandidate);
      signalingService.off('host-left', handleHostLeft);
      signalingService.off('chat-message', handleChatMessage);
      signalingService.off('error', handleError);
    };
  }, [roomId, navigate, peerId, webrtcManager, isSignalingReady]);

  const handleSendMessage = useCallback((text: string) => {
    const message: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'Viewer',
      text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, message]);

    // Send via signaling server
    if (roomId) {
      signalingService.sendChatMessage(roomId, peerId, 'Viewer', text);
    }

    // Also try data channel if available
    if (dataChannel && dataChannel.readyState === 'open') {
      try {
        dataChannel.send(JSON.stringify(message));
      } catch (e) {
        console.warn('Failed to send via data channel');
      }
    }
  }, [dataChannel, roomId, peerId]);

  if (!isSignalingReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <p className="text-lg">Connecting to signaling server...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Leave Room
          </Button>
          <Badge variant={isConnected ? 'default' : 'secondary'} className="text-lg px-4 py-2">
            {isConnected ? (
              <>
                <Wifi className="h-4 w-4 mr-2" />
                Connected
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 mr-2" />
                {isConnecting ? 'Connecting...' : 'Disconnected'}
              </>
            )}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Viewing Room</CardTitle>
            <CardDescription>Room ID: {roomId}</CardDescription>
          </CardHeader>
          <CardContent>
            {!isConnected && !isConnecting && (
              <p className="text-muted-foreground">
                Waiting for host to start screen sharing...
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <VideoPlayer stream={remoteStream} isLoading={isConnecting} />
          </div>
          <div className="h-[500px]">
            <Chat
              messages={messages}
              onSendMessage={handleSendMessage}
              userName="Viewer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}