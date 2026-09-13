import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, setDoc, query, where, getDocs, onSnapshot, serverTimestamp, getDocFromServer, getDoc } from 'firebase/firestore';

// @ts-ignore
import firebaseConfigData from '../../firebase-applet-config.json';

const firebaseConfig = firebaseConfigData || {};

const app = initializeApp(firebaseConfig);
// @ts-ignore
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || 'default');
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signIn = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

// Helper for connection test
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

export { 
  collection, addDoc, updateDoc, deleteDoc, doc, setDoc, query, where, getDocs, onSnapshot, serverTimestamp, getDoc
};
