// MAGXOR Music - Socket.IO Connection

class MagxorSocket {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.listeners = {};
  }

  connect() {
    if (this.socket) return;

    // Connect to the same origin (backend server)
    const socketUrl = window.location.origin;
    
    try {
      this.socket = io(socketUrl, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      this.socket.on('connect', () => {
        console.log('🔌 Socket connected:', this.socket.id);
        this.connected = true;
      });

      this.socket.on('disconnect', () => {
        console.log('🔌 Socket disconnected');
        this.connected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });

      // Register event listeners
      this.setupListeners();
    } catch (error) {
      console.error('Socket initialization error:', error);
    }
  }

  setupListeners() {
    // Music generation complete
    this.socket.on('music:complete', (data) => {
      console.log('🎵 Music generation complete:', data);
      this.emit('generation:complete', this.parseCallbackData(data));
    });

    // Music generation error
    this.socket.on('music:error', (data) => {
      console.error('❌ Music generation error:', data);
      this.emit('generation:error', data);
    });

    // First track complete
    this.socket.on('music:first', (data) => {
      console.log('🎵 First track complete');
      this.emit('generation:first', this.parseCallbackData(data));
    });
  }

  parseCallbackData(data) {
    // Parse Suno callback format to our format
    const songs = [];
    const sunoData = data?.data?.data || [];

    sunoData.forEach((track, index) => {
      songs.push({
        id: track.id || `track_${index}`,
        title: track.title || 'Canción sin título',
        audioUrl: track.audio_url || track.audioUrl || '',
        streamAudioUrl: track.stream_audio_url || track.streamAudioUrl || '',
        coverUrl: track.image_url || track.imageUrl || '',
        duration: track.duration || 0,
        modelName: track.model_name || track.modelName || '',
        tags: track.tags || '',
        prompt: track.prompt || '',
        createTime: track.createTime || new Date().toISOString(),
        version: index === 0 ? 'A' : 'B'
      });
    });

    return {
      taskId: data?.data?.task_id || data?.taskId || '',
      songs: songs,
      callbackType: data?.data?.callbackType || data?.callbackType || 'complete'
    };
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  isConnected() {
    return this.connected && this.socket !== null;
  }
}

// Global socket instance
const magxorSocket = new MagxorSocket();
