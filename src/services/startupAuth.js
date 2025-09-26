import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { IS_DEV } from '../config/runtime.js';

// IMPORTANT: we keep AppCheck disabled unless a site key is provided.
// This unblocks Firestore on GitHub Pages until AppCheck is configured.
export function startFirebase() {
  const firebaseConfig = {
    apiKey:          import.meta.env.VITE_FB_API_KEY,
    authDomain:      import.meta.env.VITE_FB_AUTH_DOMAIN,
    projectId:       import.meta.env.VITE_FB_PROJECT_ID,
    storageBucket:   import.meta.env.VITE_FB_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FB_SENDER_ID,
    appId:           import.meta.env.VITE_FB_APP_ID,
  };
  const app = initializeApp(firebaseConfig);

  // NOTE: AppCheck intentionally omitted unless site key present.
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (siteKey && !IS_DEV) {
    // If you later add AppCheck, re-enable here with ReCaptchaV3Provider.
    // import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
    // initializeAppCheck(app, { provider: new ReCaptchaV3Provider(siteKey), isTokenAutoRefreshEnabled: true });
  } else if (IS_DEV) {
    // Dev: no AppCheck; Firebase SDK works without it locally.
    // console.debug('[appcheck] disabled in dev');
  }

  const auth = getAuth(app);
  const db   = getFirestore(app);

  // ensure we’re signed in (anon)
  onAuthStateChanged(auth, (u) => {
    if (!u) signInAnonymously(auth).catch(() => {/* ignore */});
  });

  return { app, auth, db };
}
