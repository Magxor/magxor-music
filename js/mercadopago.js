/**
 * MercadoPago Integration Module
 * MAGXOR Music - Payment Processing
 */

const MercadoPago = {
  publicKey: 'APP_USR-f52b077b-6253-4df0-804c-002b7f422839',
  preferenceUrl: '/api/create-payment',
  
  async init() {
    console.log('MercadoPago initialized');
  },

  async createPreference(songData) {
    const response = await fetch(this.preferenceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        trackId: songData.songId,
        trackTitle: songData.songTitle,
        taskId: songData.taskId,
        useCoupon: songData.useCoupon || false,
        price: songData.price || 30000
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create preference');
    }

    return response.json();
  },

  async openCheckout(initPoint) {
    window.location.href = initPoint;
  },

  handleReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const payment = urlParams.get('payment');
    const songId = urlParams.get('song');
    const coupon = urlParams.get('coupon');

    if (payment === 'success') {
      console.log('Payment success:', { songId, coupon });
      return { success: true, songId, coupon };
    } else if (payment === 'failure') {
      console.log('Payment failure');
      return { success: false, error: 'Pago fallido' };
    } else if (payment === 'pending') {
      console.log('Payment pending');
      return { success: false, error: 'Pago pendiente' };
    }
    
    return null;
  }
};

window.MercadoPago = MercadoPago;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => MercadoPago.init());
} else {
  MercadoPago.init();
}
