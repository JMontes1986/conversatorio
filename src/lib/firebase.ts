import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore, initializeFirestore, memoryLocalCache } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  "projectId": "conversatorio-colgemelli",
  "appId": "1:905779822024:web:a81d6bf600238ae9cc54fd",
  "storageBucket": "conversatorio-colgemelli.firebasestorage.app",
  "apiKey": "AIzaSyCjQ_jv7wNeP62iNz0VuTKoumwZ0YRlAuY",
  "authDomain": "conversatorio-colgemelli.firebaseapp.com",
  "messagingSenderId": "905779822024"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with offline persistence
const db = initializeFirestore(app, {
  localCache: memoryLocalCache()
});

const auth = getAuth(app);


export { app, db, auth };
