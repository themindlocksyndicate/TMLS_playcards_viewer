import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

export async function ensureAnonAuth(app) {
  const auth = getAuth(app);
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) { unsub(); resolve(user); }
    });
    signInAnonymously(auth).catch(() => {}); // ignore if already signed in
  });
}

export function setupAppCheck(app, siteKey) {
  try {
    if (import.meta.env.DEV) {
      // @ts-ignore
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      return initializeAppCheck(app, { provider: new ReCaptchaV3Provider('dev-debug-key'), isTokenAutoRefreshEnabled: true });
    }
    if (siteKey) {
      return initializeAppCheck(app, { provider: new ReCaptchaV3Provider(siteKey), isTokenAutoRefreshEnabled: true });
    }
  } catch {}
  return null;
}
