/** Coordonnées publiques, lues au moment du build (variables VITE_* dans Vercel ou .env). Vides = lignes masquées. */
export const WHATSAPP = String(import.meta.env.VITE_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');
export const CONTACT_EMAIL = String(import.meta.env.VITE_CONTACT_EMAIL ?? '').trim();

/** Préfixe des fichiers de public/ : « / » en production, « ./ » dans l'aperçu autonome. */
export const asset = (p: string) => import.meta.env.BASE_URL + p;
/** Aperçu autonome (npm run apercu) : une seule page, langues changées sans navigation. */
export const APERCU = import.meta.env.BASE_URL !== '/';
