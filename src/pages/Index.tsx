import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Monitor, Users } from 'lucide-react';
import { generateRoomId } from '@/lib/signaling';

export default function Home() {
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    const newRoomId = generateRoomId();
    navigate(`/host/${newRoomId}`);
  };

  const handleJoinRoom = () => {
    if (roomId.trim()) {
      navigate(`/viewer/${roomId.trim()}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Monitor className="h-12 w-12 text-indigo-600" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              WatchTogether
            </h1>
          </div>
          <p className="text-xl text-muted-foreground">
            Share your screen and watch movies together with friends
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Host a Session
              </CardTitle>
              <CardDescription>
                Start sharing your screen and audio with others
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleCreateRoom}
                className="w-full"
                size="lg"
              >
                Create Room
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Join a Session
              </CardTitle>
              <CardDescription>
                Enter a room code to watch together
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Enter room code"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
              />
              <Button
                onClick={handleJoinRoom}
                className="w-full"
                size="lg"
                disabled={!roomId.trim()}
              >
                Join Room
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-sm text-muted-foreground animate-in fade-in duration-700 delay-300">
          <p>Powered by WebRTC • Peer-to-peer screen sharing</p>
        </div>
      </div>
    </div>
  );
}