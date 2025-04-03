import { FirebaseOptions } from "firebase/app";

// Firebase configuration - would be replaced with environment variables in production
export const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyC_UNXXoXMTKSHYvscImzjnLX_caRaq3fE",
  authDomain: "chess-wager-mvp.firebaseapp.com",
  projectId: "chess-wager-mvp",
  storageBucket: "chess-wager-mvp.appspot.com",
  messagingSenderId: "1024609648141",
  appId: "1:1024609648141:web:c1b360f32008eb7fe11f44",
  measurementId: "G-X6H6E8ZCX4"
};

// Razorpay API Key - would be replaced with environment variables in production
export const razorpayConfig = {
  key: "rzp_test_KbdfYshEMu83sH"
};

/**
 * IMPORTANT: For production deployment
 * 
 * 1. Create a .env file at the project root with the following variables:
 *    VITE_FIREBASE_API_KEY=your-api-key
 *    VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
 *    VITE_FIREBASE_PROJECT_ID=your-project-id
 *    VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
 *    VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
 *    VITE_FIREBASE_APP_ID=your-app-id
 *    VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
 *    VITE_RAZORPAY_KEY_ID=your-razorpay-key-id
 * 
 * 2. In a production environment, use a secure service like Firebase Config/Secrets 
 *    or your deployment platform's environment variable system to store these values.
 *    DO NOT commit the .env file to version control.
 * 
 * 3. To implement environment variables with Vite, modify this file to:
 *    - Replace the hardcoded values with import.meta.env.VITE_VARIABLE_NAME
 *    - Add TypeScript definitions for the environment variables
 */ 