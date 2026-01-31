import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Safe access to environment variables using optional chaining.
// This prevents "Cannot read properties of undefined" if import.meta.env is not fully initialized,
// while still allowing Vite to statically replace the strings.
const apiKey = import.meta.env?.VITE_FIREBASE_API_KEY;
const authDomain = import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN;
const projectId = import.meta.env?.VITE_FIREBASE_PROJECT_ID;
const storageBucket = import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID;
const appId = import.meta.env?.VITE_FIREBASE_APP_ID;

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId
};

// Check if config is valid to provide helpful error instead of crash
if (!apiKey) {
    console.error("Firebase API Key is missing. Check your .env file.");
}

// Initialize Firebase only once
// We add a check for apiKey to prevent initialization with invalid config which throws internal Firebase errors
const app = (!getApps().length && apiKey) ? initializeApp(firebaseConfig) : (getApps()[0] || undefined);

// Export auth/db/storage only if app is initialized, otherwise export dummies or handle errors
// To keep TS happy and app running (even if offline/broken auth), we cast or handle nulls if needed.
// However, for this demo, we assume if app is missing, we can't do much. 
// We will return the auth instance if app exists, or throw/warn.
// Ideally we want the UI to handle "Offline mode" if Firebase fails.

const auth = app ? getAuth(app) : undefined;
const db = app ? getFirestore(app) : undefined;
const storage = app ? getStorage(app) : undefined;
const googleProvider = new GoogleAuthProvider();

export { auth, db, storage };

export const login = async () => {
    if (!auth) {
        alert("Authentication is not configured (Missing API Key).");
        return;
    }
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        console.error("Login failed", error);
        alert("Login failed. See console for details.");
    }
};

export const logout = async () => {
    if (!auth) return;
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout failed", error);
    }
};