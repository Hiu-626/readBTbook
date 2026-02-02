import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// 1. Fallback Configuration
// If environment variables fail to load (causing the white screen), these keys will be used.
// This ensures the app works immediately.
const FALLBACK_CONFIG = {
  apiKey: "AIzaSyBkh6owAC6XvHXEqkUKsorwGOv5PMyFtsQ",
  authDomain: "inkreader-b08d4.firebaseapp.com",
  projectId: "inkreader-b08d4",
  storageBucket: "inkreader-b08d4.firebasestorage.app",
  messagingSenderId: "1045804102461",
  appId: "1:1045804102461:web:a18fa19819ecafc3998b54"
};

// 2. Safe Environment Accessor
// Safely tries to read import.meta.env without crashing if it's undefined.
const getEnv = (key: string, fallback: string): string => {
  try {
    // Check if import.meta.env exists before accessing properties
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      return import.meta.env[key] || fallback;
    }
  } catch (e) {
    console.warn("Environment variable access failed, using fallback.");
  }
  return fallback;
};

const config = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY', FALLBACK_CONFIG.apiKey),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN', FALLBACK_CONFIG.authDomain),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID', FALLBACK_CONFIG.projectId),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET', FALLBACK_CONFIG.storageBucket),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', FALLBACK_CONFIG.messagingSenderId),
  appId: getEnv('VITE_FIREBASE_APP_ID', FALLBACK_CONFIG.appId)
};

// Variables to export (initialized as undefined)
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

// 3. Defensive Initialization
// We check if the critical "apiKey" exists before trying to initialize.
if (config.apiKey) {
  try {
    // Prevent double initialization
    app = !getApps().length ? initializeApp(config) : getApps()[0];
    
    // Initialize services
    if (app) {
      auth = getAuth(app);
      db = getFirestore(app);
      storage = getStorage(app);
    }
  } catch (e) {
    console.error("⚠️ Firebase Initialization Error:", e);
    console.warn("The application is running in Offline Mode.");
  }
} else {
  console.warn("⚠️ No Firebase Configuration found.");
}

const googleProvider = new GoogleAuthProvider();

export { auth, db, storage };

// 4. Safe Action Wrappers
export const login = async () => {
    if (!auth) {
        alert("Syncing is currently disabled (Offline Mode).");
        return;
    }
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
        console.error("Login failed", error);
        if (error.code === 'auth/popup-closed-by-user') return;
        if (error.code === 'auth/cancelled-popup-request') return;
        alert(`Login failed: ${error.message}`);
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
