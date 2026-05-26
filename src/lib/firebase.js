// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAE4AbZzE_DGX2CHufQrsduls7PKqdnoqo",
  authDomain: "slimcare-ultra.firebaseapp.com",
  projectId: "slimcare-ultra",
  storageBucket: "slimcare-ultra.firebasestorage.app",
  messagingSenderId: "313819658502",
  appId: "1:313819658502:web:802574991e786cb8318687",
  measurementId: "G-3TX7NXB45H"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
