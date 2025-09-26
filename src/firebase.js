// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// 👉 Vite env var. Zet deze key alleen in PROD (GitHub Pages / Secrets).
// Als hij leeg is, schakelen we App Check veilig uit (debug-mode).
const SITE_KEY = import.meta.env?.VITE_RECAPTCHA_V3_SITE_KEY;

// ❗ Vul jouw bestaande config hier in (bestond al in je project)
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  appId: "YOUR_APP_ID",
  // ... je overige velden
};

export const app = initializeApp(firebaseConfig);

// ---- App Check: exactly once, early ----
try {
  if (SITE_KEY && typeof SITE_KEY === "string" && SITE_KEY.trim()) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(SITE_KEY), // <-- SITE key!
      isTokenAutoRefreshEnabled: true,
    });
    console.info("[AppCheck] reCAPTCHA v3 enabled");
  } else {
    // Val veilig terug in demo/dev: voorkom 400-spam en blokkerende errors
    // NIET gebruiken in productie.
    // @ts-ignore
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    console.warn("[AppCheck] SITE key missing -> debug token enabled (dev only)");
  }
} catch (e) {
  console.warn("[AppCheck] init skipped", e);
}

// ---- Auth: gate alles totdat we een UID hebben ----
export const auth = getAuth(app);

export const authReady = new Promise((resolve) => {
  onAuthStateChanged(auth, (u) => {
    if (u) return resolve();
    signInAnonymously(auth).finally(() => resolve());
  });
});
