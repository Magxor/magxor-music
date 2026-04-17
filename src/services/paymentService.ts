import { SunoTrack } from '../types';

const PAYMENT_URL = '/api/create-payment';

export const PRICE_FULL = 30000;
export const PRICE_DISCOUNTED = 15000;
export const COUPON_PREFIX = 'MAGXORMUSIC-';

export interface PaymentRequest {
  trackId: string;
  trackTitle: string;
  taskId: string;
  useCoupon: boolean;
}

export interface PaymentResponse {
  init_point: string;
  preference_id: string;
  price: number;
  originalPrice: number;
  couponCode?: string;
}

export interface ValidateCouponResponse {
  success: boolean;
  discount?: number;
  error?: string;
}

export interface GenerateCouponResponse {
  success: boolean;
  couponCode?: string;
  error?: string;
}

/**
 * Validates a coupon code
 */
export async function validateCoupon(couponCode: string): Promise<ValidateCouponResponse> {
  try {
    const response = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ couponCode: couponCode.toUpperCase() }),
    });
    return response.json();
  } catch (error) {
    console.error('Coupon validation error:', error);
    return { success: false, error: 'Error al validar cupón' };
  }
}

/**
 * Generates a new coupon after purchase
 */
export async function generateCoupon(): Promise<GenerateCouponResponse> {
  try {
    const response = await fetch('/api/coupons/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  } catch (error) {
    console.error('Coupon generation error:', error);
    return { success: false, error: 'Error al generar cupón' };
  }
}

/**
 * Claims a coupon (marks it as used after successful payment)
 */
export async function claimCoupon(couponCode: string): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`/api/coupons/claim/${couponCode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  } catch (error) {
    console.error('Coupon claim error:', error);
    return { success: false };
  }
}

/**
 * Creates a MercadoPago payment preference for a track download.
 * Returns the checkout URL to redirect the user to.
 */
export async function createPayment(
  track: SunoTrack,
  taskId: string,
  useCoupon: boolean = false
): Promise<PaymentResponse> {
  const price = useCoupon ? PRICE_DISCOUNTED : PRICE_FULL;

  const response = await fetch(PAYMENT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trackId: track.id,
      trackTitle: track.title || 'Canción Generada',
      taskId,
      useCoupon,
      price,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error || `Payment error: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Gets the price display string
 */
export function formatPrice(price: number): string {
  return `$${price.toLocaleString('es-AR')} ARS`;
}
