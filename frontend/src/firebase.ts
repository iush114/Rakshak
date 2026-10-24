import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, GithubAuthProvider, type Auth } from 'firebase/auth';

/**
 * Firebase Client Configuration
 * Uses Vite environment variables for public client configuration.
 * Project ID: rakshak-auth
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAH61j9q9mNvV59ZE6xWVVupJqRFTcFK4o',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'rakshak-auth.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'rakshak-auth',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'rakshak-auth.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '822010235777',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:822010235777:web:799e42307656f26b35f680',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-MVEX9357QC',
};

// Singleton initialization
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Auth instance
export const auth: Auth = getAuth(app);

// Google Auth Provider
export const googleProvider: GoogleAuthProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// GitHub Auth Provider
export const githubProvider: GithubAuthProvider = new GithubAuthProvider();
githubProvider.addScope('read:user');
githubProvider.addScope('user:email');
githubProvider.addScope('repo');

export default app;
