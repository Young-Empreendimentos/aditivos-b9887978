import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD_y6Uiw-mbEQSprvYsa6HdKIyUDCjzW8k",
  authDomain: "gerador-aditivos.firebaseapp.com",
  projectId: "gerador-aditivos",
  storageBucket: "gerador-aditivos.firebasestorage.app",
  messagingSenderId: "953906982320",
  appId: "1:953906982320:web:5b4a75f76f5eb6992fba75",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
