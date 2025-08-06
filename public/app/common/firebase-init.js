// firebase-init.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
// 必要に応じて他のSDKも import する（例：firestoreなど）

const firebaseConfig = {
  apiKey: 'AIzaSyC7bYnZ2F70SuKGZ72Dd24ag2MVH9rBXk4',
  authDomain: 'streak-navi.firebaseapp.com',
  projectId: 'streak-navi',
  storageBucket: 'streak-navi.appspot.com',
  messagingSenderId: '1095960567149',
  appId: '1:1095960567149:web:4b7061d633cdbdd7318e64',
  measurementId: 'G-RVYQBWT924',
};

// Firebase 初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth };
