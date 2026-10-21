// Auth utility - handles Google + Email sign-in, session state, Firestore user data
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';

// ===== AUTH FUNCTIONS =====

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  await ensureUserDoc(result.user);
  return result.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signUpWithEmail(email: string, password: string, displayName: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(result.user, { displayName });
  await ensureUserDoc(result.user);
  return result.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
  localStorage.removeItem('sg_auth');
  sessionStorage.removeItem('sg_current_text');
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

// ===== USER DOCUMENT =====

async function ensureUserDoc(user: User): Promise<void> {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: user.email,
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      plan: 'free',
      dailyUses: 0,
      lastUseDate: '',
      totalUses: 0,
      createdAt: serverTimestamp(),
    });
  }
}

// ===== USAGE TRACKING (Firestore-backed for logged-in users) =====

export async function checkAndIncrementUsage(user: User): Promise<{ allowed: boolean; remaining: number }> {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  const data = snap.data() || {};
  const today = new Date().toISOString().split('T')[0];
  const maxFree = 10; // logged-in users get 10/day vs 5 for anonymous

  let dailyUses = data.dailyUses || 0;
  if (data.lastUseDate !== today) {
    dailyUses = 0; // reset for new day
  }

  if (data.plan === 'pro') {
    // Pro users: unlimited
    await updateDoc(ref, { dailyUses: dailyUses + 1, lastUseDate: today, totalUses: increment(1) });
    return { allowed: true, remaining: 999 };
  }

  if (dailyUses >= maxFree) {
    return { allowed: false, remaining: 0 };
  }

  await updateDoc(ref, { dailyUses: dailyUses + 1, lastUseDate: today, totalUses: increment(1) });
  return { allowed: true, remaining: maxFree - dailyUses - 1 };
}

// ===== SAVE STUDY HISTORY =====

export interface StudyItem {
  type: 'summary' | 'flashcards' | 'quiz' | 'explain' | 'youtube' | 'math' | 'essay' | 'planner' | 'notes';
  title: string;
  input: string;
  output: string; // JSON stringified result
  createdAt?: any;
}

export async function saveStudyItem(user: User, item: StudyItem): Promise<string> {
  const ref = collection(db, 'users', user.uid, 'history');
  const docRef = await addDoc(ref, {
    ...item,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getStudyHistory(user: User, limitCount: number = 20): Promise<(StudyItem & { id: string })[]> {
  const ref = collection(db, 'users', user.uid, 'history');
  const q = query(ref, orderBy('createdAt', 'desc'), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as StudyItem & { id: string }));
}

export async function getStudyHistoryByType(user: User, type: string, limitCount: number = 20): Promise<(StudyItem & { id: string })[]> {
  const ref = collection(db, 'users', user.uid, 'history');
  const q = query(ref, where('type', '==', type), orderBy('createdAt', 'desc'), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as StudyItem & { id: string }));
}

// ===== USER STATS =====

export async function getUserStats(user: User): Promise<{ plan: string; totalUses: number; dailyUses: number; lastUseDate: string }> {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  const data = snap.data() || {};
  return {
    plan: data.plan || 'free',
    totalUses: data.totalUses || 0,
    dailyUses: data.dailyUses || 0,
    lastUseDate: data.lastUseDate || '',
  };
}
