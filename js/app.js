const app = {
  currentScreen: 'screen-welcome',
  screens: [
    'screen-welcome',
    'screen-purpose',
    'screen-origin',
    'screen-genre',
    'screen-lyrics',
    'screen-generation',
    'screen-selection',
    'screen-success'
  ],
  
  state: {
    purpose: null,
    purposeDetails: '',
    origin: null,
    genre: null,
    customGenre: '',
    voice: null,
    lyricsOption: null,
    audioFile: null,
    audioUrl: null,
    aiPrompt: '',
    customLyrics: '',
    songTitle: '',
    taskId: null,
    songs: [],
    selectedSong: null,
    freeCredits: 2,
    userId: null,
    couponCode: null,
    couponApplied: false,
    timerStarted: false,
    timerExpires: null,
    timerInterval: null,
    generatedCoupon: null
  },

  apiConfig: {
    baseUrl: 'https://api.kie.ai/api/v1',
    apiKey: null
  },

  init() {
    this.loadUserState();
    this.setupEventListeners();
    this.registerServiceWorker();
    this.loadApiKey();
    this.setupTimer();
    this.checkPaymentResult();
    this.fetchSocialCounter();
  },

  loadApiKey() {
    this.apiConfig.apiKey = localStorage.getItem('suno_api_key');
  },

  setApiKey(key) {
    this.apiConfig.apiKey = key;
    localStorage.setItem('suno_api_key', key);
    this.showToast('API Key configurada correctamente', 'success');
  },

  loadUserState() {
    const saved = localStorage.getItem('magxor_user');
    if (saved) {
      const user = JSON.parse(saved);
      this.state.freeCredits = user.freeCredits || 2;
      this.state.userId = user.id || this.generateUserId();
    } else {
      this.state.userId = this.generateUserId();
      this.saveUserState();
    }
    
    const savedTimer = localStorage.getItem('magxor_timer');
    if (savedTimer) {
      const timerData = JSON.parse(savedTimer);
      if (timerData.expires > Date.now()) {
        this.state.timerStarted = true;
        this.state.timerExpires = timerData.expires;
      } else {
        localStorage.removeItem('magxor_timer');
      }
    }
  },

  saveUserState() {
    localStorage.setItem('magxor_user', JSON.stringify({
      id: this.state.userId,
      freeCredits: this.state.freeCredits
    }));
  },

  generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },

  setupEventListeners() {
    document.getElementById('ai-prompt')?.addEventListener('input', (e) => {
      this.state.aiPrompt = e.target.value;
      document.getElementById('char-count').textContent = e.target.value.length;
      this.validateLyricsForm();
    });

    document.getElementById('custom-lyrics')?.addEventListener('input', (e) => {
      this.state.customLyrics = e.target.value;
      document.getElementById('custom-char-count').textContent = e.target.value.length;
      this.validateLyricsForm();
    });

    document.getElementById('song-title')?.addEventListener('input', (e) => {
      this.state.songTitle = e.target.value;
      this.validateLyricsForm();
    });

    document.getElementById('purpose-description')?.addEventListener('input', (e) => {
      this.state.purposeDetails = e.target.value;
    });

    const audioPlayer = document.getElementById('audio-player');
    const waveformProgress = document.getElementById('waveform-progress');
    
    if (audioPlayer) {
      audioPlayer.addEventListener('timeupdate', () => {
        const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        waveformProgress.style.width = percent + '%';
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAudioModal();
      }
    });

    window.addEventListener('beforeunload', (e) => {
      if (this.state.timerStarted && this.state.currentScreen !== 'screen-welcome') {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  },

  setupTimer() {
    if (this.state.timerStarted) {
      this.startTimer();
    }
  },

  startTimer() {
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval);
    }

    if (!this.state.timerExpires) {
      this.state.timerExpires = Date.now() + (20 * 60 * 1000);
    }

    localStorage.setItem('magxor_timer', JSON.stringify({
      expires: this.state.timerExpires
    }));

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
    
    let timerEl = document.getElementById('timer-display');
    if (timerEl) {
      timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
  },

  handleTimerExpired() {
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval);
      this.state.timerInterval = null;
    }
    
    this.showExitModal();
  },

  showExitModal() {
    const modal = document.getElementById('exit-modal');
    if (modal) {
      modal.classList.add('active');
    }
  },

  hideExitModal() {
    const modal = document.getElementById('exit-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  },

  continueSession() {
    this.state.timerExpires = Date.now() + (20 * 60 * 1000);
    localStorage.setItem('magxor_timer', JSON.stringify({
      expires: this.state.timerExpires
    }));
    this.hideExitModal();
    this.startTimer();
    this.showToast('¡Sesión restaurada! Tienes 20 minutos más.', 'success');
  },

  resetTimer() {
    this.state.timerStarted = false;
    this.state.timerExpires = null;
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval);
      this.state.timerInterval = null;
    }
    localStorage.removeItem('magxor_timer');
  },

  checkPaymentResult() {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const songId = params.get('song');
    const couponParam = params.get('coupon');
    
    if (paymentStatus === 'success' && songId) {
      if (couponParam && couponParam !== 'null') {
        this.state.generatedCoupon = couponParam;
        this.claimCoupon(couponParam);
      }
      
      setTimeout(() => {
        window.history.replaceState({}, '', window.location.pathname);
      }, 100);
    }
  },

  async fetchSocialCounter() {
    try {
      const response = await fetch('/api/social/counter');
      const data = await response.json();
      const counterEl = document.getElementById('social-counter');
      if (counterEl && data.count) {
        counterEl.textContent = data.count.toLocaleString();
      }
    } catch (error) {
      console.log('Social counter error:', error);
    }
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(err => {
        console.log('Service Worker registration failed:', err);
      });
    }
  },

  showScreen(screenId) {
    this.screens.forEach(id => {
      document.getElementById(id)?.classList.remove('active');
    });
    document.getElementById(screenId)?.classList.add('active');
    this.currentScreen = screenId;
    window.scrollTo(0, 0);

    if (screenId === 'screen-generation' && !this.state.timerStarted) {
      this.state.timerStarted = true;
      this.startTimer();
    }
  },

  nextScreen() {
    const currentIndex = this.screens.indexOf(this.currentScreen);
    if (currentIndex < this.screens.length - 1) {
      this.showScreen(this.screens[currentIndex + 1]);
      
      if (this.screens[currentIndex + 1] === 'screen-generation' && !this.state.timerStarted) {
        this.state.timerStarted = true;
        this.startTimer();
      }
    }
  },

  prevScreen() {
    const currentIndex = this.screens.indexOf(this.currentScreen);
    if (currentIndex > 0) {
      this.showScreen(this.screens[currentIndex - 1]);
    }
  },

  selectPurpose(element) {
    document.querySelectorAll('.purpose-card').forEach(card => {
      card.classList.remove('selected');
    });
    element.classList.add('selected');
    this.state.purpose = element.dataset.purpose;
    
    const details = document.getElementById('purpose-details');
    details.classList.remove('hidden');
    
    document.getElementById('btn-purpose').disabled = false;
  },

  selectOrigin(origin) {
    this.state.origin = origin;
    const uploadSection = document.getElementById('upload-audio-section');
    
    if (origin === 'upload') {
      uploadSection.classList.remove('hidden');
    } else {
      uploadSection.classList.add('hidden');
    }
    
    this.nextScreen();
  },

  selectGenre(element) {
    document.querySelectorAll('.genre-card').forEach(card => {
      card.classList.remove('selected');
    });
    element.classList.add('selected');
    this.state.genre = element.dataset.genre;
    
    document.getElementById('voice-selection')?.classList.remove('hidden');
    this.validateGenreForm();
  },

  addCustomGenre() {
    const input = document.getElementById('custom-genre-input');
    const genre = input.value.trim();
    
    if (genre) {
      this.state.customGenre = genre;
      this.state.genre = genre;
      
      const grid = document.getElementById('genre-grid');
      const newCard = document.createElement('button');
      newCard.className = 'genre-card selected';
      newCard.dataset.genre = genre.toLowerCase();
      newCard.onclick = () => this.selectGenre(newCard);
      newCard.innerHTML = `
        <span class="genre-icon">🎵</span>
        <span class="genre-name">${genre}</span>
      `;
      grid.appendChild(newCard);
      
      document.querySelectorAll('.genre-card').forEach(card => {
        card.classList.remove('selected');
      });
      newCard.classList.add('selected');
      
      input.value = '';
      document.getElementById('voice-selection')?.classList.remove('hidden');
      this.validateGenreForm();
      
      this.showToast(`Género "${genre}" agregado`, 'success');
    }
  },

  selectVoice(element) {
    document.querySelectorAll('.voice-card').forEach(card => {
      card.classList.remove('selected');
    });
    element.classList.add('selected');
    this.state.voice = element.dataset.voice;
    this.validateGenreForm();
  },

  validateGenreForm() {
    const btn = document.getElementById('btn-genre');
    if (this.state.genre && this.state.voice) {
      btn.disabled = false;
    } else {
      btn.disabled = true;
    }
  },

  async handleAudioUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    if (file.size > 50 * 1024 * 1024) {
      this.showToast('El archivo debe ser menor a 50MB', 'error');
      return;
    }
    
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/mp3'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|aac)$/i)) {
      this.showToast('Formato de audio no válido', 'error');
      return;
    }
    
    document.getElementById('upload-progress').classList.remove('hidden');
    document.getElementById('upload-content').classList.add('hidden');
    
    try {
      const formData = new FormData();
      formData.append('audio', file);
      
      const uploadUrl = await this.uploadAudioFile(file);
      this.state.audioUrl = uploadUrl;
      this.state.audioFile = file;
      
      document.getElementById('upload-progress').classList.add('hidden');
      document.getElementById('upload-success').classList.remove('hidden');
      document.getElementById('upload-file-name').textContent = file.name;
      
      this.showToast('Archivo subido correctamente', 'success');
      
      setTimeout(() => {
        this.nextScreen();
      }, 1000);
      
    } catch (error) {
      console.error('Upload error:', error);
      document.getElementById('upload-progress').classList.add('hidden');
      document.getElementById('upload-content').classList.remove('hidden');
      this.showToast('Error al subir el archivo', 'error');
    }
  },

  async uploadAudioFile(file) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve('https://temp-url.com/' + file.name);
      }, 2000);
    });
  },

  selectLyricsOption(option) {
    this.state.lyricsOption = option;
    
    document.querySelectorAll('.lyrics-card').forEach(card => {
      card.style.display = 'none';
    });
    
    const aiSection = document.getElementById('ai-lyrics-section');
    const writeSection = document.getElementById('write-lyrics-section');
    const titleSection = document.getElementById('song-title-section');
    const btn = document.getElementById('btn-generate');
    
    if (option === 'ai') {
      aiSection.classList.remove('hidden');
      writeSection.classList.add('hidden');
      titleSection.classList.remove('hidden');
      document.getElementById('lyrics-subtitle').textContent = 'Describe tu canción y la IA creará las letras';
    } else {
      aiSection.classList.add('hidden');
      writeSection.classList.remove('hidden');
      titleSection.classList.remove('hidden');
      document.getElementById('lyrics-subtitle').textContent = 'Escribe las letras de tu canción';
    }
    
    btn.classList.remove('hidden');
    this.validateLyricsForm();
  },

  validateLyricsForm() {
    const btn = document.getElementById('btn-generate');
    
    if (this.state.lyricsOption === 'ai') {
      const valid = this.state.aiPrompt.length >= 10 && this.state.songTitle.length >= 1;
      btn.disabled = !valid;
    } else if (this.state.lyricsOption === 'write') {
      const valid = this.state.customLyrics.length >= 20 && this.state.songTitle.length >= 1;
      btn.disabled = !valid;
    } else {
      btn.disabled = true;
    }
  },

  async generateMusic() {
    const btn = document.getElementById('btn-generate');
    const btnText = btn.querySelector('.btn-text');
    const btnLoading = btn.querySelector('.btn-loading');
    
    btn.disabled = true;
    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');
    
    this.showScreen('screen-generation');
    
    try {
      let prompt = '';
      if (this.state.origin === 'upload') {
        prompt = `Cover estilo ${this.state.genre}. ${this.state.aiPrompt || this.state.customLyrics}`;
      } else if (this.state.lyricsOption === 'ai') {
        prompt = `${this.state.genre} ${this.state.aiPrompt}`;
      } else {
        prompt = `${this.state.genre} ${this.state.customLyrics}`;
      }
      
      const taskId = await this.submitGenerationTask(prompt);
      this.state.taskId = taskId;
      
      this.updateGenerationProgress('Generando letras...');
      
      await this.pollTaskStatus(taskId);
      
    } catch (error) {
      console.error('Generation error:', error);
      this.showToast('Error al generar la música: ' + error.message, 'error');
      this.prevScreen();
    } finally {
      btn.disabled = false;
      btnText.classList.remove('hidden');
      btnLoading.classList.add('hidden');
    }
  },

  async submitGenerationTask(prompt) {
    if (!this.apiConfig.apiKey) {
      return this.simulateGeneration();
    }
    
    const endpoint = this.state.origin === 'upload' 
      ? `${this.apiConfig.baseUrl}/generate/upload-cover`
      : `${this.apiConfig.baseUrl}/generate`;
    
    const body = {
      prompt: prompt,
      customMode: true,
      instrumental: this.state.voice === 'instrumental',
      model: 'V4_5',
      callBackUrl: window.location.origin + '/callback',
      style: this.state.genre,
      title: this.state.songTitle || 'Mi canción',
      vocalGender: this.state.voice === 'male' ? 'm' : 'f',
      negativeTags: 'low quality, distorted'
    };
    
    if (this.state.origin === 'upload') {
      body.uploadUrl = this.state.audioUrl;
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      throw new Error('API request failed');
    }
    
    const data = await response.json();
    return data.data.taskId;
  },

  simulateGeneration() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve('task_' + Date.now());
      }, 2000);
    });
  },

  async pollTaskStatus(taskId) {
    const stages = [
      { text: 'Generando letras...', delay: 3000 },
      { text: 'Creando melodía...', delay: 5000 },
      { text: 'Mezclando instrumentos...', delay: 7000 },
      { text: 'Finalizando...', delay: 9000 }
    ];
    
    for (const stage of stages) {
      await new Promise(resolve => setTimeout(resolve, stage.delay));
      this.updateGenerationProgress(stage.text);
    }
    
    await this.fetchGeneratedSongs(taskId);
  },

  updateGenerationProgress(text) {
    const progressText = document.getElementById('progress-text');
    if (progressText) {
      progressText.textContent = text;
    }
    
    const status = document.getElementById('generation-status');
    const substatus = document.getElementById('generation-substatus');
    
    if (text.includes('Finalizando')) {
      status.textContent = '¡Música creada!';
      substatus.textContent = 'Preparando tus canciones...';
    }
  },

  async fetchGeneratedSongs(taskId) {
    this.state.songs = this.generateMockSongs();
    
    const preview = document.getElementById('songs-preview');
    const list = document.getElementById('songs-list');
    
    preview.classList.remove('hidden');
    list.innerHTML = '';
    
    this.state.songs.forEach((song, index) => {
      const card = document.createElement('div');
      card.className = 'preview-card';
      card.innerHTML = `
        <img class="preview-cover" src="${song.imageUrl}" alt="${song.title}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231f1f1f%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%2371717a%22 font-size=%2230%22>🎵</text></svg>'">
        <div class="preview-info">
          <div class="preview-title">${song.title}</div>
          <div class="preview-duration">${this.formatDuration(song.duration)}</div>
        </div>
        <button class="preview-play" onclick="app.playPreview(${index})">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </button>
      `;
      list.appendChild(card);
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    this.showScreen('screen-selection');
    this.renderFinalSongs();
  },

  generateMockSongs() {
    const titles = [
      `${this.state.songTitle || 'Mi Canción'} - Versión A`,
      `${this.state.songTitle || 'Mi Canción'} - Versión B`
    ];
    
    return titles.map((title, i) => ({
      id: `song_${Date.now()}_${i}`,
      title: title,
      audioUrl: `https://example.com/song_${i}.mp3`,
      streamAudioUrl: `https://example.com/stream_${i}`,
      imageUrl: `https://picsum.photos/seed/${Date.now() + i}/200`,
      tags: this.state.genre,
      duration: 180 + Math.floor(Math.random() * 60),
      model: 'chirp-v4-5',
      version: i === 0 ? 'A' : 'B',
      paid: false,
      userId: this.state.userId
    }));
  },

  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  playPreview(index) {
    const song = this.state.songs[index];
    this.openAudioModal(song);
  },

  renderFinalSongs() {
    const container = document.getElementById('final-songs');
    container.innerHTML = '';
    
    this.state.songs.forEach((song, index) => {
      const card = document.createElement('div');
      card.className = 'song-card';
      card.dataset.songId = song.id;
      card.onclick = (e) => {
        if (!e.target.closest('.btn-play') && !e.target.closest('.btn-select')) {
          this.selectSong(card, song);
        }
      };
      
      card.innerHTML = `
        <div class="song-card-header">
          <img class="song-cover" src="${song.imageUrl}" alt="${song.title}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231f1f1f%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%2371717a%22 font-size=%2230%22>🎵</text></svg>'">
          <div class="song-info">
            <div class="song-title">${song.title}</div>
            <div class="song-artist">MAGXOR Music</div>
            <div class="song-tags">
              <span class="song-tag">${song.tags}</span>
              <span class="song-tag version-tag">Versión ${song.version}</span>
            </div>
          </div>
        </div>
        <div class="song-duration">Duración: ${this.formatDuration(song.duration)}</div>
        <div class="song-actions">
          <button class="btn-play" onclick="app.playPreview(${index})">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Escuchar
          </button>
          <button class="btn-select" onclick="app.selectSong(this.closest('.song-card'), app.state.songs[${index}])">
            Seleccionar
          </button>
        </div>
      `;
      
      container.appendChild(card);
    });
    
    const freeNotice = document.getElementById('free-notice');
    const freeCount = document.getElementById('free-count');
    
    if (this.state.freeCredits > 0) {
      freeNotice.classList.remove('hidden');
      freeCount.textContent = `Te quedan ${this.state.freeCredits} descarga${this.state.freeCredits > 1 ? 's' : ''} gratuita${this.state.freeCredits > 1 ? 's' : ''}`;
    } else {
      freeNotice.classList.add('hidden');
    }
    
    this.updatePaymentSection();
    this.renderCouponSection();
  },

  renderCouponSection() {
    let couponSection = document.getElementById('coupon-section');
    
    if (!couponSection) {
      couponSection = document.createElement('div');
      couponSection.id = 'coupon-section';
      couponSection.className = 'coupon-section';
      couponSection.innerHTML = `
        <div class="coupon-header">
          <h3>¿Tienes un cupón de descuento?</h3>
          <p>Ingresa tu código para obtener 50% OFF</p>
        </div>
        <div class="coupon-input-group">
          <input type="text" id="coupon-input" placeholder="MAGXORMUSIC-0001" maxlength="20">
          <button class="btn-coupon-apply" onclick="app.applyCoupon()">Aplicar</button>
        </div>
        <div id="coupon-result" class="coupon-result hidden"></div>
        <div id="coupon-applied" class="coupon-applied hidden">
          <span class="coupon-badge">50% OFF</span>
          <span>¡Cupón aplicado!</span>
        </div>
      `;
      
      const paymentSection = document.getElementById('payment-section');
      if (paymentSection) {
        paymentSection.parentNode.insertBefore(couponSection, paymentSection);
      }
    }
    
    couponSection.classList.remove('hidden');
  },

  async applyCoupon() {
    const input = document.getElementById('coupon-input');
    const result = document.getElementById('coupon-result');
    const applied = document.getElementById('coupon-applied');
    const code = input.value.trim().toUpperCase();
    
    if (!code) {
      result.classList.remove('hidden');
      result.className = 'coupon-result error';
      result.textContent = 'Ingresa un código de cupón';
      return;
    }
    
    result.classList.add('hidden');
    applied.classList.add('hidden');
    
    try {
      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponCode: code })
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.state.couponCode = code;
        this.state.couponApplied = true;
        
        result.classList.remove('hidden');
        result.className = 'coupon-result success';
        result.textContent = `¡Descuento del 50% aplicado! Precio: $15.000 ARS`;
        
        applied.classList.remove('hidden');
        input.disabled = true;
        document.querySelector('.btn-coupon-apply').disabled = true;
        
        this.updatePriceDisplay(15000);
      } else {
        result.classList.remove('hidden');
        result.className = 'coupon-result error';
        result.textContent = data.error || 'Cupón inválido';
      }
    } catch (error) {
      console.error('Coupon apply error:', error);
      result.classList.remove('hidden');
      result.className = 'coupon-result error';
      result.textContent = 'Error al validar cupón';
    }
  },

  updatePriceDisplay(price) {
    const priceValue = document.querySelector('.price-value');
    if (priceValue) {
      if (price === 15000) {
        priceValue.innerHTML = `<span class="price-original">$30.000</span> $15.000 <span class="price-currency">ARS</span>`;
      } else {
        priceValue.innerHTML = `$30.000 <span class="price-currency">ARS</span>`;
      }
    }
  },

  selectSong(card, song) {
    document.querySelectorAll('.song-card').forEach(c => {
      c.classList.remove('selected');
      c.querySelector('.btn-select').textContent = 'Seleccionar';
    });
    
    card.classList.add('selected');
    card.querySelector('.btn-select').textContent = '✓ Seleccionada';
    
    this.state.selectedSong = song;
    this.updatePaymentSection();
  },

  updatePaymentSection() {
    const paymentSection = document.getElementById('payment-section');
    const freeSection = document.getElementById('free-download-section');
    
    if (this.state.selectedSong) {
      if (this.state.freeCredits > 0) {
        paymentSection.classList.add('hidden');
        freeSection.classList.remove('hidden');
      } else {
        paymentSection.classList.remove('hidden');
        freeSection.classList.add('hidden');
        this.updatePriceDisplay(this.state.couponApplied ? 15000 : 30000);
      }
    } else {
      paymentSection.classList.add('hidden');
      freeSection.classList.add('hidden');
    }
  },

  openAudioModal(song) {
    const modal = document.getElementById('audio-modal');
    const title = document.getElementById('modal-song-title');
    const duration = document.getElementById('modal-song-duration');
    const player = document.getElementById('audio-player');
    
    title.textContent = song.title;
    duration.textContent = this.formatDuration(song.duration);
    player.src = song.streamAudioUrl || song.audioUrl;
    
    document.getElementById('btn-select-modal').onclick = () => {
      this.selectSongFromModal(song);
    };
    
    modal.classList.add('active');
    player.play().catch(() => {});
  },

  closeAudioModal() {
    const modal = document.getElementById('audio-modal');
    const player = document.getElementById('audio-player');
    
    player.pause();
    player.src = '';
    
    modal.classList.remove('active');
  },

  selectSongFromModal(song) {
    if (!song) {
      song = this.state.songs.find(s => s.title === document.getElementById('modal-song-title').textContent);
    }
    
    if (song) {
      this.selectSong(document.querySelector(`[data-song-id="${song.id}"]`), song);
    }
    
    this.closeAudioModal();
  },

  async initPayment() {
    const btn = document.getElementById('btn-checkout');
    const btnText = btn.querySelector('.btn-text');
    const btnLoading = btn.querySelector('.btn-loading');
    
    btn.disabled = true;
    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');
    
    try {
      const paymentData = {
        songId: this.state.selectedSong.id,
        songTitle: this.state.selectedSong.title,
        useCoupon: this.state.couponApplied,
        userId: this.state.userId
      };
      
      const response = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });
      
      const data = await response.json();
      
      if (data.initPoint) {
        if (this.state.couponApplied) {
          const couponNum = this.state.couponCode.replace('MAGXORMUSIC-', '');
          data.initPoint = data.initPoint.replace('coupon=', `coupon=MAGXORMUSIC-${couponNum}`);
        }
        window.location.href = data.initPoint;
      } else {
        this.simulatePaymentSuccess();
      }
      
    } catch (error) {
      console.error('Payment error:', error);
      this.showToast('Error al procesar el pago', 'error');
      btn.disabled = false;
      btnText.classList.remove('hidden');
      btnLoading.classList.add('hidden');
    }
  },

  simulatePaymentSuccess() {
    this.completeDownload();
  },

  freeDownload() {
    this.completeDownload();
  },

  async completeDownload() {
    const track = document.getElementById('downloaded-track');
    track.innerHTML = `
      <div class="song-title">${this.state.selectedSong.title}</div>
      <div class="song-info">
        <p>Duración: ${this.formatDuration(this.state.selectedSong.duration)}</p>
        <p>Formato: MP3 (320 kbps)</p>
      </div>
    `;
    
    await this.generateCoupon();
    
    this.state.freeCredits--;
    this.saveUserState();
    this.resetTimer();
    
    this.showScreen('screen-success');
  },

  async generateCoupon() {
    try {
      const response = await fetch('/api/coupons/generate', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        this.state.generatedCoupon = data.couponCode;
        this.showCouponModal(data.couponCode);
      }
    } catch (error) {
      console.error('Generate coupon error:', error);
    }
  },

  async claimCoupon(couponCode) {
    try {
      await fetch(`/api/coupons/claim/${couponCode}`, { method: 'POST' });
    } catch (error) {
      console.error('Claim coupon error:', error);
    }
  },

  showCouponModal(couponCode) {
    let modal = document.getElementById('coupon-modal');
    
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'coupon-modal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content coupon-modal-content">
          <button class="modal-close" onclick="app.closeCouponModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
          <div class="coupon-modal-icon">🎁</div>
          <h2 class="coupon-modal-title">¡Felicidades!</h2>
          <p class="coupon-modal-text">Tu canción está lista para descargar</p>
          <div class="coupon-gift-section">
            <h3>GIFT: Versión B gratis</h3>
            <p>También te regalamos la Versión B de tu canción</p>
          </div>
          <div class="coupon-code-box">
            <p>Tu próximo cupón de 50% OFF:</p>
            <div class="coupon-code-display">
              <span id="modal-coupon-code">${couponCode}</span>
              <button class="btn-copy" onclick="app.copyCouponCode()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="share-coupon-section">
            <p>¡Comparte con tus amigos!</p>
            <button class="btn-share-whatsapp" onclick="app.shareOnWhatsApp('${couponCode}')">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Compartir
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    } else {
      document.getElementById('modal-coupon-code').textContent = couponCode;
    }
    
    modal.classList.add('active');
    this.state.generatedCoupon = couponCode;
  },

  closeCouponModal() {
    const modal = document.getElementById('coupon-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  },

  copyCouponCode() {
    const code = this.state.generatedCoupon || document.getElementById('modal-coupon-code')?.textContent;
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        this.showToast('¡Cupón copiado!', 'success');
      }).catch(() => {
        const input = document.createElement('input');
        input.value = code;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        this.showToast('¡Cupón copiado!', 'success');
      });
    }
  },

  shareOnWhatsApp(couponCode) {
    const text = encodeURIComponent(`🎵 ¡Mira lo que encontré! MAGXOR Music crea canciones personalizadas con IA.\n\n🔥 Usa mi código de descuento y obtén 50% OFF:\n${couponCode}\n\n👉 https://magxormusic.com`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  },

  shareFacebook(event) {
    event.preventDefault();
    const text = encodeURIComponent('¡Mira la canción que creé con MAGXOR Music! 🎵');
    const url = encodeURIComponent('https://magxormusic.com');
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`, '_blank', 'width=600,height=400');
  },

  cancelGeneration() {
    if (confirm('¿Estás seguro de que quieres cancelar la generación?')) {
      this.state.taskId = null;
      this.state.songs = [];
      this.resetTimer();
      this.goToHome();
    }
  },

  goToHome() {
    this.resetState();
    this.showScreen('screen-welcome');
  },

  resetState() {
    this.state = {
      ...this.state,
      purpose: null,
      purposeDetails: '',
      origin: null,
      genre: null,
      customGenre: '',
      voice: null,
      lyricsOption: null,
      audioFile: null,
      audioUrl: null,
      aiPrompt: '',
      customLyrics: '',
      songTitle: '',
      taskId: null,
      songs: [],
      selectedSong: null,
      couponCode: null,
      couponApplied: false
    };
    
    document.querySelectorAll('.purpose-card, .genre-card, .voice-card').forEach(el => {
      el.classList.remove('selected');
    });
    
    document.getElementById('purpose-details')?.classList.add('hidden');
    document.getElementById('voice-selection')?.classList.add('hidden');
    document.getElementById('upload-audio-section')?.classList.add('hidden');
    document.getElementById('lyrics-options')?.classList.remove('hidden');
    document.getElementById('lyrics-options').querySelectorAll('.lyrics-card').forEach(card => {
      card.style.display = '';
    });
    document.getElementById('ai-lyrics-section')?.classList.add('hidden');
    document.getElementById('write-lyrics-section')?.classList.add('hidden');
    document.getElementById('song-title-section')?.classList.add('hidden');
    document.getElementById('upload-content')?.classList.remove('hidden');
    document.getElementById('upload-success')?.classList.add('hidden');
    document.getElementById('songs-preview')?.classList.add('hidden');
    document.getElementById('payment-section')?.classList.add('hidden');
    document.getElementById('free-download-section')?.classList.add('hidden');
    document.getElementById('free-notice')?.classList.add('hidden');
    
    const couponSection = document.getElementById('coupon-section');
    if (couponSection) {
      couponSection.classList.add('hidden');
    }
    const couponInput = document.getElementById('coupon-input');
    if (couponInput) {
      couponInput.value = '';
      couponInput.disabled = false;
    }
    const couponResult = document.getElementById('coupon-result');
    if (couponResult) {
      couponResult.classList.add('hidden');
    }
    const couponApplied = document.getElementById('coupon-applied');
    if (couponApplied) {
      couponApplied.classList.add('hidden');
    }
    const couponApplyBtn = document.querySelector('.btn-coupon-apply');
    if (couponApplyBtn) {
      couponApplyBtn.disabled = false;
    }
    
    document.getElementById('ai-prompt').value = '';
    document.getElementById('custom-lyrics').value = '';
    document.getElementById('song-title').value = '';
    document.getElementById('purpose-description').value = '';
    document.getElementById('custom-genre-input').value = '';
    document.getElementById('audio-file').value = '';
    
    document.getElementById('btn-purpose').disabled = true;
    document.getElementById('btn-genre').disabled = true;
    document.getElementById('btn-generate').disabled = true;
    
    document.getElementById('char-count').textContent = '0';
    document.getElementById('custom-char-count').textContent = '0';
    
    document.getElementById('generation-status').textContent = 'Creando tu música...';
    document.getElementById('generation-substatus').textContent = 'Esto puede tardar unos minutos';
    document.getElementById('progress-text').textContent = 'Generando letras...';
  },

  showLogin() {
    const apiKey = prompt('Ingresa tu API Key de Suno (opcional):');
    if (apiKey && apiKey.trim()) {
      this.setApiKey(apiKey.trim());
    }
  },

  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    
    toast.className = 'toast ' + type;
    toastMessage.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});

window.addEventListener('load', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(() => {
      console.log('MAGXOR Music PWA Ready');
    });
  }
});
