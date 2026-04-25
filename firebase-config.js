import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBixSGdlKiomeZpAlpIuZ3Jzb0RoWbsrlI",
  authDomain: "tee-shirt-34f57.firebaseapp.com",
  projectId: "tee-shirt-34f57",
  storageBucket: "tee-shirt-34f57.firebasestorage.app",
  messagingSenderId: "1048371686884",
  appId: "1:1048371686884:web:85b2c96d9e879bccf4abf1",
  measurementId: "G-6ERPD0DVVB"
};

const ADMIN_EMAILS = [
  "fchristian416@gmail.com"
];

let db = null;
let auth = null;
let firebaseReady = false;
try {
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  firebaseReady = true;
} catch (error) {
  console.warn("Firebase init failed. Local mode will be used.", error);
}

export { db, auth, firebaseReady, ADMIN_EMAILS };
