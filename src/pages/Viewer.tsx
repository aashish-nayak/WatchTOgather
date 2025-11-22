import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Wifi, WifiOff } from 'lucide-react';
import Chat, { ChatMessage } from '@/components/Chat';
import VideoPlayer from '@/components/VideoPlayer';
import { WebRTCManager } from '@/lib/webrtc';
import { SignalingService, generatePeerId } from '@/lib/signaling';

export default function Viewer() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [webrtcManager] = useState(() => new WebRTCManager());
  const [signalingService] = useState(() => new SignalingService(roomId!, generatePeerId()));
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const [hostPeerId, setHostPeerId] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) {
      navigate('/');
      return;
    }

    // Setup signaling handlers
    signalingService.onMessage('offer', async (message) => {
      if (message.data.target === signalingService['peerId']) {
        console.log('Received offer from host:', message.peerId);
        setHostPeerId(message.peerId);

        try {
          // Create peer connection for viewer
          const peerConnection = webrtcManager.createViewerConnection(
            message.peerId,
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
              channel.onmessage = (event) => {
                const chatMessage: ChatMessage = JSON.parse(event.data);
                setMessages((prev) => [...prev, chatMessage]);
              };
            },
            (candidate) => {
              signalingService.sendMessage('ice-candidate', {
                target: message.peerId,
                candidate,
              });
            },
            (state) => {
              console.log('Connection state:', state);
              if (state === 'connected') {
                setIsConnected(true);
                setIsConnecting(false);
              } else if (state === 'disconnected' || state === 'failed') {
                setIsConnected(false);
                toast.error('Disconnected from host');
              }
            }
          );

          // Set remote description and create answer
          await webrtcManager.setRemoteDescription(
            message.peerId,
            message.data.offer
          );
          const answer = await webrtcManager.createAnswer(message.peerId);
          
          signalingService.sendMessage('answer', {
            target: message.peerId,
            answer,
          });
        } catch (error) {
          console.error('Error handling offer:', error);
          setIsConnecting(false);
          toast.error('Failed to connect to host');
        }
      }
    });

    signalingService.onMessage('ice-candidate', async (message) => {
      if (message.data.target === signalingService['peerId']) {
        try {
          await webrtcManager.addIceCandidate(
            message.peerId,
            message.data.candidate
          );
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    });

    // Announce presence to host
    signalingService.sendMessage('join');

    return () => {
      webrtcManager.closeAllConnections();
      signalingService.cleanup();
    };
  }, [roomId, navigate, signalingService, webrtcManager]);

  const handleSendMessage = useCallback((text: string) => {
    const message: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'Viewer',
      text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, message]);

    if (dataChannel && dataChannel.readyState === 'open') {
      dataChannel.send(JSON.stringify(message));
    } else {
      toast.error('Chat not connected');
    }
  }, [dataChannel]);

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