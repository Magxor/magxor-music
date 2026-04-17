/**
 * MercadoPago Integration Module
 * MAGXOR Music - Payment Processing
 */

const MercadoPago = {
  publicKey: 'APP_USR-f52b077b-6253-4df0-804c-002b7f422839',
  preferenceUrl: 'https://api.magxormusic.com/create-preference',
  
  async init() {
    if (typeof MercadoPago !== 'undefined') {
      const mp = new MercadoPago(this.publicKey);
      mp.checkout({
        preference: {
          items: []
        }
      });
    }
  },

  async createPreference(songData) {
    const response = await fetch(this.preferenceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        songId: songData.songId,
        title: songData.songTitle,
        price: songData.amount,
        currency: songData.currency || 'ARS',
        userId: songData.userId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create preference');
    }

    return response.json();
  },

  async openCheckout(preferenceId) {
    const mp = new MercadoPago(this.publicKey, {
      locale: 'es-AR'
    });

    mp.checkout({
      preference: {
        id: preferenceId
      },
      render: {
        container: '.wallet-container',
        label: 'Pagar con Mercado Pago'
      }
    });
  },

  handleReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const paymentId = urlParams.get('payment_id');
    const preferenceId = urlParams.get('preference_id');

    if (status === 'approved') {
      app.handlePaymentSuccess(paymentId, preferenceId);
    } else if (status === 'pending') {
      app.showToast('Pago pendiente. Te notificaremos cuando se confirme.', 'info');
    } else if (status === 'failure') {
      app.showToast('El pago no fue completado. Intenta nuevamente.', 'error');
    }
  }
};

window.MercadoPago = MercadoPago;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => MercadoPago.init());
} else {
  MercadoPago.init();
}
