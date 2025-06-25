import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider, getToken } from "firebase/app-check";
import { getAnalytics, setAnalyticsCollectionEnabled } from "firebase/analytics";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};


const firebaseApp = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);

// Initialize Firebase Analytics
const analytics = getAnalytics(firebaseApp);
// Enable analytics collection
setAnalyticsCollectionEnabled(analytics, true);

// Enable App Check debug token in all development environments
if (import.meta.env.DEV && location.hostname === 'localhost') {
  // Set debug token for App Check in development
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  console.log('🐛 App Check debug mode enabled for localhost development');
}

// Connect to emulators only when explicitly requested
if (import.meta.env.VITE_USE_EMULATOR === 'true' && location.hostname === 'localhost') {
  console.log('🔧 Connecting to Firebase emulators...');
  
  // Connect to emulators (safe approach)
  try {
    connectAuthEmulator(auth, 'http://localhost:9099');
    console.log('✅ Connected to Auth emulator');
  } catch (error) {
    // Already connected or emulator not running - ignore
    console.log('Auth emulator connection info:', error.message);
  }
  
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log('✅ Connected to Firestore emulator');
  } catch (error) {
    // Already connected or emulator not running - ignore
    console.log('Firestore emulator connection info:', error.message);
  }
} else if (import.meta.env.DEV) {
  console.log('🌐 Using production Firebase services');
}

const appCheck = initializeAppCheck(firebaseApp, {
   provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
   isTokenAutoRefreshEnabled: true
});



getToken(appCheck)
  .then((result) => {

  })
  .catch((error) => {
    console.warn('AppCheck token error (this is usually non-critical):', error.message);
    // AppCheck errors are usually non-critical and don't prevent app functionality
  })

export { firebaseApp, appCheck, analytics };
