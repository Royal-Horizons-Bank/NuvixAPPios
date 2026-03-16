// src/config/firebase.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your existing Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyB6_Gfp0C2fG9g7aOJEVr1O7opIJhDbkUA",
    authDomain: "nuvix-plus-social.firebaseapp.com",
    projectId: "nuvix-plus-social",
    storageBucket: "nuvix-plus-social.firebasestorage.app",
    messagingSenderId: "253522454193",
    appId: "1:253522454193:web:8b2e9e0f69f5fda21d6490"
};

// Initialize Firebase
// We check if an app is already initialized to prevent errors during React Native hot-reloading
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with AsyncStorage for persistence in React Native
const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
});

const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };