import { SunoTrack } from '../types';

const PAYMENT_URL = '/api/create-payment';

export interface PaymentRequest {
  trackId: string;
  trackTitle: string;
  taskId: string;
  price: number;
}

export interface PaymentResponse {
  init_point: string;
  preference_id: string;
}

/**
 * Creates a MercadoPago payment preference for a track download.
 * Returns the checkout URL to redirect the user to.
 */
export async function createPayment(
  track: SunoTrack,
  taskId: string,
  price: number = 5
): Promise<PaymentResponse> {
  const response = await fetch(PAYMENT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trackId: track.id,
      trackTitle: track.title || 'Canción Generada',
      taskId,
      price,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error || `Payment error: ${response.statusText}`);
  }

  return response.json();
}
