import React from 'react';
import { motion } from 'framer-motion';
import { Gift, Copy, Check, Share2 } from 'lucide-react';

const COUPON_PREFIX = 'MAGXORMUSIC-';
const PRICE_FULL = 30000;
const PRICE_DISCOUNTED = 15000;

export const ExpirationTimer = ({ expiresAt, onExpire }: { expiresAt: number; onExpire: () => void }) => {
  const [timeLeft, setTimeLeft] = React.useState<number>(0);

  React.useEffect(() => {
    const calculateTimeLeft = () => {
      const diff = expiresAt - Date.now();
      return Math.max(0, diff);
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        onExpire();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, onExpire]);

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-20 right-6 z-50 flex items-center gap-3 px-4 py-2 rounded-full bg-surface-container border border-outline-variant/20 shadow-lg"
    >
      <div className="w-5 h-5 flex items-center justify-center text-warning">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <span className="font-mono font-bold text-warning tracking-wider">
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </motion.div>
  );
};

export const ExitConfirmModal = ({ onContinue, onLeave }: { onContinue: () => void; onLeave: () => void }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
  >
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-surface-container-high p-8 rounded-3xl border border-outline-variant/20 max-w-md w-full shadow-2xl text-center"
    >
      <div className="text-6xl mb-6">👋</div>
      <h3 className="text-2xl font-headline font-bold mb-3">¿Sigues ahí?</h3>
      <p className="text-on-surface-variant mb-8">
        Tu sesión está por expirar. ¿Querés seguir creando tu música?
      </p>
      <div className="flex flex-col gap-3">
        <button
          onClick={onContinue}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary-container to-secondary text-black font-bold uppercase tracking-wider hover:brightness-110 transition-all"
        >
          Sí, continuar
        </button>
        <button
          onClick={onLeave}
          className="w-full py-4 rounded-2xl border border-outline-variant/20 font-bold uppercase tracking-wider hover:bg-surface-variant transition-all"
        >
          Salir
        </button>
      </div>
    </motion.div>
  </motion.div>
);

export const SocialCounter = () => {
  const [count, setCount] = React.useState<number>(12847);

  React.useEffect(() => {
    const baseCount = 12847;
    const randomAdd = Math.floor(Math.random() * 150) + 50;
    setCount(baseCount + randomAdd);
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container border border-outline-variant/15 shadow-lg">
      <span className="text-lg">👥</span>
      <span className="text-sm font-medium text-on-surface-variant">
        <span className="text-white font-bold">{count.toLocaleString()}</span> creando música
      </span>
    </div>
  );
};

export const CouponInput = ({
  onApply,
  disabled,
}: {
  onApply: (code: string) => void;
  disabled?: boolean;
}) => {
  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [applied, setApplied] = React.useState(false);

  const handleApply = async () => {
    if (!code.trim() || disabled) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponCode: code.toUpperCase() }),
      });
      const data = await response.json();

      if (data.success) {
        setApplied(true);
        onApply(code.toUpperCase());
      } else {
        setError(data.error || 'Cupón inválido');
      }
    } catch {
      setError('Error al validar cupón');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
          }}
          disabled={disabled || applied}
          placeholder={`${COUPON_PREFIX}0001`}
          className="flex-1 bg-surface-container border border-outline-variant/20 rounded-xl px-4 py-3 text-sm font-mono uppercase placeholder:normal-case focus:outline-none focus:border-secondary transition-colors disabled:opacity-50"
        />
        <button
          onClick={handleApply}
          disabled={loading || !code.trim() || disabled || applied}
          className="px-6 py-3 rounded-xl bg-secondary text-black font-bold text-sm hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-2"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          ) : applied ? (
            <>
              <Check size={16} /> Aplicado
            </>
          ) : (
            'Aplicar'
          )}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">
          {error}
        </p>
      )}
      {applied && (
        <p className="text-xs text-green-400 bg-green-500/10 px-3 py-2 rounded-lg border border-green-500/20">
          ¡50% de descuento aplicado! Precio: $15.000 ARS
        </p>
      )}
    </div>
  );
};

export const CouponModal = ({
  couponCode,
  onClose,
  onCopy,
}: {
  couponCode: string;
  onClose: () => void;
  onCopy: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
  >
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-surface-container-high p-8 rounded-3xl border border-outline-variant/20 max-w-md w-full shadow-2xl text-center"
    >
      <div className="text-6xl mb-4">🎁</div>
      <h3 className="text-2xl font-headline font-bold mb-2 bg-gradient-to-r from-primary-container to-secondary bg-clip-text text-transparent">
        ¡Felicidades!
      </h3>
      <p className="text-on-surface-variant mb-6">
        Tu canción está lista para descargar
      </p>

      <div className="bg-gradient-to-r from-primary/20 to-secondary/20 rounded-2xl p-4 mb-6 border border-primary/20">
        <p className="text-xs text-secondary uppercase tracking-widest font-bold mb-2">GIFT</p>
        <p className="text-sm text-on-surface-variant">También te regalamos la Versión B de tu canción</p>
      </div>

      <div className="bg-surface-container rounded-2xl p-6 mb-6">
        <p className="text-xs text-on-surface-variant uppercase tracking-widest mb-3">
          Tu próximo cupón de 50% OFF
        </p>
        <div className="flex items-center justify-center gap-3">
          <span className="font-mono text-2xl font-bold text-green-400 tracking-wider">
            {couponCode}
          </span>
          <button
            onClick={onCopy}
            className="p-2 rounded-lg bg-surface-container-highest hover:bg-surface-bright transition-colors"
          >
            <Copy size={18} />
          </button>
        </div>
      </div>

      <button
        onClick={onClose}
        className="w-full py-3 rounded-xl bg-surface-container font-bold hover:bg-surface-variant transition-all"
      >
        Cerrar
      </button>
    </motion.div>
  </motion.div>
);

export const CouponDisplay = ({ code }: { code: string }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    const text = encodeURIComponent(
      `🎵 ¡Mira lo que encontré! MAGXOR Music crea canciones personalizadas con IA.\n\n🔥 Usa mi código de descuento y obtén 50% OFF:\n${code}\n\n👉 https://magxormusic.vercel.app`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-6 border border-primary/20">
      <div className="flex items-center justify-between mb-4">
        <span className="text-2xl">🎁</span>
        <span className="text-xs text-secondary uppercase tracking-widest font-bold">50% OFF</span>
      </div>
      <p className="text-xs text-on-surface-variant mb-3">Compartí con tus amigos y obtengan 50% OFF</p>
      <div className="flex items-center gap-2 bg-surface-container rounded-xl p-3">
        <span className="font-mono font-bold text-white flex-1">{code}</span>
        <button
          onClick={handleCopy}
          className="p-2 rounded-lg hover:bg-surface-bright transition-colors"
          title="Copiar"
        >
          {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
        </button>
        <button
          onClick={handleShare}
          className="p-2 rounded-lg hover:bg-surface-bright transition-colors text-green-500"
          title="Compartir"
        >
          <Share2 size={16} />
        </button>
      </div>
    </div>
  );
};

export { COUPON_PREFIX, PRICE_FULL, PRICE_DISCOUNTED };
