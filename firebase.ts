import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
// @ts-ignore
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// 1. Safe Environment Accessor
// Safely tries to read import.meta.env without crashing if it's undefined.
// This prevents white screen errors if the environment isn't set up correctly.
const getEnv = (key: string): string => {
  try {
    // Check if import.meta.env exists before accessing properties
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      return import.meta.env[key] || "";
    }
  } catch (e) {
    console.warn("Environment variable access failed.");
  }
  return "";
};

const config = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID')
};

// Variables to export (initialized as undefined)
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

// 2. Defensive Initialization
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
  console.warn("⚠️ No Firebase Configuration found in environment variables. Running in offline mode.");
}

const googleProvider = GoogleAuthProvider ? new GoogleAuthProvider() : undefined;

export { auth, db, storage };

// 3. Safe Action Wrappers
export const login = async () => {
    if (!auth || !googleProvider) {
        alert("Syncing is currently disabled (Offline Mode). Please check .env configuration.");
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
