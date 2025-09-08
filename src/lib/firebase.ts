import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

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

// Enable offline persistence
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled
      // in one tab at a time.
      // ...
      console.warn("Firestore persistence failed: multiple tabs open.");
    } else if (err.code == 'unimplemented') {
      // The current browser does not support all of the
      // features required to enable persistence
      // ...
      console.warn("Firestore persistence not supported in this browser.");
    }
  });


export { app, db };
