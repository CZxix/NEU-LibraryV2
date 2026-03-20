// Firebase SDK Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Your Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyA2WydbqSvVQXBipTn8bJqf9KSG2Xc0MVg",
  authDomain: "neu-libraryv2-7000e.firebaseapp.com",
  projectId: "neu-libraryv2-7000e",
  storageBucket: "neu-libraryv2-7000e.firebasestorage.app",
  messagingSenderId: "257078874992",
  appId: "1:257078874992:web:307ae7376002f22ee235b5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Restrict Google Sign-In to NEU accounts only
googleProvider.setCustomParameters({
  hd: "neu.edu.ph"
});

export { auth, db, googleProvider };