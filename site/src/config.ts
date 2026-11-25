/** Coordonnées publiques, lues au moment du build (variables VITE_* dans Vercel ou .env). Vides = lignes masquées. */
export const WHATSAPP = String(import.meta.env.VITE_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');
export const CONTACT_EMAIL = String(import.meta.env.VITE_CONTACT_EMAIL ?? '').trim();
