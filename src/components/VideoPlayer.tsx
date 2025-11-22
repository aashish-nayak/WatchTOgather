import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Maximize2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VideoPlayerProps {
  stream: MediaStream | null;
  isLoading?: boolean;
}

export default function VideoPlayer({ stream, isLoading }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  return (
    <Card className="relative overflow-hidden bg-black">
      {isLoading && !stream && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-white mx-auto" />
            <p className="text-white">Connecting to stream...</p>
          </div>
        </div>
      )}
      {!stream && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <p className="text-white text-lg">No stream available</p>
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-contain"
        style={{ minHeight: '400px' }}
      />
      {stream && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute bottom-4 right-4 opacity-70 hover:opacity-100"
          onClick={handleFullscreen}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      )}
    </Card>
  );
}