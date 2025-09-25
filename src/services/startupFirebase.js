import { getApp, getApps } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';

// In dev, bypass reCAPTCHA with a debug token (no UI). In prod, we don't set this.
if (import.meta.env.DEV) {
  // You can set a fixed token in .env.local (VITE_APPCHECK_DEBUG_TOKEN),
  // or 'true' lets the SDK issue one in the console the first time.
  self.FIREBASE_APPCHECK_DEBUG_TOKEN =
    import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
}

// Wait until your Firebase app is initialized somewhere else (e.g. app.js)
async function waitForApp() {
  const t0 = Date.now();
  while (getApps().length === 0 && Date.now() - t0 < 5000) {
    await new Promise(r => setTimeout(r, 0));
  }
  return getApps()[0] || getApp(); // throws if still missing (which would mean init never ran)
}

(async () => {
  const app = await waitForApp();

  // Enable real App Check only in production
  if (import.meta.env.PROD) {
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(import.meta.env.VITE_RCAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (_) {
      // no-op (already initialized or not needed)
    }
  }

  // Ensure we are authenticated (anonymous) so Firestore rules with request.auth pass
  try {
    const auth = getAuth(app);
    let resolved = false;
    const done = () => { if (!resolved) { resolved = true; } };

    onAuthStateChanged(auth, (user) => {
      if (!user) signInAnonymously(auth).catch(() => {});
      done();
    });

    // Kick it once immediately too (idempotent if already signed in)
    await signInAnonymously(auth).catch(() => {});
  } catch (_) {
    // no-op; auth may not be used on some pages
  }
})();
