// src/lib/firebase.js
import { firebaseConfig } from "../firebaseConfig.js";
import { initializeApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, serverTimestamp } from "firebase/firestore";

const app = initializeApp(firebaseConfig);

// App Check alleen buiten dev
if (!import.meta.env.DEV) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(
      import.meta.env.VITE_RCAPTCHA_SITE_KEY
    ),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const ts = serverTimestamp;

export async function ensureAuth() {
  if (!auth.currentUser) await signInAnonymously(auth);
  return new Promise((resolve) =>
    onAuthStateChanged(auth, (u) => u && resolve(u))
  );
}
