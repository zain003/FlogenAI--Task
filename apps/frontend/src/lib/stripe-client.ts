import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Initializes and caches the Stripe.js promise singleton.
 * Uses NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY with graceful fallback.
 */
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const publishableKey =
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
      'pk_test_placeholder_publishable_key';
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
}
