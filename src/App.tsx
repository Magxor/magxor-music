import React from 'react';
import { MusicGenerationRequest, AppState, AppStep, SunoTrack, SessionData } from './types';
import { generateMusic, getTaskDetails } from './services/musicService';
import { createPayment } from './services/paymentService';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Music, 
  Compass, 
  Bell, 
  Settings, 
  Check, 
  Play, 
  Lock, 
  Shield, 
  ArrowRight, 
  ArrowLeft,
  Sparkles,
  Heart,
  Zap,
  Smile,
  Coffee,
  Guitar,
  Mic2,
  Volume2,
  Download,
  CreditCard,
  Wallet,
  Apple,
  Bitcoin,
  Layout,
  Piano,
  Sliders,
  Lightbulb,
  Share2,
  Globe,
  Pause,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Upload,
  FileAudio,
  Loader2,
  RefreshCw,
  X,
  ShoppingCart,
  AlertCircle
} from 'lucide-react';

// ─── Session persistence ────────────────────────────────────────────────────
const SESSION_KEY = 'magxor_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function saveSession(state: AppState) {
  const data: SessionData = {
    taskId: state.taskId,
    title: state.title,
    generatedTracks: state.generatedTracks,
    paidTrackIds: state.paidTrackIds,
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch (_) {}
}

function loadSession(): SessionData | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data: SessionData = JSON.parse(raw);
    if (Date.now() - data.savedAt > SESSION_TTL_MS) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return data;
  } catch (_) {
    return null;
  }
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
}

// ─── Socket singleton ────────────────────────────────────────────────────────
let socketInstance: Socket | null = null;
function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
  }
  return socketInstance;
}

// ─── Components ─────────────────────────────────────────────────────────────

const MusicPlayer = ({ audioUrl, title, imageUrl }: { audioUrl: string, title: string, imageUrl?: string }) => {
  const [audioReady, setAudioReady] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [volume, setVolume] = React.useState(0.8);
  const [isMuted, setIsMuted] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => setIsPlaying(true))
            .catch((err) => {
              if (err.name !== 'AbortError') console.error('Play error:', err);
              setIsPlaying(false);
            });
        }
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const total = audioRef.current.duration;
      if (total && !isNaN(total)) {
        setProgress((current / total) * 100);
        setCurrentTime(current);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = (parseFloat(e.target.value) / 100) * duration;
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
      setProgress(parseFloat(e.target.value));
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    setIsMuted(v === 0);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full glass-card p-6 rounded-2xl border border-outline-variant/20 shadow-xl">
      <audio
        ref={audioRef}
        src={audioUrl}
        onCanPlay={() => setAudioReady(true)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      {!audioReady ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center text-primary animate-pulse overflow-hidden">
              {imageUrl ? (
                <img src={imageUrl} alt={title} className="w-full h-full object-cover rounded-lg opacity-40" referrerPolicy="no-referrer" />
              ) : (
                <Music size={24} />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-4 w-40 bg-surface-container-highest rounded-full animate-pulse" />
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="text-primary animate-spin" />
                <span className="text-xs text-on-surface-variant">Preparando audio...</span>
              </div>
            </div>
          </div>
          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <motion.div
              className="h-full w-1/3 bg-primary/40 rounded-full"
              animate={{ x: ['0%', '300%'] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg bg-primary/20 flex items-center justify-center text-primary overflow-hidden">
                {imageUrl ? (
                  <img src={imageUrl} alt={title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Music size={24} />
                )}
              </div>
              <div>
                <h4 className="font-headline font-bold text-white">{title || 'Pista sin título'}</h4>
                <p className="text-xs text-on-surface-variant uppercase tracking-widest">Transmisión de audio neuronal</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => setIsMuted(!isMuted)} className="text-on-surface-variant hover:text-white transition-colors">
                {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input
                type="range" min="0" max="1" step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-surface-container-highest rounded-full appearance-none accent-primary"
              />
            </div>
          </div>

          <div className="space-y-2">
            <input
              type="range" min="0" max="100" step="0.1" value={progress}
              onChange={handleSeek}
              className="w-full h-1.5 bg-surface-container-highest rounded-full appearance-none accent-secondary cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={togglePlay}
              className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-container to-secondary flex items-center justify-center text-black shadow-lg hover:scale-105 active:scale-95 transition-transform"
            >
              {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const Navbar = () => (
  <nav className="fixed top-0 w-full z-50 bg-[#0e0e13]/60 backdrop-blur-2xl flex justify-between items-center px-8 h-16 shadow-[0px_0px_15px_rgba(139,92,246,0.1)]">
    <div className="text-2xl font-bold tracking-tighter text-gradient font-headline cursor-pointer">
      Magxor Music
    </div>
    <div className="flex items-center gap-4">
      <button className="text-gray-400 hover:text-white transition-colors"><Bell size={20} /></button>
    </div>
  </nav>
);

const Footer = () => (
  <footer className="w-full py-8 mt-auto bg-[#0e0e13] border-t border-outline-variant/15 px-12 flex flex-col md:flex-row justify-between items-center text-xs uppercase tracking-widest text-gray-600 font-body">
    <div>© 2024 Magxor Music Industries</div>
    <div className="flex gap-8 mt-4 md:mt-0">
      <a className="hover:text-secondary transition-opacity opacity-80 hover:opacity-100" href="#">Términos de Servicio</a>
      <a className="hover:text-secondary transition-opacity opacity-80 hover:opacity-100" href="#">Política de Privacidad</a>
      <a className="hover:text-secondary transition-opacity opacity-80 hover:opacity-100" href="#">Soporte</a>
    </div>
    <div className="flex gap-4 mt-4 md:mt-0">
      <Share2 size={16} className="cursor-pointer hover:text-white" />
      <Globe size={16} className="cursor-pointer hover:text-white" />
    </div>
  </footer>
);

// ─── Session Recovery Banner ─────────────────────────────────────────────────

const SessionBanner = ({ session, onRestore, onDismiss }: {
  session: SessionData;
  onRestore: () => void;
  onDismiss: () => void;
}) => (
  <motion.div
    initial={{ y: -80, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    exit={{ y: -80, opacity: 0 }}
    className="fixed top-16 left-0 right-0 z-40 flex justify-center px-4 pt-3"
  >
    <div className="glass-card border border-secondary/30 rounded-2xl px-6 py-4 flex items-center gap-4 max-w-2xl w-full shadow-xl">
      <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary flex-shrink-0">
        <RefreshCw size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white">Sesión anterior encontrada</p>
        <p className="text-xs text-on-surface-variant truncate">
          {session.generatedTracks.length > 0
            ? `${session.generatedTracks.length} canción(es) generada(s): "${session.title || 'Sin título'}"`
            : `Tarea en proceso: ${session.taskId}`}
        </p>
      </div>
      <div className="flex gap-3 flex-shrink-0">
        <button
          onClick={onRestore}
          className="px-4 py-2 rounded-xl bg-secondary text-black text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all"
        >
          Restaurar
        </button>
        <button
          onClick={onDismiss}
          className="text-on-surface-variant hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  </motion.div>
);

// ─── Payment Modal ────────────────────────────────────────────────────────────

const PaymentModal = ({
  track,
  taskId,
  onClose,
  onSuccess,
}: {
  track: SunoTrack;
  taskId: string;
  onClose: () => void;
  onSuccess: (trackId: string) => void;
}) => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handlePay = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await createPayment(track, taskId);
      // Redirect to MercadoPago checkout
      window.location.href = result.init_point;
    } catch (e: any) {
      setError(e?.message || 'Error al iniciar el pago. Intenta nuevamente.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-surface-container-high p-8 rounded-3xl border border-outline-variant/20 max-w-md w-full shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center text-secondary">
              <ShoppingCart size={20} />
            </div>
            <h3 className="text-xl font-headline font-bold">Descargar Canción</h3>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Track info */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-container mb-6 border border-outline-variant/10">
          {track.image_url ? (
            <img src={track.image_url} alt={track.title} className="w-14 h-14 rounded-lg object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
              <Music size={20} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-headline font-bold text-white truncate">{track.title || 'Canción Generada'}</p>
            <p className="text-xs text-on-surface-variant">Audio MP3 · Alta calidad</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-headline font-bold text-white">$5</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">USD</p>
          </div>
        </div>

        {/* Benefits */}
        <ul className="space-y-2 mb-6">
          {[
            'Descarga permanente en MP3',
            'Derechos de uso personal',
            'Sin marca de agua',
          ].map(b => (
            <li key={b} className="flex items-center gap-3 text-sm text-on-surface-variant">
              <Check size={16} className="text-secondary flex-shrink-0" />
              {b}
            </li>
          ))}
        </ul>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handlePay}
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary-container to-secondary text-black font-headline font-bold text-sm uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Redirigiendo a MercadoPago...
            </>
          ) : (
            <>
              <CreditCard size={18} />
              Pagar con MercadoPago
            </>
          )}
        </button>

        <p className="text-center text-[10px] text-outline mt-4 uppercase tracking-widest">
          Pago 100% seguro · SSL encriptado
        </p>
      </motion.div>
    </div>
  );
};

// ─── Steps ───────────────────────────────────────────────────────────────────

const Landing = ({ onStart }: { onStart: () => void }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="relative min-h-screen flex flex-col"
  >
    <section className="relative flex-grow flex items-center justify-center overflow-hidden px-6 pt-16">
      <div className="absolute inset-0 z-0">
        <img
          className="w-full h-full object-cover opacity-40"
          src="https://picsum.photos/seed/studio/1920/1080"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background"></div>
      </div>

      <div className="relative z-10 max-w-5xl text-center space-y-8">
        <div className="inline-block px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-body text-xs uppercase tracking-widest mb-4">
          Revolución Musical IA
        </div>
        <h1 className="text-6xl md:text-8xl font-headline font-bold tracking-tighter leading-tight">
          Tus sentimientos, <br/>
          <span className="text-gradient">convertidos en canciones</span>
        </h1>
        <p className="text-on-surface-variant text-lg md:text-xl max-w-2xl mx-auto font-body font-light">
          Transforma emociones en composiciones maestras. La primera plataforma de creación musical que entiende el alma de tu sonido mediante inteligencia artificial avanzada.
        </p>
        <div className="pt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <button onClick={onStart} className="btn-primary">
            Empezar a Crear
          </button>
          <button className="btn-secondary">
            Ver Demo
          </button>
        </div>
      </div>
    </section>
  </motion.div>
);

const StepIndicator = ({ currentStep }: { currentStep: number }) => {
  const steps = ['Concepto', 'Estilo', 'Letra', 'Mezcla'];
  return (
    <div className="w-full max-w-2xl mb-12">
      <div className="flex justify-between items-center mb-4">
        <span className="text-primary font-headline font-bold text-sm tracking-widest uppercase">Paso {currentStep} de 4</span>
        <span className="text-on-surface-variant font-body text-sm">{steps[currentStep - 1]}</span>
      </div>
      <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary-container to-secondary rounded-full shadow-[0_0_10px_rgba(143,96,250,0.5)] transition-all duration-500"
          style={{ width: `${(currentStep / 4) * 100}%` }}
        ></div>
      </div>
    </div>
  );
};

const PurposeStep = ({ onNext, onBack }: { onNext: (purpose: string) => void, onBack: () => void }) => {
  const purposes = [
    { id: 'event', title: 'Un Evento Especial', desc: 'Bodas, aniversarios, fiestas de graduación o momentos inolvidables.', icon: Sparkles, tags: ['Wedding', 'Party'] },
    { id: 'gift', title: 'Un Regalo Único', desc: 'Cumpleaños, declaraciones de amor o un detalle personalizado.', icon: Heart, tags: ['Birthday', 'Anniversary'] },
    { id: 'brand', title: 'Identidad de Marca', desc: 'Jingles publicitarios, cortinas de podcast, bandas sonoras.', icon: Zap, tags: ['Jingles', 'Ads'] },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center w-full max-w-7xl">
      <StepIndicator currentStep={1} />
      <div className="text-center mb-16">
        <h1 className="text-5xl md:text-6xl font-headline font-bold tracking-tighter text-on-surface mb-4 leading-none">
          ¿Cuál es el propósito <br/> de tu <span className="text-gradient">canción?</span>
        </h1>
        <p className="text-on-surface-variant text-lg max-w-lg mx-auto">
          Selecciona la intención detrás de tu creación para que nuestra IA ajuste el ritmo, la armonía y la narrativa.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
        {purposes.map((p) => (
          <button
            key={p.id}
            onClick={() => onNext(p.id)}
            className="group relative flex flex-col items-start p-8 rounded-2xl glass-card border border-outline-variant/15 text-left transition-all duration-300 hover:border-secondary/50 hover:bg-surface-bright active:scale-95"
          >
            <div className="mb-8 p-4 rounded-xl bg-primary-container/10 text-primary transition-transform duration-300 group-hover:scale-110">
              <p.icon size={32} />
            </div>
            <h3 className="font-headline text-2xl font-bold text-white mb-2">{p.title}</h3>
            <p className="text-on-surface-variant text-sm leading-relaxed mb-6">{p.desc}</p>
            <div className="mt-auto flex gap-2">
              {p.tags.map(t => (
                <span key={t} className="px-3 py-1 rounded-full bg-surface-container-highest text-[10px] uppercase font-bold tracking-widest text-secondary">{t}</span>
              ))}
            </div>
          </button>
        ))}
      </div>
      <div className="mt-16 flex items-center justify-between w-full max-w-4xl border-t border-outline-variant/15 pt-12">
        <button onClick={onBack} className="text-on-surface-variant hover:text-white flex items-center gap-2 transition-colors group uppercase font-bold text-sm tracking-widest">
          <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" /> Regresar
        </button>
      </div>
    </motion.div>
  );
};

const StyleStep = ({ onNext, onBack }: { onNext: (genre: string, tempo: number, mood: string, advanced: Partial<AppState>) => void, onBack: () => void }) => {
  const [genre, setGenre] = React.useState('Rock');
  const [tempo, setTempo] = React.useState(128);
  const [mood, setMood] = React.useState('Energetic & Powerful');
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [customMode, setCustomMode] = React.useState(true);
  const [instrumental, setInstrumental] = React.useState(false);
  const [negativeTags, setNegativeTags] = React.useState('Heavy Metal, Upbeat Drums');
  const [vocalGender, setVocalGender] = React.useState<'m' | 'f' | 'none'>('m');
  const [styleWeight, setStyleWeight] = React.useState(0.65);
  const [weirdnessConstraint, setWeirdnessConstraint] = React.useState(0.65);
  const [audioWeight, setAudioWeight] = React.useState(0.65);
  const [personaId, setPersonaId] = React.useState('persona_123');
  const [uploadUrl, setUploadUrl] = React.useState('');
  const [isUploading, setIsUploading] = React.useState(false);
  const [showAudioUpload, setShowAudioUpload] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      setTimeout(() => {
        setUploadUrl('https://storage.example.com/mock-audio-' + file.name);
        setIsUploading(false);
      }, 1500);
    }
  };

  const genres = [
    'Rock', 'Jazz', 'Cumbia', 'Cuarteto', 'Salsa', 'Electronica',
    'Chamamé', 'Folklore', 'Milonga', 'Chacarera', 'Tango',
    'Clasico', 'Reggaeton', 'Balada', 'Bolero', 'Pop'
  ];

  const moods = [
    { name: 'Feliz / Alegre', icon: Smile, color: 'text-tertiary' },
    { name: 'Energico / Potente', icon: Zap, color: 'text-primary' },
    { name: 'Emocional / Profundo', icon: Heart, color: 'text-secondary' },
    { name: 'Romantico / Sentimental', icon: Heart, color: 'text-pink-500' },
    { name: 'Relajado / Calmo', icon: Coffee, color: 'text-on-surface-variant' },
    { name: 'Bailable', icon: Music, color: 'text-secondary' },
  ];

  const handleContinue = () => {
    onNext(genre, tempo, mood, { customMode, instrumental, negativeTags, vocalGender, styleWeight, weirdnessConstraint, audioWeight, personaId, uploadUrl });
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-4xl mx-auto">
      <div className="flex justify-center mb-12"><StepIndicator currentStep={2} /></div>
      <header className="mb-10 text-center">
        <span className="text-primary-dim uppercase tracking-[0.2em] font-bold mb-2 block">Etapa 02</span>
        <h1 className="text-5xl font-headline font-bold tracking-tighter text-white mb-4">Define el estilo y el ritmo</h1>
        <p className="text-on-surface-variant text-lg max-w-xl mx-auto">Ajusta los parámetros fundamentales para que la IA comprenda la energía y el núcleo de tu próxima producción.</p>
      </header>

      <div className="space-y-12">
        <div className="flex justify-center">
          {!showAudioUpload && !uploadUrl ? (
            <button 
              onClick={() => setShowAudioUpload(true)}
              className="group flex items-center gap-3 px-8 py-5 rounded-2xl bg-surface-container border border-outline-variant/20 hover:border-secondary/50 hover:bg-surface-bright transition-all"
            >
              <div className="p-2 rounded-lg bg-secondary/10 text-secondary group-hover:scale-110 transition-transform">
                <FileAudio size={20} />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-white leading-tight">Subir Música para copiar estilo</p>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Opcional · La IA usará tu audio como referencia</p>
              </div>
              <ChevronDown size={18} className="text-outline-variant ml-4" />
            </button>
          ) : (
            <section className="w-full glass-card p-8 rounded-xl border border-outline-variant/15 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-secondary">Referencia de Estilo (Audio)</h3>
                  <p className="text-xs text-on-surface-variant mt-1">La IA analizará este audio para replicar su estilo sonoro.</p>
                </div>
                <button onClick={() => { setShowAudioUpload(false); setUploadUrl(''); }} className="p-2 hover:bg-surface-variant rounded-full text-on-surface-variant transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-outline-variant/30 rounded-2xl p-8 hover:border-secondary/50 transition-colors cursor-pointer bg-surface-container-low" onClick={() => fileInputRef.current?.click()}>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="audio/*" />
                {isUploading ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm font-body text-on-surface-variant">Analizando y subiendo referencia...</p>
                  </div>
                ) : uploadUrl ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center text-secondary shadow-[0_0_20px_rgba(0,219,233,0.2)]"><Check size={24} /></div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-white">¡Estilo capturado con éxito!</p>
                      <p className="text-xs text-on-surface-variant mt-1 truncate max-w-[300px] bg-black/20 px-3 py-1 rounded-full">{uploadUrl.split('-').pop()}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setUploadUrl(''); }} className="text-xs text-error/80 hover:text-error transition-colors font-bold uppercase tracking-widest">Eliminar y cambiar audio</button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant"><Upload size={24} /></div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-white">Haz clic para subir un audio</p>
                      <p className="text-xs text-on-surface-variant mt-1">Formatos soportados: MP3, WAV, M4A (Máx 10MB)</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <section className="space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant text-center">Selecciona el Género</h3>
          <div className="flex flex-wrap justify-center gap-3">
            {genres.map(g => (
              <button
                key={g}
                onClick={() => setGenre(g)}
                className={`px-6 py-3 rounded-full border font-headline font-bold transition-all ${genre === g ? 'bg-secondary text-black border-secondary shadow-[0_0_15px_rgba(0,219,233,0.4)]' : 'bg-surface-container-low border-outline-variant/20 text-white hover:border-secondary/50'}`}
              >
                {g}
              </button>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="glass-card p-8 rounded-xl border border-outline-variant/15">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Ritmo (Tempo)</h3>
              <span className="text-secondary font-headline font-bold">{tempo} BPM</span>
            </div>
            <input type="range" min="60" max="200" value={tempo} onChange={(e) => setTempo(parseInt(e.target.value))} className="w-full h-1.5 bg-surface-container-highest rounded-full appearance-none mb-8 accent-secondary" />
            <div className="flex justify-between text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">
              <span>Lento</span><span>Moderado</span><span>Rápido</span>
            </div>
          </div>

          <div className="glass-card p-8 rounded-xl border border-outline-variant/15">
            <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-6">Estado de Ánimo</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {moods.map(m => (
                <div
                  key={m.name}
                  onClick={() => setMood(m.name)}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer border-l-2 ${mood === m.name ? 'bg-surface-container-high border-primary' : 'bg-surface-variant hover:bg-surface-bright border-transparent'}`}
                >
                  <m.icon size={18} className={m.color} />
                  <span className={`text-xs font-semibold ${mood === m.name ? 'text-white' : ''}`}>{m.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <section className="glass-card p-8 rounded-xl border border-outline-variant/15">
          <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-6">Género Vocal</h3>
          <div className="flex gap-4">
            {(['m', 'f', 'none'] as const).map(v => (
              <button
                key={v}
                onClick={() => setVocalGender(v)}
                className={`flex-1 py-4 rounded-xl text-sm font-bold uppercase tracking-widest border transition-all ${vocalGender === v ? 'bg-primary text-black border-primary shadow-[0_0_15px_rgba(143,96,250,0.4)]' : 'bg-surface-container border-outline-variant/20 text-on-surface-variant hover:border-primary/50'}`}
              >
                {v === 'm' ? 'Masculino' : v === 'f' ? 'Femenino' : 'Instrumental'}
              </button>
            ))}
          </div>
        </section>

        <div className="space-y-6">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-secondary hover:text-white transition-colors mx-auto"
          >
            {showAdvanced ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            Configuración Avanzada
          </button>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="glass-card p-8 rounded-xl border border-outline-variant/15 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-bold text-on-surface">Modo Personalizado</label>
                          <p className="text-[10px] text-on-surface-variant">Permite un control más granular sobre la generación.</p>
                        </div>
                        <button onClick={() => setCustomMode(!customMode)} className={`w-12 h-6 rounded-full transition-colors relative ${customMode ? 'bg-primary' : 'bg-surface-variant'}`}>
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${customMode ? 'left-7' : 'left-1'}`}></div>
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-bold text-on-surface">Instrumental</label>
                          <p className="text-[10px] text-on-surface-variant">Genera la pista sin voces, enfocándose solo en la música.</p>
                        </div>
                        <button onClick={() => setInstrumental(!instrumental)} className={`w-12 h-6 rounded-full transition-colors relative ${instrumental ? 'bg-primary' : 'bg-surface-variant'}`}>
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${instrumental ? 'left-7' : 'left-1'}`}></div>
                        </button>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-on-surface">Etiquetas Negativas</label>
                        <p className="text-[10px] text-on-surface-variant">Estilos o elementos que NO quieres que aparezcan.</p>
                        <input
                          type="text" value={negativeTags}
                          onChange={(e) => setNegativeTags(e.target.value)}
                          className="w-full bg-surface-container border border-outline-variant/20 rounded-lg p-3 text-sm focus:outline-none focus:border-primary"
                          placeholder="Ej: Heavy Metal, Upbeat Drums"
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      {[
                        { label: 'Peso del Estilo', desc: 'Qué tanto debe influir el género seleccionado.', val: styleWeight, set: setStyleWeight },
                        { label: 'Restricción de Rareza', desc: 'Nivel de experimentación y sonidos inusuales.', val: weirdnessConstraint, set: setWeirdnessConstraint },
                        { label: 'Peso del Audio', desc: 'Prioridad de la calidad sonora sobre otros parámetros.', val: audioWeight, set: setAudioWeight },
                      ].map(({ label, desc, val, set }) => (
                        <div key={label} className="space-y-2">
                          <div className="flex justify-between">
                            <div>
                              <label className="text-sm font-bold text-on-surface">{label}</label>
                              <p className="text-[10px] text-on-surface-variant">{desc}</p>
                            </div>
                            <span className="text-xs text-primary font-bold">{val}</span>
                          </div>
                          <input
                            type="range" min="0" max="1" step="0.05" value={val}
                            onChange={(e) => set(parseFloat(e.target.value))}
                            className="w-full h-1 bg-surface-container-highest rounded-full appearance-none accent-primary"
                          />
                        </div>
                      ))}

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-on-surface">ID de Persona</label>
                        <p className="text-[10px] text-on-surface-variant">Perfil de producción específico para el modelo.</p>
                        <select
                          value={personaId} onChange={(e) => setPersonaId(e.target.value)}
                          className="w-full bg-surface-container border border-outline-variant/20 rounded-lg p-3 text-sm focus:outline-none focus:border-primary"
                        >
                          <option value="persona_123">Productor por Defecto</option>
                          <option value="persona_456">Maestro Electrónico</option>
                          <option value="persona_789">Alma Acústica</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex gap-4 max-w-2xl mx-auto">
          <button onClick={onBack} className="flex-1 py-4 rounded-xl border border-outline-variant/20 font-bold hover:bg-surface-variant transition-colors">Atrás</button>
          <button onClick={handleContinue} className="flex-[2] py-4 rounded-xl bg-primary text-black font-extrabold tracking-tight hover:brightness-110 transition-all flex items-center justify-center gap-2">
            Continuar <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

import { GoogleGenAI } from "@google/genai";

const LyricsStep = ({ onNext, onBack }: { onNext: (title: string, lyrics: string) => void | Promise<void>, onBack: () => void }) => {
  const [title, setTitle] = React.useState('');
  const [topic, setTopic] = React.useState('');
  const [lyrics, setLyrics] = React.useState('');
  const [isImproving, setIsImproving] = React.useState(false);
  const [isOptimizing, setIsOptimizing] = React.useState(false);
  const [isAIOptimized, setIsAIOptimized] = React.useState(false);
  const [showAIModal, setShowAIModal] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);

  const handleLyricsChange = (val: string) => {
    setLyrics(val);
    setAiError(null);
    setIsAIOptimized(false); 
  };

  const callGemini = async (prompt: string) => {
    const models = ["gemini-2.0-flash", "gemini-1.5-flash"];
    setAiError(null);
    
    for (let i = 0; i < models.length; i++) {
      const modelName = models[i];
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({ 
          model: modelName, 
          contents: prompt 
        });
        const text = response.text?.trim();
        if (text) return text;
      } catch (error: any) {
        console.warn(`Intento fallido con ${modelName}:`, error.message);
        const isQuotaError = error.message?.includes("RESOURCE_EXHAUSTED") || error.status === 429;
        
        // Si no es un error de cuota, o es el último modelo de la lista, lanzamos error
        if (!isQuotaError || i === models.length - 1) {
          if (isQuotaError) throw new Error("QUOTA_EXCEEDED");
          throw error;
        }
        // Si es error de cuota y hay más modelos, seguimos al siguiente (fallback)
        console.log(`Cambiando a modelo de respaldo: ${models[i+1]}`);
      }
    }
    return "";
  };

  const handleGenerateFromTopic = async () => {
    if (!topic) return;
    setIsImproving(true);
    setAiError(null);
    try {
      const prompt = `Actúa como un compositor experto y creativo. 
      Escribe una letra de canción completa Basada en la siguiente idea/tema: "${topic}".
      
      REGLAS DE FORMATO (CRÍTICO):
      1. Usa etiquetas de estructura entre corchetes: [Verse 1], [Chorus], [Verse 2], [Bridge], [Outro].
      2. No uses paréntesis (), solo corchetes para estructura.
      3. El lenguaje debe ser poético, rítmico y adecuado al tema.
      4. No incluyas notas explicativas, solo la letra de la canción.
      5. La letra debe ser lo suficientemente larga para una canción completa (al menos 3 versos y estribillos).`;

      const result = await callGemini(prompt);
      if (result) {
        setLyrics(result);
        setIsAIOptimized(true);
        if (!title) {
          try {
            const titlePrompt = `Basado en esta letra, genera un título corto y pegajoso (máximo 4 palabras): \n\n${result}`;
            const generatedTitle = await callGemini(titlePrompt);
            setTitle(generatedTitle.replace(/["']/g, ''));
          } catch(e) {} // Don't block if title gen fails
        }
      }
    } catch (error: any) {
      if (error.message === "QUOTA_EXCEEDED") {
        setAiError("La IA está muy ocupada recibiendo peticiones. Por favor, espera unos segundos o escribe tu letra manualmente.");
      } else {
        setAiError("Hubo un problema al conectar con la IA. Revisa tu conexión.");
      }
    } finally {
      setIsImproving(false);
    }
  };

  const handleImproveLyrics = async (mode: 'clean' | 'full') => {
    if (!lyrics) return;
    setIsImproving(true);
    setShowAIModal(false);
    setAiError(null);
    try {
      let prompt = "";
      if (mode === 'clean') {
        prompt = `Mejora la siguiente letra de canción. Solo modifica el texto para que sea más poético y rítmico. NO agregues etiquetas de estructura. Letra: ${lyrics}`;
      } else {
        prompt = `Mejora y estructura la siguiente letra para Suno AI. Usa etiquetas [Verse], [Chorus], [Bridge], [Outro]. Letra: ${lyrics}`;
      }
      const result = await callGemini(prompt);
      if (result) {
        setLyrics(result);
        setIsAIOptimized(mode === 'full');
      }
    } catch (error: any) {
      if (error.message === "QUOTA_EXCEEDED") {
        setAiError("Límite de la IA alcanzado. Intenta mejorarla nuevamente en unos segundos.");
      } else {
        setAiError("Ocurrió un error al intentar mejorar la letra.");
      }
    } finally {
      setIsImproving(false);
    }
  };

  const handleNextWithOptimization = async () => {
    if (!lyrics) return;

    if (!isAIOptimized) {
      setIsOptimizing(true);
      setAiError(null);
      try {
        const prompt = `Optimiza la estructura de esta letra para Suno AI. Agrega etiquetas [Verse], [Chorus], etc. Letra: ${lyrics}`;
        const result = await callGemini(prompt);
        if (result) {
          setLyrics(result);
          setIsAIOptimized(true);
          await onNext(title || 'Obra Maestra', result);
        }
      } catch (error: any) {
        console.warn("Optimization failed due to quota, proceeding with raw lyrics.");
        // If quota is exhausted during mandatory optimization, we LET THE USER PASS anyway
        // to avoid blocking the whole app.
        await onNext(title || 'Obra Maestra', lyrics);
      } finally {
        setIsOptimizing(false);
      }
    } else {
      await onNext(title || 'Obra Maestra', lyrics);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-4xl mx-auto">
      <AnimatePresence>
        {showAIModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-surface-container-high p-8 rounded-3xl border border-outline-variant/20 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <Sparkles className="text-secondary" size={28} />
                <h3 className="text-2xl font-headline font-bold">Mejorar con IA</h3>
              </div>
              <p className="text-on-surface-variant mb-8 font-body">¿Cómo prefieres que la inteligencia artificial trabaje en tu letra?</p>
              <div className="flex flex-col gap-4">
                <button onClick={() => handleImproveLyrics('clean')} className="w-full p-4 rounded-2xl bg-surface-bright border border-outline-variant/20 hover:border-secondary/50 transition-all text-left group">
                  <div className="font-headline font-bold text-on-surface group-hover:text-secondary mb-1">Mejoramos tu letra sin agregar nada</div>
                  <div className="text-xs text-on-surface-variant">Solo correcciones poéticas y rítmicas, sin etiquetas de estructura.</div>
                </button>
                <button onClick={() => handleImproveLyrics('full')} className="w-full p-4 rounded-2xl bg-secondary/10 border border-secondary/20 hover:bg-secondary/20 transition-all text-left group">
                  <div className="font-headline font-bold text-secondary mb-1">Mejoramos tu letra y la hacemos canción</div>
                  <div className="text-xs text-on-surface-variant">Estructura completa con versos, estribillos y puentes para Suno AI.</div>
                </button>
                <button onClick={() => setShowAIModal(false)} className="mt-4 text-sm font-body text-outline hover:text-on-surface transition-colors">Cancelar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex justify-center mb-12"><StepIndicator currentStep={3} /></div>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-6">
          <header className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20 text-secondary text-[10px] uppercase font-bold tracking-[0.2em] mb-4">
              <Sparkles size={12} /> Powered by Gemini 2.0 Flash
            </div>
            <h1 className="text-4xl md:text-5xl font-headline font-bold tracking-tight text-on-surface">Letra y Corazón</h1>
            <p className="text-on-surface-variant mt-4 max-w-2xl mx-auto font-body">Define la identidad de tu track de forma inteligente.</p>
          </header>

          <div className="flex flex-col gap-4">
            {/* AI Status/Error Banner */}
            <AnimatePresence>
              {aiError && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }} 
                  animate={{ height: 'auto', opacity: 1 }} 
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-error/10 border border-error/20 rounded-xl p-4 flex items-center gap-3 overflow-hidden"
                >
                  <AlertCircle size={20} className="text-error shrink-0" />
                  <p className="text-xs text-error font-medium">{aiError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Topic Input Section */}
            <div className="glass-card p-6 rounded-2xl border border-outline-variant/15 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-widest text-secondary">¿De qué trata tu canción?</label>
                <span className="text-[10px] text-on-surface-variant">Describe una idea, sentimiento o historia</span>
              </div>
              <div className="flex gap-3">
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="flex-1 bg-surface-container border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-secondary transition-colors"
                  placeholder="Ej: Un programador que toma café en la madrugada buscando un bug..."
                />
                <button
                  onClick={handleGenerateFromTopic}
                  disabled={isImproving || !topic}
                  className="px-6 py-3 rounded-xl bg-secondary text-black font-bold text-sm hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-2 whitespace-nowrap"
                >
                  {isImproving ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  Generar Letra
                </button>
              </div>
            </div>

            <div className="group relative bg-surface-container p-6 rounded-2xl transition-all duration-300 hover:bg-surface-bright">
              <label className="block text-xs font-body uppercase tracking-widest text-primary mb-2">Título de la Obra</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent border-none p-0 text-2xl font-headline font-semibold text-on-surface placeholder:text-outline-variant focus:ring-0 focus:outline-none"
                placeholder="Escribe el nombre de tu canción..."
                type="text"
              />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-gradient-to-r from-primary-container to-secondary transition-all duration-500 group-focus-within:w-full"></div>
            </div>

            <div className="relative bg-surface-container rounded-2xl min-h-[400px] flex flex-col overflow-hidden border border-outline-variant/5">
              <div className="bg-surface-bright/50 px-6 py-2 border-b border-outline-variant/10 flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Contenido de la Letra</span>
                <div className="flex items-center gap-2">
                  {isAIOptimized && (
                    <span className="text-[10px] font-bold text-secondary flex items-center gap-1">
                      <Check size={10} /> IA Estructurada
                    </span>
                  )}
                </div>
              </div>
              <textarea
                value={lyrics}
                onChange={(e) => handleLyricsChange(e.target.value)}
                className="flex-grow bg-transparent p-8 text-lg font-body leading-relaxed text-on-surface placeholder:text-outline-variant/30 focus:ring-0 focus:outline-none resize-none"
                placeholder="Escribe aquí o genera una letra desde arriba..."
              ></textarea>
              <div className="absolute bottom-6 right-6 flex gap-2">
                <button
                  onClick={() => setShowAIModal(true)}
                  disabled={isImproving || !lyrics}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-surface-container-highest border border-outline-variant/20 text-on-surface font-bold text-sm hover:bg-surface-bright active:scale-95 transition-all disabled:opacity-50"
                >
                  <Sparkles size={16} className="text-secondary" /> Mejorar Existente
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4 max-w-2xl mx-auto w-full">
          <button onClick={onBack} className="flex-1 py-4 rounded-xl font-headline font-bold text-on-surface bg-surface-container-high hover:bg-surface-bright transition-colors flex items-center justify-center gap-2">
            <ArrowLeft size={18} /> Atrás
          </button>
          <button
            onClick={handleNextWithOptimization}
            disabled={isOptimizing || !lyrics}
            className="flex-[2] py-4 rounded-xl font-headline font-bold text-black bg-gradient-to-r from-primary-container to-secondary shadow-lg shadow-primary/20 flex items-center justify-center gap-2 scale-100 active:scale-95 transition-transform disabled:opacity-70"
          >
            {isOptimizing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Optimizando Estructura...
              </>
            ) : (
              <>
                Continuar a la Mezcla <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const DynamicLoader = () => {
  const tasks = [
    "Leyendo la Letra...",
    "Contratando los Artistas...",
    "Creando melodías...",
    "Adaptando el ritmo...",
    "Agregando Magia...",
    "Una pizca de Creación...",
    "Preparando todo para Sorprenderte...",
    "Adquiriendo habilidades...",
    "Pronto escucharás tu idea..."
  ];
  const [visibleTasks, setVisibleTasks] = React.useState<number[]>([]);
  React.useEffect(() => {
    const interval = setInterval(() => {
      setVisibleTasks(prev => {
        if (prev.length >= tasks.length) return prev;
        return [...prev, prev.length];
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm">
      {tasks.map((task, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: -20 }}
          animate={visibleTasks.includes(idx) ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
          className="flex items-center gap-3"
        >
          <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${visibleTasks.includes(idx + 1) ? 'bg-primary border-primary text-black' : 'border-outline-variant text-transparent'}`}>
            <Check size={12} strokeWidth={4} />
          </div>
          <span className={`text-sm font-body ${visibleTasks.includes(idx + 1) ? 'text-on-surface-variant line-through opacity-50' : visibleTasks.includes(idx) ? 'text-on-surface font-bold' : 'text-outline'}`}>
            {task}
          </span>
          {visibleTasks.includes(idx) && !visibleTasks.includes(idx + 1) && (
            <Loader2 size={14} className="text-primary animate-spin" />
          )}
        </motion.div>
      ))}
    </div>
  );
};

const ResultStep = ({
  state,
  onReset,
  onPay,
}: {
  state: AppState;
  onReset: () => void;
  onPay: (track: SunoTrack) => void;
}) => {
  const hasTracks = state.generatedTracks.length > 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center w-full max-w-7xl">
      <StepIndicator currentStep={4} />
      <div className="text-center mb-16">
        <span className="text-primary font-body font-semibold tracking-widest uppercase text-xs mb-3 block">Proyecto Finalizado</span>
        <h1 className="text-5xl md:text-7xl font-headline font-bold tracking-tight mb-4">
          {hasTracks ? 'Tu Obra Maestra está lista' : 'Componiendo tu Obra...'}
        </h1>
        <p className="text-on-surface-variant max-w-xl mx-auto text-lg">
          {hasTracks
            ? 'Hemos procesado tu composición utilizando síntesis neuronal de alta fidelidad. Selecciona tu versión preferida para escuchar o descargar.'
            : 'Nuestra orquesta neuronal está trabajando en los detalles finales. Esto puede tomar algunos minutos.'}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-20 w-full">
        {hasTracks ? (
          state.generatedTracks.map((track, idx) => {
            const isPaid = state.paidTrackIds.includes(track.id);
            return (
              <div key={track.id} className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className={`text-[10px] font-bold ${idx === 0 ? 'text-primary bg-primary/20' : 'text-secondary bg-secondary/20'} px-3 py-1 rounded-full uppercase tracking-tighter`}>
                    Mezcla {idx === 0 ? 'A: Dinámica' : 'B: Cinemática'}
                  </span>
                  {isPaid && (
                    <span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-3 py-1 rounded-full uppercase tracking-tighter flex items-center gap-1">
                      <Check size={10} /> Pagada
                    </span>
                  )}
                </div>

                <MusicPlayer
                  audioUrl={track.stream_audio_url}
                  title={track.title || state.title || 'Pista Generada'}
                  imageUrl={track.image_url}
                />

                {/* Download / Buy button */}
                <div className="flex gap-3">
                  {isPaid ? (
                    <a
                      href={track.audio_url}
                      download={`${track.title || 'cancion'}.mp3`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-green-500/30 transition-all"
                    >
                      <Download size={16} />
                      Descargar MP3
                    </a>
                  ) : (
                    <button
                      onClick={() => onPay(track)}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary-container to-secondary text-black font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all"
                    >
                      <ShoppingCart size={16} />
                      Comprar · $5 USD
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-2 text-center py-20 px-6 glass-card rounded-3xl flex flex-col items-center justify-center border border-outline-variant/20 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-surface-container-highest overflow-hidden">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 20, ease: "linear" }}
              />
            </div>
            <div className="mb-10 text-center">
              <h3 className="text-3xl font-headline font-bold mb-3 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Componiendo tu Obra...
              </h3>
              <p className="text-on-surface-variant font-body">Nuestra orquesta neuronal está trabajando en los detalles finales.</p>
            </div>
            <DynamicLoader />
            {state.taskId && (
              <div className="mt-12 pt-6 border-t border-outline-variant/10 w-full flex flex-col items-center gap-2">
                <p className="text-[10px] text-outline uppercase tracking-[0.3em] font-bold">ID de Tarea: {state.taskId}</p>
                <p className="text-[10px] text-outline/60 uppercase tracking-widest">Tu sesión está guardada. Puedes cerrar y volver más tarde.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <section className="max-w-4xl mx-auto w-full">
        <div className="mt-12 flex justify-center">
          <button onClick={onReset} className="text-on-surface-variant hover:text-white flex items-center gap-2 transition-colors group uppercase font-bold text-sm tracking-widest">
            <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" /> Crear Nueva Canción
          </button>
        </div>
      </section>
    </motion.div>
  );
};

// ─── Main App ────────────────────────────────────────────────────────────────

const DEFAULT_STATE: AppState = {
  step: 'landing',
  purpose: '',
  genre: 'Rock',
  tempo: 128,
  mood: 'Enérgico y Potente',
  title: '',
  lyrics: '',
  isGenerating: false,
  taskId: null,
  customMode: true,
  instrumental: false,
  negativeTags: 'Heavy Metal, Batería Rápida',
  vocalGender: 'm',
  styleWeight: 0.65,
  weirdnessConstraint: 0.65,
  audioWeight: 0.65,
  personaId: 'persona_123',
  uploadUrl: '',
  generatedTracks: [],
  paidTrackIds: [],
};

export default function App() {
  const [state, setState] = React.useState<AppState>(DEFAULT_STATE);
  const [pendingSession, setPendingSession] = React.useState<SessionData | null>(null);
  const [payingTrack, setPayingTrack] = React.useState<SunoTrack | null>(null);
  const socketRef = React.useRef<Socket | null>(null);

  // ── On mount: check for session & payment return ──────────────────────────
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const paidTrackId = urlParams.get('trackId');
    const returnTaskId = urlParams.get('taskId');

    const session = loadSession();

    if (paymentStatus === 'success' && paidTrackId && session) {
      // Payment was completed — restore session and mark track as paid
      const newPaidIds = [...(session.paidTrackIds || [])];
      if (!newPaidIds.includes(paidTrackId)) newPaidIds.push(paidTrackId);

      const restored: AppState = {
        ...DEFAULT_STATE,
        ...session,
        paidTrackIds: newPaidIds,
        step: session.generatedTracks.length > 0 ? 'result' : 'landing',
      };
      setState(restored);
      saveSession(restored);

      // Clean URL without reloading
      window.history.replaceState({}, '', window.location.pathname);
    } else if (paymentStatus === 'failure' && session) {
      // Payment failed — just restore session
      const restored: AppState = {
        ...DEFAULT_STATE,
        ...session,
        step: session.generatedTracks.length > 0 ? 'result' : 'landing',
      };
      setState(restored);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (session && (session.generatedTracks.length > 0 || session.taskId)) {
      // There's a saved session — ask if user wants to restore
      setPendingSession(session);
    }
  }, []);

  // ── Persist session whenever relevant state changes ───────────────────────
  React.useEffect(() => {
    if (state.taskId || state.generatedTracks.length > 0) {
      saveSession(state);
    }
  }, [state.taskId, state.generatedTracks, state.paidTrackIds, state.title]);

  // ── Socket.IO — listen for real-time completion events ───────────────────
  React.useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const handleMusicComplete = (data: any) => {
      console.log('Socket: music:complete received', data);
      if (data?.data?.callbackType !== 'complete') return;
      const tracks: SunoTrack[] | null = data?.data?.data;
      if (Array.isArray(tracks) && tracks.length > 0) {
        setState(s => {
          // Only update if this event is for the current task
          const taskId = data?.data?.task_id;
          if (taskId && s.taskId && taskId !== s.taskId) return s;
          if (s.generatedTracks.length > 0) return s; // already have tracks
          return { ...s, generatedTracks: tracks };
        });
      }
    };

    socket.on('music:complete', handleMusicComplete);
    return () => { socket.off('music:complete', handleMusicComplete); };
  }, []);

  // ── Polling — fallback for when socket isn't reliable ─────────────────────
  React.useEffect(() => {
    if (!state.taskId || state.generatedTracks.length > 0) return;

    let attempts = 0;
    const MAX_ATTEMPTS = 40; // 40 × 10s = ~7 min

    const poll = async () => {
      attempts++;
      try {
        const tracks = await getTaskDetails(state.taskId!);
        if (tracks && tracks.length > 0) {
          setState(s => ({ ...s, generatedTracks: tracks }));
          clearInterval(interval);
        }
      } catch (err) {
        console.warn('Polling error:', err);
      }
      if (attempts >= MAX_ATTEMPTS) {
        console.error('Polling timeout: no response in 7 min.');
        clearInterval(interval);
      }
    };

    // First poll immediately, then every 10s
    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [state.taskId, state.generatedTracks.length]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleStart = () => setState(s => ({ ...s, step: 'purpose' }));
  const handlePurposeNext = (purpose: string) => setState(s => ({ ...s, purpose, step: 'style' }));
  const handleStyleNext = (genre: string, tempo: number, mood: string, advanced: Partial<AppState>) =>
    setState(s => ({ ...s, genre, tempo, mood, ...advanced, step: 'lyrics' }));

  const handleLyricsNext = async (title: string, lyrics: string) => {
    setState(s => ({ ...s, title, lyrics, isGenerating: true }));

    const genreMap: Record<string, string> = {
      'Rock': 'Rock, Electric Guitar', 'Jazz': 'Jazz, Saxophone, Smooth',
      'Cumbia': 'Cumbia, Latin Percussion', 'Cuarteto': 'Cuarteto, Cordoba Style, Upbeat',
      'Salsa': 'Salsa, Tropical, Brass', 'Electronica': 'Electronic, Synth, Dance',
      'Chamamé': 'Chamame, Accordion, Folk', 'Folklore': 'Folklore, Acoustic Guitar, Traditional',
      'Milonga': 'Milonga, Tango Rhythm', 'Chacarera': 'Chacarera, Bombo Leguero',
      'Tango': 'Tango, Bandoneon, Dramatic', 'Clasico': 'Classical, Orchestral',
      'Reggaeton': 'Reggaeton, Urban, Dembow', 'Balada': 'Ballad, Emotional, Piano',
      'Bolero': 'Bolero, Romantic, Latin', 'Pop': 'Pop, Catchy, Modern'
    };
    const moodMap: Record<string, string> = {
      'Feliz / Alegre': 'Happy, Joyful, Upbeat', 'Energico / Potente': 'Energetic, Powerful, Intense',
      'Emocional / Profundo': 'Emotional, Deep, Soulful', 'Romantico / Sentimental': 'Romantic, Sentimental, Sweet',
      'Relajado / Calmo': 'Relaxing, Calm, Peaceful', 'Bailable': 'Danceable, Groovy, Rhythm'
    };

    const englishGenre = genreMap[state.genre] || state.genre;
    const englishMood = moodMap[state.mood] || state.mood;
    const vocalInfo = state.vocalGender === 'm' ? 'Male Vocals' : state.vocalGender === 'f' ? 'Female Vocals' : 'Instrumental';
    const styleString = `${englishGenre}, ${state.tempo} BPM, ${englishMood}, ${vocalInfo}`.trim();

    const request: MusicGenerationRequest = {
      prompt: lyrics,
      customMode: true,
      instrumental: state.instrumental || state.vocalGender === 'none',
      model: "V4_5ALL",
      callBackUrl: "placeholder", // overridden by server
      style: styleString,
      title,
      negativeTags: state.negativeTags,
      vocalGender: state.vocalGender,
      tempo: state.tempo,
      styleWeight: state.styleWeight,
      weirdnessConstraint: state.weirdnessConstraint,
      audioWeight: state.audioWeight,
      personaId: state.personaId,
      personaModel: "style_persona",
      uploadUrl: state.uploadUrl
    };

    try {
      const res = await generateMusic(request);
      if (res?.data) {
        setState(s => ({ ...s, taskId: res.data.taskId, isGenerating: false, step: 'result' }));
      } else {
        console.error('API response missing data:', res);
        setState(s => ({ ...s, isGenerating: false, step: 'result' }));
      }
    } catch (error) {
      console.error(error);
      setState(s => ({ ...s, isGenerating: false, step: 'result' }));
    }
  };

  const handleBack = () => {
    const steps: AppStep[] = ['landing', 'purpose', 'style', 'lyrics', 'result'];
    const currentIndex = steps.indexOf(state.step);
    if (currentIndex > 0) setState(s => ({ ...s, step: steps[currentIndex - 1] }));
  };

  const handleReset = () => {
    clearSession();
    setState(DEFAULT_STATE);
  };

  const handleRestoreSession = () => {
    if (!pendingSession) return;
    const restored: AppState = {
      ...DEFAULT_STATE,
      taskId: pendingSession.taskId,
      title: pendingSession.title,
      generatedTracks: pendingSession.generatedTracks,
      paidTrackIds: pendingSession.paidTrackIds || [],
      step: pendingSession.generatedTracks.length > 0 ? 'result' : 'result',
    };
    setState(restored);
    setPendingSession(null);
  };

  const handleDismissSession = () => {
    clearSession();
    setPendingSession(null);
  };

  const handlePayTrack = (track: SunoTrack) => {
    setPayingTrack(track);
  };

  const handlePaymentModalClose = () => setPayingTrack(null);

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-secondary/30">
      <Navbar />

      {/* Session Recovery Banner */}
      <AnimatePresence>
        {pendingSession && (
          <SessionBanner
            session={pendingSession}
            onRestore={handleRestoreSession}
            onDismiss={handleDismissSession}
          />
        )}
      </AnimatePresence>

      <main className="flex-grow pt-24 pb-12 px-6 flex flex-col items-center">
        <AnimatePresence mode="wait">
          {state.step === 'landing' && <Landing onStart={handleStart} />}
          {state.step === 'purpose' && <PurposeStep onNext={handlePurposeNext} onBack={handleBack} />}
          {state.step === 'style' && <StyleStep onNext={handleStyleNext} onBack={handleBack} />}
          {state.step === 'lyrics' && <LyricsStep onNext={handleLyricsNext} onBack={handleBack} />}
          {state.step === 'result' && (
            <ResultStep state={state} onReset={handleReset} onPay={handlePayTrack} />
          )}
        </AnimatePresence>
      </main>

      {/* Generating overlay */}
      {state.isGenerating && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-md flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-secondary border-t-transparent rounded-full animate-spin mb-6"></div>
          <h2 className="text-2xl font-headline font-bold">Generando tu obra maestra...</h2>
          <p className="text-on-surface-variant mt-2">Nuestra IA está componiendo los arreglos finales.</p>
        </div>
      )}

      {/* Payment Modal */}
      <AnimatePresence>
        {payingTrack && state.taskId && (
          <PaymentModal
            track={payingTrack}
            taskId={state.taskId}
            onClose={handlePaymentModalClose}
            onSuccess={(trackId) => {
              setState(s => ({ ...s, paidTrackIds: [...s.paidTrackIds, trackId] }));
              setPayingTrack(null);
            }}
          />
        )}
      </AnimatePresence>

      <Footer />

      {/* Background decorative */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary-container/10 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-secondary/5 blur-[150px]"></div>
      </div>
    </div>
  );
}