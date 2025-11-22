// WebRTC utility functions for screen sharing and peer connections

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
    ],
  };

  // Start screen and audio capture for host
  async startScreenShare(): Promise<MediaStream> {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

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
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }

  // Create peer connection for host (broadcaster)
  createHostConnection(
    peerId: string,
    onIceCandidate: (candidate: RTCIceCandidate) => void,
    onConnectionStateChange: (state: string) => void
  ): RTCPeerConnection {
    const peerConnection = new RTCPeerConnection(this.configuration);

    // Add local stream tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, this.localStream!);
      });
    }

    // Create data channel for chat
    const dataChannel = peerConnection.createDataChannel('chat');

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
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
    const peerConnection = new RTCPeerConnection(this.configuration);

    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
      onTrack(event.streams[0]);
    };

    // Handle data channel
    peerConnection.ondatachannel = (event) => {
      onDataChannel(event.channel);
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
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

    const offer = await peer.connection.createOffer();
    await peer.connection.setLocalDescription(offer);
    return offer;
  }

  // Create answer (viewer side)
  async createAnswer(peerId: string): Promise<RTCSessionDescriptionInit> {
    const peer = this.peerConnections.get(peerId);
    if (!peer) throw new Error('Peer connection not found');

    const answer = await peer.connection.createAnswer();
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

    await peer.connection.setRemoteDescription(
      new RTCSessionDescription(description)
    );
  }

  // Add ICE candidate
  async addIceCandidate(peerId: string, candidate: RTCIceCandidateInit) {
    const peer = this.peerConnections.get(peerId);
    if (!peer) throw new Error('Peer connection not found');

    await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  // Send message through data channel
  sendMessage(peerId: string, message: string) {
    const peer = this.peerConnections.get(peerId);
    if (peer?.dataChannel && peer.dataChannel.readyState === 'open') {
      peer.dataChannel.send(message);
    }
  }

  // Close specific peer connection
  closePeerConnection(peerId: string) {
    const peer = this.peerConnections.get(peerId);
    if (peer) {
      peer.dataChannel?.close();
      peer.connection.close();
      this.peerConnections.delete(peerId);
    }
  }

  // Close all connections
  closeAllConnections() {
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
}