// Firebase configuration - replace with your actual Firebase config
// Get this from: Firebase Console > Project Settings > Your apps > Web app
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyDpYY35UHZHKsT7xIXJErT3OcvDxJ0uIvs",
  authDomain: "studygenie-3932a.firebaseapp.com",
  projectId: "studygenie-3932a",
  storageBucket: "studygenie-3932a.firebasestorage.app",
  messagingSenderId: "958208923632",
  appId: "1:958208923632:web:ece8cd2efcd1812538af35",
  measurementId: "G-FE0NDG9Z36"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Analytics conditionally to avoid SSR issues if ever used
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}
export { analytics };
