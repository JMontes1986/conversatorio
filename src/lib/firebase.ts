import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  "projectId": "conversatorio-colgemelli",
  "appId": "1:905779822024:web:a81d6bf600238ae9cc54fd",
  "storageBucket": "conversatorio-colgemelli.firebasestorage.app",
  "apiKey": "AIzaSyCjQ_jv7wNeP62iNz0VuTKoumwZ0YRlAuY",
  "authDomain": "conversatorio-colgemelli.firebaseapp.com",
  "messagingSenderId": "905779822024"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
