import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Monitor, MonitorOff, Copy, Users, ArrowLeft } from 'lucide-react';
import Chat, { ChatMessage } from '@/components/Chat';
import VideoPlayer from '@/components/VideoPlayer';
import { WebRTCManager } from '@/lib/webrtc';
import { SignalingService, generatePeerId } from '@/lib/signaling';

export default function Host() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [isSharing, setIsSharing] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [webrtcManager] = useState(() => new WebRTCManager());
  const [signalingService] = useState(() => new SignalingService(roomId!, generatePeerId()));
  const [connectedPeers, setConnectedPeers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!roomId) {
      navigate('/');
      return;
    }

    // Setup signaling handlers
    signalingService.onMessage('join', async (message) => {
      console.log('Viewer joined:', message.peerId);
      
      if (!isSharing) {
        toast.error('Please start screen sharing first');
        return;
      }

      try {
        // Create peer connection for new viewer
        const peerConnection = webrtcManager.createHostConnection(
          message.peerId,
          (candidate) => {
            signalingService.sendMessage('ice-candidate', {
              target: message.peerId,
              candidate,
            });
          },
          (state) => {
            console.log(`Connection state for ${message.peerId}:`, state);
            if (state === 'connected') {
              setConnectedPeers((prev) => new Set(prev).add(message.peerId));
              setViewerCount((prev) => prev + 1);
            } else if (state === 'disconnected' || state === 'failed') {
              setConnectedPeers((prev) => {
                const newSet = new Set(prev);
                newSet.delete(message.peerId);
                return newSet;
              });
              setViewerCount((prev) => Math.max(0, prev - 1));
            }
          }
        );

        // Setup data channel for chat
        const dataChannel = webrtcManager.getDataChannel(message.peerId);
        if (dataChannel) {
          dataChannel.onmessage = (event) => {
            const chatMessage: ChatMessage = JSON.parse(event.data);
            setMessages((prev) => [...prev, chatMessage]);
          };
        }

        // Create and send offer
        const offer = await webrtcManager.createOffer(message.peerId);
        signalingService.sendMessage('offer', {
          target: message.peerId,
          offer,
        });
      } catch (error) {
        console.error('Error handling viewer join:', error);
        toast.error('Failed to connect to viewer');
      }
    });

    signalingService.onMessage('answer', async (message) => {
      if (message.data.target === signalingService['peerId']) {
        try {
          await webrtcManager.setRemoteDescription(
            message.peerId,
            message.data.answer
          );
        } catch (error) {
          console.error('Error setting remote description:', error);
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

    signalingService.onMessage('leave', (message) => {
      webrtcManager.closePeerConnection(message.peerId);
      setConnectedPeers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(message.peerId);
        return newSet;
      });
      setViewerCount((prev) => Math.max(0, prev - 1));
    });

    return () => {
      webrtcManager.closeAllConnections();
      signalingService.cleanup();
    };
  }, [roomId, navigate, signalingService, webrtcManager, isSharing]);

  const handleStartSharing = async () => {
    try {
      const stream = await webrtcManager.startScreenShare();
      setLocalStream(stream);
      setIsSharing(true);
      toast.success('Screen sharing started');

      // Handle when user stops sharing via browser UI
      stream.getVideoTracks()[0].onended = () => {
        handleStopSharing();
      };
    } catch (error) {
      console.error('Error starting screen share:', error);
      toast.error('Failed to start screen sharing');
    }
  };

  const handleStopSharing = () => {
    webrtcManager.stopScreenShare();
    setLocalStream(null);
    setIsSharing(false);
    toast.info('Screen sharing stopped');
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/viewer/${roomId}`;
    navigator.clipboard.writeText(link);
    toast.success('Room link copied to clipboard');
  };

  const handleSendMessage = useCallback((text: string) => {
    const message: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'Host',
      text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, message]);

    // Broadcast to all connected viewers
    connectedPeers.forEach((peerId) => {
      webrtcManager.sendMessage(peerId, JSON.stringify(message));
    });
  }, [connectedPeers, webrtcManager]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            <Users className="h-4 w-4 mr-2" />
            {viewerCount} Viewer{viewerCount !== 1 ? 's' : ''}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Host Controls</CardTitle>
            <CardDescription>Room ID: {roomId}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              {!isSharing ? (
                <Button onClick={handleStartSharing} size="lg">
                  <Monitor className="h-4 w-4 mr-2" />
                  Start Screen Share
                </Button>
              ) : (
                <Button onClick={handleStopSharing} variant="destructive" size="lg">
                  <MonitorOff className="h-4 w-4 mr-2" />
                  Stop Sharing
                </Button>
              )}
              <Button onClick={handleCopyLink} variant="outline" size="lg">
                <Copy className="h-4 w-4 mr-2" />
                Copy Room Link
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <VideoPlayer stream={localStream} />
          </div>
          <div className="h-[500px]">
            <Chat
              messages={messages}
              onSendMessage={handleSendMessage}
              userName="Host"
            />
          </div>
        </div>
      </div>
    </div>
  );
}