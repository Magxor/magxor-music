// MAGXOR Music PWA - App with Suno Backend Integration

const app = {
  screens: [
    'screen-welcome',
    'screen-purpose',
    'screen-origin',
    'screen-genre',
    'screen-lyrics',
    'screen-generation',
    'screen-selection',
    'screen-payment',
    'screen-success'
  ],

  state: {
    purpose: null,
    origin: null,
    genre: null,
    voice: null,
    lyricsOption: 'ai',
    songTitle: '',
    aiPrompt: '',
    customLyrics: '',
    generatedLyrics: '',
    lyricsShown: false,
    songs: [],
    selectedSong: null,
    selectedSongIndex: null,
    couponCode: null,
    couponApplied: false,
    generatedCoupon: null,
    timerStarted: false,
    timerExpires: null,
    timerInterval: null,
    userId: null,
    audioPlaying: false,
    taskId: null,
    generationStatus: 'idle',
    pollingInterval: null
  },

  init() {
    this.loadUserState();
    this.loadTheme();
    this.setupEventListeners();
    this.registerServiceWorker();
    this.fetchSocialCounter();
    this.setupTimer();
    this.connectSocket();
    this.checkPendingGeneration();
  },

  // ==================== SOCKET CONNECTION ====================
  connectSocket() {
    if (typeof io === 'undefined') {
      console.warn('Socket.IO not loaded');
      return;
    }

    magxorSocket.connect();

    magxorSocket.on('generation:complete', (data) => {
      console.log('🎵 Generation complete received:', data);
      this.handleGenerationComplete(data);
    });

    magxorSocket.on('generation:first', (data) => {
      console.log('🎵 First track ready:', data);
      this.handleFirstTrackReady(data);
    });

    magxorSocket.on('generation:error', (data) => {
      console.error('❌ Generation error:', data);
      this.handleGenerationError(data);
    });
  },

  checkPendingGeneration() {
    const savedTaskId = localStorage.getItem('magxor_taskId');
    if (savedTaskId && this.state.generationStatus === 'idle') {
      this.state.taskId = savedTaskId;
      this.showScreen('screen-generation');
      this.startPolling(savedTaskId);
    }
  },

  // ==================== GENERATION ====================
  async startGeneration() {
    const statusText = document.getElementById('gen-status');
    
    // Step 1: Enviando solicitud
    this.updateGenStep(1);
    if (statusText) statusText.textContent = 'Conectando con IA musical...';

    try {
      const lyrics = this.state.lyricsOption === 'ai' 
        ? this.state.generatedLyrics 
        : this.state.customLyrics;

      const payload = {
        customMode: true,
        instrumental: this.state.voice === 'instrumental',
        model: 'V4_5',
        style: this.state.genre || 'Pop',
        title: this.state.songTitle || 'Mi Canción',
        prompt: lyrics,
        vocalGender: this.state.voice === 'male' ? 'm' : this.state.voice === 'female' ? 'f' : 'm',
        styleWeight: 0.65,
        weirdnessConstraint: 0.65,
        audioWeight: 0.65
      };

      console.log('📤 Sending generation request:', payload);

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to start generation');
      }

      const result = await response.json();
      
      if (result.code !== 200 || !result.data?.taskId) {
        throw new Error(result.msg || 'Generation failed to start');
      }

      // Guardar taskId
      this.state.taskId = result.data.taskId;
      this.state.generationStatus = 'generating';
      localStorage.setItem('magxor_taskId', this.state.taskId);

      console.log('✅ Generation started. Task ID:', this.state.taskId);

      // Step 2: Generando melodía
      this.updateGenStep(2);
      if (statusText) statusText.textContent = 'Creando melodía...';

      // Iniciar polling de respaldo
      this.startPolling(this.state.taskId);

    } catch (error) {
      console.error('❌ Generation error:', error);
      this.showToast('Error al iniciar generación: ' + error.message);
      this.showScreen('screen-lyrics');
    }
  },

  updateGenStep(step) {
    const steps = ['step-1', 'step-2', 'step-3', 'step-4'];
    const texts = ['Conectando...', 'Creando melodía...', 'Grabando voces...', 'Mezclando instrumentos...'];
    
    steps.forEach((id, index) => {
      const el = document.getElementById(id);
      if (!el) return;
      
      el.classList.remove('active', 'done');
      
      if (index < step) {
        el.classList.add('done');
      } else if (index === step) {
        el.classList.add('active');
      }
    });
  },

  startPolling(taskId) {
    if (this.state.pollingInterval) {
      clearInterval(this.state.pollingInterval);
    }

    const statusText = document.getElementById('gen-status');
    
    this.state.pollingInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/task/${taskId}`);
        
        if (!response.ok) {
          console.warn('Polling failed:', response.status);
          return;
        }

        const result = await response.json();
        console.log('📊 Polling result:', result);

        if (result.code === 200 && result.data) {
          const status = result.data.status;
          
          switch (status) {
            case 'SUCCESS':
            case 'FIRST_SUCCESS':
            case 'complete':
              this.updateGenStep(3);
              if (statusText) statusText.textContent = '¡Música lista!';
              this.handleGenerationComplete({
                taskId: taskId,
                songs: result.data.response?.sunoData || [],
                callbackType: 'complete'
              });
              this.stopPolling();
              break;
              
            case 'PENDING':
              this.updateGenStep(2);
              if (statusText) statusText.textContent = 'Generando melodía...';
              break;
              
            case 'TEXT_SUCCESS':
              this.updateGenStep(2);
              if (statusText) statusText.textContent = 'Letras listas, creando música...';
              break;
              
            case 'CREATE_TASK_FAILED':
            case 'GENERATE_AUDIO_FAILED':
            case 'SENSITIVE_WORD_ERROR':
              this.handleGenerationError({
                taskId: taskId,
                code: result.code,
                msg: result.data.errorMessage || 'Generation failed'
              });
              this.stopPolling();
              break;
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000); // Poll cada 5 segundos
  },

  stopPolling() {
    if (this.state.pollingInterval) {
      clearInterval(this.state.pollingInterval);
      this.state.pollingInterval = null;
    }
  },

  handleGenerationComplete(data) {
    console.log('🎉 Generation complete:', data);
    
    this.stopPolling();
    this.state.generationStatus = 'complete';

    // Parsear canciones
    const songs = [];
    const sunoData = data.songs || data.data?.data || [];

    sunoData.forEach((track, index) => {
      songs.push({
        id: track.id || `track_${index}`,
        title: track.title || this.state.songTitle || 'Canción sin título',
        audioUrl: track.audio_url || track.audioUrl || '',
        streamAudioUrl: track.stream_audio_url || track.streamAudioUrl || '',
        cover: track.image_url || track.imageUrl || '',
        duration: track.duration || 0,
        modelName: track.model_name || '',
        tags: track.tags || '',
        prompt: track.prompt || '',
        createTime: track.createTime || new Date().toISOString(),
        version: index === 0 ? 'A' : 'B'
      });
    });

    if (songs.length === 0) {
      console.error('No songs in response');
      this.showToast('No se generaron canciones');
      return;
    }

    this.state.songs = songs;
    this.renderSongs();
    this.showScreen('screen-selection');
    this.showToast(`¡${songs.length} canción(es) lista(s)!`);

    // Limpiar taskId guardado
    localStorage.removeItem('magxor_taskId');
  },

  handleFirstTrackReady(data) {
    console.log('🎵 First track ready:', data);
    
    this.updateGenStep(3);
    const statusText = document.getElementById('gen-status');
    if (statusText) statusText.textContent = '¡Primera canción lista!';
  },

  handleGenerationError(data) {
    console.error('❌ Generation error:', data);
    
    this.stopPolling();
    this.state.generationStatus = 'error';
    this.showToast('Error: ' + (data.msg || 'Generación fallida'));
    
    localStorage.removeItem('magxor_taskId');
    
    setTimeout(() => {
      if (confirm('La generación falló. ¿Querés intentar de nuevo?')) {
        this.startGeneration();
      } else {
        this.showScreen('screen-lyrics');
      }
    }, 1000);
  },

  // ==================== UI HELPERS ====================
  renderSongs() {
    const container = document.getElementById('songs-list');
    if (!container) return;
    
    container.innerHTML = '';

    if (this.state.songs.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:#999;padding:40px;">Cargando canciones...</p>';
      return;
    }

    this.state.songs.forEach((song, index) => {
      const card = document.createElement('div');
      card.className = 'song-card';
      card.dataset.index = index;
      card.onclick = (e) => {
        if (!e.target.closest('.song-actions button')) {
          this.openAudioModal(index);
        }
      };

      const coverUrl = song.cover || `https://picsum.photos/seed/${song.id}/400/400`;

      card.innerHTML = `
        <div class="song-cover-wrap">
          <img src="${coverUrl}" alt="${song.title}" class="song-cover" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 400%22><rect fill=%22%23FFE4EC%22 width=%22400%22 height=%22400%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23FF6B9D%22 font-size=%2260%22>🎵</text></svg>'">
          <span class="song-badge">Versión ${song.version}</span>
          <button class="song-play" onclick="event.stopPropagation(); app.openAudioModal(${index})">▶</button>
        </div>
        <div class="song-info">
          <h3>${song.title}</h3>
          <p>Duración: ${this.formatDuration(song.duration)}</p>
          <div class="song-actions">
            <button class="btn-listen" onclick="event.stopPropagation(); app.openAudioModal(${index})">🎧 Escuchar</button>
            <button class="btn-select" onclick="event.stopPropagation(); app.selectSong(${index})">✓ Seleccionar</button>
          </div>
        </div>
      `;

      container.appendChild(card);
    });
  },

  formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  cancelGeneration() {
    if (confirm('¿Cancelar la generación?')) {
      this.stopPolling();
      localStorage.removeItem('magxor_taskId');
      this.resetState();
      this.showScreen('screen-welcome');
    }
  },

  // ==================== AUDIO MODAL ====================
  openAudioModal(index) {
    const song = this.state.songs[index];
    if (!song) return;
    
    this.state.selectedSongIndex = index;

    const coverUrl = song.cover || `https://picsum.photos/seed/${song.id}/400/400`;

    document.getElementById('modal-cover').src = coverUrl;
    document.getElementById('modal-title').textContent = song.title;
    document.getElementById('audio-player').src = song.audioUrl || song.streamAudioUrl || '';
    document.getElementById('audio-progress-bar').style.width = '0%';

    const modal = document.getElementById('audio-modal');
    modal.classList.add('active');

    const audio = document.getElementById('audio-player');
    audio.play().catch(() => {
      this.showToast('Error al reproducir audio');
    });
    this.state.audioPlaying = true;
    this.updatePlayButton();
  },

  closeAudioModal() {
    const audio = document.getElementById('audio-player');
    audio.pause();
    audio.currentTime = 0;
    this.state.audioPlaying = false;
    document.getElementById('audio-modal').classList.remove('active');
  },

  togglePlay() {
    const audio = document.getElementById('audio-player');
    if (this.state.audioPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
    this.state.audioPlaying = !this.state.audioPlaying;
    this.updatePlayButton();
  },

  updatePlayButton() {
    document.getElementById('audio-play-btn').textContent = this.state.audioPlaying ? '⏸' : '▶';
  },

  updateAudioProgress() {
    const audio = document.getElementById('audio-player');
    if (audio.duration) {
      const percent = (audio.currentTime / audio.duration) * 100;
      document.getElementById('audio-progress-bar').style.width = percent + '%';
      document.getElementById('current-time').textContent = this.formatDuration(Math.floor(audio.currentTime));
    }
  },

  updateAudioDuration() {
    const audio = document.getElementById('audio-player');
    document.getElementById('total-time').textContent = this.formatDuration(Math.floor(audio.duration));
  },

  audioEnded() {
    this.state.audioPlaying = false;
    this.updatePlayButton();
    document.getElementById('audio-progress-bar').style.width = '0%';
  },

  selectThisSong() {
    if (this.state.selectedSongIndex !== null) {
      this.selectSong(this.state.selectedSongIndex);
    }
  },

  // ==================== SELECTION ====================
  selectSong(index) {
    document.querySelectorAll('.song-card').forEach((card, i) => {
      card.classList.remove('selected');
      const btn = card.querySelector('.btn-select');
      if (btn) btn.textContent = '✓ Seleccionar';
    });

    const cards = document.querySelectorAll('.song-card');
    if (cards[index]) {
      cards[index].classList.add('selected');
      const btn = cards[index].querySelector('.btn-select');
      if (btn) btn.textContent = '✓ Seleccionada';
    }

    this.state.selectedSong = this.state.songs[index];
    this.goToPayment();
  },

  goToPayment() {
    if (!this.state.selectedSong) return;

    const coverUrl = this.state.selectedSong.cover || `https://picsum.photos/seed/${this.state.selectedSong.id}/400/400`;
    
    document.getElementById('payment-cover').src = coverUrl;
    document.getElementById('payment-title').textContent = this.state.selectedSong.title;
    document.getElementById('payment-duration').textContent = 'Duración: ' + this.formatDuration(this.state.selectedSong.duration);

    this.updatePriceDisplay();
    this.nextScreen();
  },

  // ==================== OTHER METHODS ====================
  loadUserState() {
    const saved = localStorage.getItem('magxor_user');
    if (saved) {
      const user = JSON.parse(saved);
      this.state.userId = user.id;
    } else {
      this.state.userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('magxor_user', JSON.stringify({ id: this.state.userId }));
    }
  },

  loadTheme() {
    const saved = localStorage.getItem('magxor_theme');
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.querySelector('.theme-icon').textContent = '☀️';
    } else {
      document.querySelector('.theme-icon').textContent = '🌙';
    }
  },

  toggleTheme() {
    const html = document.documentElement;
    const icon = document.querySelector('.theme-icon');
    
    if (html.getAttribute('data-theme') === 'dark') {
      html.removeAttribute('data-theme');
      localStorage.setItem('magxor_theme', 'light');
      icon.textContent = '🌙';
    } else {
      html.setAttribute('data-theme', 'dark');
      localStorage.setItem('magxor_theme', 'dark');
      icon.textContent = '☀️';
    }
  },

  setupEventListeners() {
    const aiPrompt = document.getElementById('ai-prompt');
    if (aiPrompt) {
      aiPrompt.addEventListener('input', (e) => {
        this.state.aiPrompt = e.target.value;
        const charCount = document.getElementById('char-count');
        if (charCount) charCount.textContent = e.target.value.length;
        this.validateLyricsForm();
      });
    }

    const customLyrics = document.getElementById('custom-lyrics');
    if (customLyrics) {
      customLyrics.addEventListener('input', (e) => {
        this.state.customLyrics = e.target.value;
        const charCount = document.getElementById('custom-char-count');
        if (charCount) charCount.textContent = e.target.value.length;
        this.validateLyricsForm();
      });
    }

    const customGenre = document.getElementById('custom-genre');
    if (customGenre) {
      customGenre.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.addCustomGenre();
      });
    }

    const audioPlayer = document.getElementById('audio-player');
    if (audioPlayer) {
      audioPlayer.addEventListener('timeupdate', () => this.updateAudioProgress());
      audioPlayer.addEventListener('loadedmetadata', () => this.updateAudioDuration());
      audioPlayer.addEventListener('ended', () => this.audioEnded());
    }

    window.addEventListener('beforeunload', (e) => {
      if (this.state.timerStarted && this.currentScreen() !== 'screen-welcome') {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  },

  currentScreen() {
    for (const screen of this.screens) {
      const el = document.getElementById(screen);
      if (el && el.classList.contains('active')) return screen;
    }
    return null;
  },

  showScreen(screenId) {
    this.screens.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');

    if (screenId === 'screen-generation' && !this.state.timerStarted && !this.state.taskId) {
      this.state.timerStarted = true;
      this.startTimer();
      this.startGeneration();
    }
  },

  nextScreen() {
    const currentIndex = this.screens.indexOf(this.currentScreen());
    if (currentIndex < this.screens.length - 1) {
      this.showScreen(this.screens[currentIndex + 1]);
    }
  },

  prevScreen() {
    const currentIndex = this.screens.indexOf(this.currentScreen());
    if (currentIndex > 0) {
      this.showScreen(this.screens[currentIndex - 1]);
    }
  },

  // ==================== PURPOSE ====================
  selectPurpose(element) {
    document.querySelectorAll('#screen-purpose .purpose-card').forEach(card => {
      card.classList.remove('selected');
    });
    element.classList.add('selected');
    this.state.purpose = element.dataset.purpose;
    
    const btn = document.getElementById('btn-purpose');
    if (btn) {
      btn.disabled = false;
    }
  },

  // ==================== ORIGIN ====================
  selectOrigin(element) {
    this.state.origin = element.dataset.origin;
    
    document.querySelectorAll('#screen-origin .origin-card').forEach(card => {
      card.classList.remove('selected');
    });
    element.classList.add('selected');

    const uploadSection = document.getElementById('upload-section');
    if (this.state.origin === 'cover') {
      uploadSection.classList.remove('hidden');
    } else {
      uploadSection.classList.add('hidden');
      this.nextScreen();
    }
  },

  handleAudioUpload(input) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      this.showToast('El archivo debe ser menor a 10MB');
      return;
    }

    this.showToast('Archivo listo ✓');
    setTimeout(() => this.nextScreen(), 500);
  },

  // ==================== GENRE ====================
  selectGenre(element) {
    document.querySelectorAll('.genre-chip').forEach(chip => chip.classList.remove('selected'));
    element.classList.add('selected');
    this.state.genre = element.dataset.genre;
    
    const voiceSection = document.getElementById('voice-section');
    if (voiceSection) {
      voiceSection.classList.remove('hidden');
    }
    
    this.validateGenreForm();
  },

  addCustomGenre() {
    const input = document.getElementById('custom-genre');
    const genre = input.value.trim();
    
    if (genre) {
      this.state.genre = genre;
      
      document.querySelectorAll('.genre-chip').forEach(c => c.classList.remove('selected'));
      
      const chip = document.createElement('button');
      chip.className = 'genre-chip selected';
      chip.dataset.genre = genre;
      chip.innerHTML = '<span class="genre-emoji">🎵</span><span>' + genre + '</span>';
      chip.onclick = () => this.selectGenre(chip);
      
      const track = document.querySelector('.genre-track');
      if (track) track.appendChild(chip);
      input.value = '';
      
      const voiceSection = document.getElementById('voice-section');
      if (voiceSection) voiceSection.classList.remove('hidden');
      this.validateGenreForm();
    }
  },

  selectVoice(element) {
    document.querySelectorAll('.voice-btn').forEach(btn => btn.classList.remove('selected'));
    element.classList.add('selected');
    this.state.voice = element.dataset.voice;
    this.validateGenreForm();
  },

  validateGenreForm() {
    const btn = document.getElementById('btn-genre');
    const isValid = !!(this.state.genre && this.state.voice);
    if (btn) {
      btn.disabled = !isValid;
    }
  },

  // ==================== LYRICS ====================
  selectLyricsOption(element) {
    document.querySelectorAll('.lyrics-option').forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');
    this.state.lyricsOption = element.dataset.option;

    const aiSection = document.getElementById('ai-section');
    const writeSection = document.getElementById('write-section');

    if (this.state.lyricsOption === 'ai') {
      if (aiSection) aiSection.classList.remove('hidden');
      if (writeSection) writeSection.classList.add('hidden');
    } else {
      if (aiSection) aiSection.classList.add('hidden');
      if (writeSection) writeSection.classList.remove('hidden');
    }

    this.validateLyricsForm();
  },

  updateTitle(value) {
    this.state.songTitle = value;
    this.validateLyricsForm();
  },

  updateAiPrompt(value) {
    this.state.aiPrompt = value;
    this.validateLyricsForm();
  },

  updateCustomLyrics(value) {
    this.state.customLyrics = value;
    this.validateLyricsForm();
  },

  validateLyricsForm() {
    const btn = document.getElementById('btn-generate');
    const titleValid = this.state.songTitle.trim().length > 0;
    
    let contentValid = false;
    if (this.state.lyricsOption === 'ai' && this.state.aiPrompt.length >= 10) {
      contentValid = true;
    } else if (this.state.lyricsOption === 'write' && this.state.customLyrics.length >= 20) {
      contentValid = true;
    }
    
    if (btn) {
      btn.disabled = !(titleValid && contentValid);
    }
  },

  async generateLyricsWithAI() {
    if (!this.state.aiPrompt || this.state.aiPrompt.length < 10) {
      this.showToast('Escribí una descripción más detallada');
      return;
    }

    const btn = event.target;
    btn.innerHTML = '<span class="spinner"></span> Generando...';
    btn.disabled = true;

    try {
      const response = await fetch('/api/ai/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: this.state.aiPrompt })
      });

      const data = await response.json();
      
      if (data.text) {
        this.state.generatedLyrics = data.text;
        this.showLyricsPreview(data.text);
        btn.innerHTML = '<span>✨</span><span>Letras generadas ✓</span>';
        this.showToast('Letras generadas correctamente');
      } else {
        throw new Error('No se generó texto');
      }
    } catch (error) {
      console.error('AI lyrics error:', error);
      // Fallback: generar letras mock
      const mockLyrics = `[Intro]
${this.state.songTitle || 'Nuestra canción'}...

[Verso 1]
Cada momento junto a ti,
es una melodía que nace aquí.
Tus palabras son mi inspiración,
tu voz es mi mejor canción.

[Coro]
Esta es nuestra canción,
la melodía del corazón.
Juntos escribimos este momento,
nuestra propia historia, nuestro cuento.

[Verso 2]
Las notas fluyen como un río,
tu presencia es mi mejor frío.
Construimos sueños paso a paso,
esta canción es nuestro abrazo.

[Coro]
Esta es nuestra canción,
la melodía del corazón...`;

      this.state.generatedLyrics = mockLyrics;
      this.showLyricsPreview(mockLyrics);
      btn.innerHTML = '<span>✨</span><span>Letras generadas ✓</span>';
      this.showToast('Letras generadas (usando IA de respaldo)');
    }

    btn.disabled = false;
  },

  showLyricsPreview(lyrics) {
    const preview = document.getElementById('lyrics-preview');
    const content = document.getElementById('lyrics-preview-content');
    
    if (content) content.textContent = lyrics;
    if (preview) {
      preview.classList.remove('hidden');
      preview.style.opacity = '0';
      preview.style.transform = 'translateY(20px)';
      setTimeout(() => {
        preview.style.transition = 'all 0.3s ease';
        preview.style.opacity = '1';
        preview.style.transform = 'translateY(0)';
      }, 50);
    }
    
    this.state.lyricsShown = true;
  },

  editLyrics() {
    const preview = document.getElementById('lyrics-preview');
    if (preview) preview.classList.add('hidden');
    this.state.lyricsShown = false;
    
    this.state.lyricsOption = 'write';
    document.querySelectorAll('.lyrics-option').forEach(opt => {
      opt.classList.remove('selected');
      if (opt.dataset.option === 'write') opt.classList.add('selected');
    });
    
    const aiSection = document.getElementById('ai-section');
    const writeSection = document.getElementById('write-section');
    if (aiSection) aiSection.classList.add('hidden');
    if (writeSection) writeSection.classList.remove('hidden');
    
    const customLyricsInput = document.getElementById('custom-lyrics');
    if (customLyricsInput) {
      customLyricsInput.value = this.state.generatedLyrics;
      this.state.customLyrics = this.state.generatedLyrics;
      const charCount = document.getElementById('custom-char-count');
      if (charCount) charCount.textContent = this.state.generatedLyrics.length;
    }
    this.validateLyricsForm();
  },

  // ==================== PAYMENT ====================
  applyCoupon() {
    const input = document.getElementById('coupon-input');
    const result = document.getElementById('coupon-result');
    const applied = document.getElementById('coupon-applied');
    const code = input.value.trim().toUpperCase();

    if (!code) {
      if (result) {
        result.classList.remove('hidden');
        result.className = 'coupon-result error';
        result.textContent = 'Ingresá un código';
      }
      return;
    }

    if (!code.startsWith('MAGXORMUSIC-')) {
      if (result) {
        result.classList.remove('hidden');
        result.className = 'coupon-result error';
        result.textContent = 'Código inválido';
      }
      return;
    }

    if (result) {
      result.classList.remove('hidden');
      result.className = 'coupon-result success';
      result.textContent = '¡50% de descuento aplicado!';
    }

    this.state.couponApplied = true;
    this.state.couponCode = code;
    if (applied) {
      applied.classList.remove('hidden');
    }
    if (input) input.disabled = true;

    this.updatePriceDisplay();
  },

  updatePriceDisplay() {
    const priceFinal = document.getElementById('price-final');
    const originalRow = document.getElementById('price-original-row');

    if (this.state.couponApplied) {
      if (originalRow) originalRow.style.display = 'flex';
      if (priceFinal) priceFinal.textContent = '$15.000';
    } else {
      if (originalRow) originalRow.style.display = 'none';
      if (priceFinal) priceFinal.textContent = '$30.000';
    }
  },

  async initPayment() {
    const btn = document.getElementById('btn-checkout');
    const btnText = btn.querySelector('.btn-text');
    const btnLoading = btn.querySelector('.btn-loading');

    btn.disabled = true;
    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');

    try {
      // Create payment preference
      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId: this.state.selectedSong?.id,
          trackTitle: this.state.selectedSong?.title,
          taskId: this.state.taskId,
          price: this.state.couponApplied ? 15000 : 30000
        })
      });

      const data = await response.json();
      
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        throw new Error('No se pudo crear el pago');
      }
    } catch (error) {
      console.error('Payment error:', error);
      this.showToast('Error al procesar pago');
      btnText.classList.remove('hidden');
      btnLoading.classList.add('hidden');
      btn.disabled = false;
    }
  },

  async generateCoupon() {
    try {
      const response = await fetch('/api/generate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.couponCode) {
        this.state.generatedCoupon = data.couponCode;
      } else {
        throw new Error();
      }
    } catch {
      const couponNum = Math.floor(Math.random() * 9000) + 1000;
      this.state.generatedCoupon = `MAGXORMUSIC-${couponNum}`;
    }
    
    const couponEl = document.getElementById('generated-coupon');
    if (couponEl) couponEl.textContent = this.state.generatedCoupon;
  },

  downloadSong() {
    if (this.state.selectedSong?.audioUrl) {
      const link = document.createElement('a');
      link.href = this.state.selectedSong.audioUrl;
      link.download = `${this.state.selectedSong.title}.mp3`;
      link.click();
      this.showToast('Descargando ' + this.state.selectedSong.title);
    } else {
      this.showToast('Link de descarga no disponible');
    }
  },

  downloadVersionB() {
    const versionB = this.state.songs.find(s => s.version === 'B');
    if (versionB?.audioUrl) {
      const link = document.createElement('a');
      link.href = versionB.audioUrl;
      link.download = `${versionB.title}.mp3`;
      link.click();
      this.showToast('Descargando ' + versionB.title);
    } else {
      this.showToast('Versión B no disponible');
    }
  },

  copyCoupon() {
    navigator.clipboard.writeText(this.state.generatedCoupon).then(() => {
      this.showToast('¡Cupón copiado!');
    });
  },

  shareWhatsApp() {
    const text = encodeURIComponent(
      `🎵 ¡Mira lo que encontré! MAGXOR Music crea canciones personalizadas con IA.\n\n` +
      `🔥 Usa mi código y obtén 50% OFF:\n` +
      `${this.state.generatedCoupon}\n\n` +
      `👉 https://magxormusic.vercel.app`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  },

  goHome() {
    this.resetState();
    this.showScreen('screen-welcome');
  },

  // ==================== RESET ====================
  resetState() {
    const steps = ['step-1', 'step-2', 'step-3', 'step-4'];
    steps.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active', 'done');
    });

    document.querySelectorAll('#screen-purpose .purpose-card, #screen-origin .origin-card, .genre-chip, .voice-btn, .lyrics-option').forEach(el => {
      el.classList.remove('selected');
    });

    const voiceSection = document.getElementById('voice-section');
    if (voiceSection) voiceSection.classList.add('hidden');
    
    const uploadSection = document.getElementById('upload-section');
    if (uploadSection) uploadSection.classList.add('hidden');
    
    const aiSection = document.getElementById('ai-section');
    if (aiSection) aiSection.classList.remove('hidden');
    
    const writeSection = document.getElementById('write-section');
    if (writeSection) writeSection.classList.add('hidden');
    
    const lyricsPreview = document.getElementById('lyrics-preview');
    if (lyricsPreview) lyricsPreview.classList.add('hidden');
    
    const couponApplied = document.getElementById('coupon-applied');
    if (couponApplied) couponApplied.classList.add('hidden');
    
    const couponInput = document.getElementById('coupon-input');
    if (couponInput) {
      couponInput.disabled = false;
      couponInput.value = '';
    }
    
    const couponResult = document.getElementById('coupon-result');
    if (couponResult) couponResult.classList.add('hidden');

    const aiPrompt = document.getElementById('ai-prompt');
    if (aiPrompt) aiPrompt.value = '';
    
    const customLyrics = document.getElementById('custom-lyrics');
    if (customLyrics) customLyrics.value = '';
    
    const songTitle = document.getElementById('song-title');
    if (songTitle) songTitle.value = '';
    
    const customGenre = document.getElementById('custom-genre');
    if (customGenre) customGenre.value = '';
    
    const charCount = document.getElementById('char-count');
    if (charCount) charCount.textContent = '0';
    
    const customCharCount = document.getElementById('custom-char-count');
    if (customCharCount) customCharCount.textContent = '0';

    const btnPurpose = document.getElementById('btn-purpose');
    if (btnPurpose) btnPurpose.disabled = true;
    
    const btnGenre = document.getElementById('btn-genre');
    if (btnGenre) btnGenre.disabled = true;
    
    const btnGenerate = document.getElementById('btn-generate');
    if (btnGenerate) btnGenerate.disabled = true;

    const aiOption = document.querySelector('.lyrics-option[data-option="ai"]');
    if (aiOption) aiOption.classList.add('selected');

    this.stopPolling();

    this.state = {
      ...this.state,
      purpose: null,
      origin: null,
      genre: null,
      voice: null,
      lyricsOption: 'ai',
      songTitle: '',
      aiPrompt: '',
      customLyrics: '',
      generatedLyrics: '',
      lyricsShown: false,
      songs: [],
      selectedSong: null,
      selectedSongIndex: null,
      couponCode: null,
      couponApplied: false,
      generatedCoupon: null,
      timerStarted: false,
      taskId: null,
      generationStatus: 'idle'
    };

    localStorage.removeItem('magxor_taskId');
    this.resetTimer();
  },

  // ==================== TIMER ====================
  setupTimer() {
    const savedTimer = localStorage.getItem('magxor_timer');
    if (savedTimer) {
      const timerData = JSON.parse(savedTimer);
      if (timerData.expires > Date.now()) {
        this.state.timerStarted = true;
        this.state.timerExpires = timerData.expires;
        const timerHeader = document.getElementById('timer-header');
        if (timerHeader) timerHeader.classList.add('visible');
        this.startTimer();
      } else {
        localStorage.removeItem('magxor_timer');
      }
    }
  },

  startTimer() {
    if (!this.state.timerExpires) {
      this.state.timerExpires = Date.now() + (20 * 60 * 1000);
    }

    localStorage.setItem('magxor_timer', JSON.stringify({
      expires: this.state.timerExpires
    }));

    const timerHeader = document.getElementById('timer-header');
    if (timerHeader) timerHeader.classList.add('visible');

    this.state.timerInterval = setInterval(() => {
      this.updateTimerDisplay();
    }, 1000);

    this.updateTimerDisplay();
  },

  updateTimerDisplay() {
    const now = Date.now();
    const remaining = this.state.timerExpires - now;

    if (remaining <= 0) {
      this.handleTimerExpired();
      return;
    }

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    const timerDisplay = document.getElementById('timer-display');
    if (timerDisplay) {
      timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
  },

  handleTimerExpired() {
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval);
      this.state.timerInterval = null;
    }
    const exitModal = document.getElementById('exit-modal');
    if (exitModal) exitModal.classList.add('active');
  },

  continueSession() {
    this.state.timerExpires = Date.now() + (20 * 60 * 1000);
    localStorage.setItem('magxor_timer', JSON.stringify({
      expires: this.state.timerExpires
    }));
    const exitModal = document.getElementById('exit-modal');
    if (exitModal) exitModal.classList.remove('active');
    this.startTimer();
    this.showToast('Sesión restaurada ✓');
  },

  leaveSession() {
    const exitModal = document.getElementById('exit-modal');
    if (exitModal) exitModal.classList.remove('active');
    this.resetState();
    this.showScreen('screen-welcome');
  },

  resetTimer() {
    this.state.timerStarted = false;
    this.state.timerExpires = null;
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval);
      this.state.timerInterval = null;
    }
    localStorage.removeItem('magxor_timer');
    const timerHeader = document.getElementById('timer-header');
    if (timerHeader) timerHeader.classList.remove('visible');
  },

  // ==================== SOCIAL ====================
  async fetchSocialCounter() {
    try {
      const response = await fetch('/api/social/counter');
      if (response.ok) {
        const data = await response.json();
        const counterNumber = document.getElementById('counter-number');
        if (counterNumber) counterNumber.textContent = data.count?.toLocaleString() || '12,847';
      }
    } catch {
      const baseCount = 12847;
      const randomAdd = Math.floor(Math.random() * 150) + 50;
      const counterNumber = document.getElementById('counter-number');
      if (counterNumber) counterNumber.textContent = (baseCount + randomAdd).toLocaleString();
    }
  },

  // ==================== SERVICE WORKER ====================
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(err => {
        console.log('SW registration failed:', err);
      });
    }
  },

  // ==================== TOAST ====================
  showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    
    if (toastMessage) toastMessage.textContent = message;
    if (toast) toast.classList.add('show');

    setTimeout(() => {
      if (toast) toast.classList.remove('show');
    }, 3000);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
