// Firebase 初期化
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import {
  getAuth,
  signInWithCustomToken,
} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyC7bYnZ2F70SuKGZ72Dd24ag2MVH9rBXk4',
  authDomain: 'streak-navi.firebaseapp.com',
  projectId: 'streak-navi',
  storageBucket: 'streak-navi.appspot.com',
  messagingSenderId: '1095960567149',
  appId: '1:1095960567149:web:4b7061d633cdbdd7318e64',
  measurementId: 'G-RVYQBWT924',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
export { app, auth, signInWithCustomToken };

// Firestore
import {
  getFirestore,
  query,
  orderBy,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  setDoc,
  deleteDoc,
  collection,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
const db = getFirestore();
export {
  db,
  doc,
  query,
  orderBy,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  setDoc,
  deleteDoc,
  collection,
  serverTimestamp,
};

// ダイアログ関連
import { showDialog } from '../dialog/dialog.js';
export { showDialog };

// グローバル定数
export const globalAppName = 'streakNavi';
export const globalClientId = '2007808275';
export const globalBaseUrl = window.location.origin;
export const globalStrTrue = 'true';
export const globalStrFalse = 'false';
export const globalStrUnset = '99';
export const globalAuthServer =
  'https://streak-navi-auth-server-production.up.railway.app/line-login';

// GETパラメータたち
export const globalGetparams = new URLSearchParams(window.location.search);
export const globalGetParamCode = globalGetparams.get('code');
export const globalGetParamState = globalGetparams.get('state');
export const globalGetParamError = globalGetparams.get('error');
export const globalGetParamUid = globalGetparams.get('uid');
export const globalGetParamIsInit = globalGetparams.get('isInit');
export const globalGetParamFromLogin = globalGetparams.get('fromLogin');
export const globalGetParamMode = globalGetparams.get('mode');
export const globalGetParamVoteId = globalGetparams.get('voteId');

// 画面名
export const globalScreenName = document.title || 'Streak Navi';

// データをセッションストレージからクリアする関数
export function removeSession(key) {
  sessionStorage.removeItem(globalAppName + '.' + key);
}

// データをセッションストレージから全削除する関数
export function clearAllAppSession() {
  const prefix = globalAppName + '.';
  const keysToRemove = [];

  // 対象キーを先に抽出（直接ループ中に削除するとバグになる）
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }

  // 抽出したキーを一括削除
  keysToRemove.forEach((key) => sessionStorage.removeItem(key));
}

// データをセッションストレージにセットする関数
export function setSession(key, value) {
  sessionStorage.setItem(globalAppName + '.' + key, value);
}

// セッションストレージからデータをゲットする関数
export function getSession(key) {
  return sessionStorage.getItem(globalAppName + '.' + key);
}

// セッションストレージから配列を取得(nullは空に)
export function getSessionArray(key) {
  return JSON.parse(sessionStorage.getItem(globalAppName + '.' + key)) ?? [];
}

// セッションストレージに配列設定(nullは空に)
export function setSessionArray(key, array) {
  sessionStorage.setItem(
    globalAppName + '.' + key,
    JSON.stringify(array ?? [])
  );
}

export function scrollToTop() {
  // 一番上にスクロール
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  });
}

// HTML読み込み
export async function loadComponent(
  target,
  isCss = true,
  isHTML = true,
  isJs = true
) {
  const basePath = '../' + target + '/' + target;

  // 1. CSS読み込み
  if (isCss) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = basePath + '.css';
    document.head.appendChild(link);
  }

  // 2. HTML読み込み
  if (isHTML) {
    try {
      const res = await fetch(basePath + '.html');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      document.getElementById(target + '-placeholder').innerHTML = html;
    } catch (err) {
      console.error(`Error loading ${basePath}.html:`, err);
    }
  }

  // 3. JS読み込み
  if (isJs) {
    const script = document.createElement('script');
    script.src = basePath + '.js';
    script.type = 'module';
    script.defer = true; // 必須ではないがHTML後に実行させるなら
    document.body.appendChild(script);
  }
}

// 画面共通初期処理
export async function initDisplay(isShowSpinner = true) {
  if (isShowSpinner) {
    // スピナー表示
    showSpinner();
  }

  // 不正遷移チェック
  if (!getSession('uid')) {
    // ログインページへ遷移
    window.location.href = window.location.origin;
  }

  // アカウント存在チェック
  const userRef = doc(db, 'users', getSession('uid'));
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    // ログインページへ遷移
    window.location.href = window.location.origin;
  }

  // ログイン済みチェック
  const user = auth.currentUser;
  if (!user) {
    // ログインページへ遷移
    window.location.href = window.location.origin;
  }

  // コンポーネント読み込み(終了を待つため非同期)
  await loadComponent('header');
  await loadComponent('footer');
  await loadComponent('dialog');

  // セッションにあるユーザ情報を更新
  for (const [key, value] of Object.entries(userSnap.data())) {
    setSession(key, value);
  }
}

// スピナー表示処理
export async function showSpinner() {
  if ($('#spinner-overlay').length === 0) {
    // スピナー用のタグがない場合追加
    $('body').append(`
      <div id="spinner-overlay">
        <div class="spinner"></div>
      </div>
    `);
  }
  $('#spinner-overlay').show();
}

// スピナー非表示処理
export async function hideSpinner() {
  $('#spinner-overlay')?.hide();
}

// 日付フォーマット関数
export function formatDateTime(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : ts;
  return date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
}

// ログ
export async function writeLog({
  dataId,
  action,
  status = 'success',
  errorDetail = {},
}) {
  try {
    const uid = getSession('uid') || 'unknown';
    const id = `${formatDateForId()}_${uid}`; // ← ここで使う

    await setDoc(doc(db, 'logs', id), {
      uid,
      screen: globalScreenName,
      action,
      dataId,
      status, // "success" or "error"
      errorDetail,
      createdAt: serverTimestamp(), // Firestoreサーバ時刻
    });
    // エラーの場合
    if (status === 'error') {
      errorHandler(errorDetail.message || 'Unknown error');
    }
  } catch (e) {
    errorHandler(e.message || 'Unknown error');
  }
}

// エラーハンドラ
export function errorHandler(error) {
  // スピナー非表示
  hideSpinner();
  console.error('Error:', error);
  if (
    confirm(
      `エラーが発生しました: ${error.message}\nログイン画面に戻りますか？`
    )
  ) {
    // ログインページへ遷移
    window.location.href = window.location.origin;
  }
}

// 日時を "yyyyMMdd_HHmmss" に整形する関数
function formatDateForId(date = new Date()) {
  const pad = (n) => n.toString().padStart(2, '0');
  return (
    date.getFullYear().toString() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    '_' +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}
