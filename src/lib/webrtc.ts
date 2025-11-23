// Fixed WebRTC utility functions for screen sharing and peer connections

export interface PeerConnection {
  id: string;
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
}

export class WebRTCManager {
  private peerConnections: Map<string, PeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  };

  // Start screen and audio capture for host
  async startScreenShare(): Promise<MediaStream> {
    try {
      console.log('Requesting screen share...');
      
      // Try to get screen with audio first
      let screenStream: MediaStream;
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
          } as any,
          audio: true,
        });
      } catch (err) {
        console.warn('Failed to get display media with audio, trying without:', err);
        // Fallback to video only
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
          } as any,
          audio: false,
        });
      }

      console.log('Screen share obtained, tracks:', 
        screenStream.getTracks().map(t => `${t.kind}: ${t.label}`)
      );

      this.localStream = screenStream;
      return screenStream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      throw error;
    }
  }

  // Stop screen sharing
  stopScreenShare() {
    if (this.localStream) {
      console.log('Stopping screen share');
      this.localStream.getTracks().forEach((track) => {
        track.stop();
        console.log('Stopped track:', track.kind, track.label);
      });
      this.localStream = null;
    }
  }

  // Create peer connection for host (broadcaster)
  createHostConnection(
    peerId: string,
    onIceCandidate: (candidate: RTCIceCandidate) => void,
    onConnectionStateChange: (state: string) => void
  ): RTCPeerConnection {
    console.log('Creating host connection for peer:', peerId);
    
    const peerConnection = new RTCPeerConnection(this.configuration);

    // Add local stream tracks to peer connection
    if (this.localStream) {
      console.log('Adding tracks to peer connection:', 
        this.localStream.getTracks().map(t => `${t.kind}: ${t.label}`)
      );
      
      this.localStream.getTracks().forEach((track) => {
        if (this.localStream) {
          peerConnection.addTrack(track, this.localStream);
          console.log('Added track:', track.kind, track.label);
        }
      });
    } else {
      console.warn('No local stream available when creating host connection');
    }

    // Create data channel for chat
    const dataChannel = peerConnection.createDataChannel('chat');
    console.log('Data channel created');

    dataChannel.onopen = () => {
      console.log('Data channel opened for peer:', peerId);
    };

    dataChannel.onclose = () => {
      console.log('Data channel closed for peer:', peerId);
    };

    dataChannel.onerror = (error) => {
      console.error('Data channel error for peer:', peerId, error);
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('ICE candidate generated for peer:', peerId);
        onIceCandidate(event.candidate);
      } else {
        console.log('ICE candidate gathering complete for peer:', peerId);
      }
    };

    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state for', peerId, ':', peerConnection.iceConnectionState);
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state for', peerId, ':', peerConnection.connectionState);
      onConnectionStateChange(peerConnection.connectionState);
    };

    this.peerConnections.set(peerId, {
      id: peerId,
      connection: peerConnection,
      dataChannel,
    });

    return peerConnection;
  }

  // Create peer connection for viewer
  createViewerConnection(
    peerId: string,
    onTrack: (stream: MediaStream) => void,
    onDataChannel: (channel: RTCDataChannel) => void,
    onIceCandidate: (candidate: RTCIceCandidate) => void,
    onConnectionStateChange: (state: string) => void
  ): RTCPeerConnection {
    console.log('Creating viewer connection for peer:', peerId);
    
    const peerConnection = new RTCPeerConnection(this.configuration);

    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
      console.log('Track received:', event.track.kind, event.streams.length, 'streams');
      if (event.streams && event.streams[0]) {
        console.log('Stream tracks:', event.streams[0].getTracks().map(t => `${t.kind}: ${t.label}`));
        onTrack(event.streams[0]);
      }
    };

    // Handle data channel
    peerConnection.ondatachannel = (event) => {
      console.log('Data channel received');
      onDataChannel(event.channel);
      
      event.channel.onopen = () => {
        console.log('Received data channel opened');
      };
      
      event.channel.onclose = () => {
        console.log('Received data channel closed');
      };
      
      event.channel.onerror = (error) => {
        console.error('Received data channel error:', error);
      };
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('ICE candidate generated for viewer');
        onIceCandidate(event.candidate);
      } else {
        console.log('ICE candidate gathering complete for viewer');
      }
    };

    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      console.log('Viewer ICE connection state:', peerConnection.iceConnectionState);
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('Viewer connection state:', peerConnection.connectionState);
      onConnectionStateChange(peerConnection.connectionState);
    };

    this.peerConnections.set(peerId, {
      id: peerId,
      connection: peerConnection,
    });

    return peerConnection;
  }

  // Create offer (host side)
  async createOffer(peerId: string): Promise<RTCSessionDescriptionInit> {
    const peer = this.peerConnections.get(peerId);
    if (!peer) throw new Error('Peer connection not found');

    console.log('Creating offer for peer:', peerId);
    const offer = await peer.connection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    
    console.log('Setting local description (offer)');
    await peer.connection.setLocalDescription(offer);
    
    return offer;
  }

  // Create answer (viewer side)
  async createAnswer(peerId: string): Promise<RTCSessionDescriptionInit> {
    const peer = this.peerConnections.get(peerId);
    if (!peer) throw new Error('Peer connection not found');

    console.log('Creating answer for peer:', peerId);
    const answer = await peer.connection.createAnswer();
    
    console.log('Setting local description (answer)');
    await peer.connection.setLocalDescription(answer);
    
    return answer;
  }

  // Set remote description
  async setRemoteDescription(
    peerId: string,
    description: RTCSessionDescriptionInit
  ) {
    const peer = this.peerConnections.get(peerId);
    if (!peer) throw new Error('Peer connection not found');

    console.log('Setting remote description for peer:', peerId, 'type:', description.type);
    await peer.connection.setRemoteDescription(
      new RTCSessionDescription(description)
    );
  }

  // Add ICE candidate
  async addIceCandidate(peerId: string, candidate: RTCIceCandidateInit) {
    const peer = this.peerConnections.get(peerId);
    if (!peer) {
      console.warn('Peer connection not found for ICE candidate:', peerId);
      return;
    }

    try {
      console.log('Adding ICE candidate for peer:', peerId);
      await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  // Send message through data channel
  sendMessage(peerId: string, message: string) {
    const peer = this.peerConnections.get(peerId);
    if (peer?.dataChannel && peer.dataChannel.readyState === 'open') {
      peer.dataChannel.send(message);
      return true;
    }
    console.warn('Data channel not ready for peer:', peerId);
    return false;
  }

  // Close specific peer connection
  closePeerConnection(peerId: string) {
    const peer = this.peerConnections.get(peerId);
    if (peer) {
      console.log('Closing peer connection:', peerId);
      peer.dataChannel?.close();
      peer.connection.close();
      this.peerConnections.delete(peerId);
    }
  }

  // Close all connections
  closeAllConnections() {
    console.log('Closing all peer connections');
    this.peerConnections.forEach((peer) => {
      peer.dataChannel?.close();
      peer.connection.close();
    });
    this.peerConnections.clear();
    this.stopScreenShare();
  }

  // Get data channel for a peer
  getDataChannel(peerId: string): RTCDataChannel | undefined {
    return this.peerConnections.get(peerId)?.dataChannel;
  }

  // Get local stream
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }
}