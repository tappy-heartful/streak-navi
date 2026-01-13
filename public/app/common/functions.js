// Firebase 初期化
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getAuth,
  signInWithCustomToken,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyC7bYnZ2F70SuKGZ72Dd24ag2MVH9rBXk4',
  authDomain: 'streak-navi.firebaseapp.com',
  projectId: 'streak-navi',
  storageBucket: 'streak-navi.firebasestorage.app',
  messagingSenderId: '1095960567149',
  appId: '1:1095960567149:web:4b7061d633cdbdd7318e64',
  measurementId: 'G-RVYQBWT924',
};

// 1. Appの初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Firestore のインポート
import {
  getFirestore,
  query,
  where,
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
  limit,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Storage のインポート (バージョンを10.7.1に統一)
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// 2. 各サービスの初期化（必ず app を引数に入れる）
const db = getFirestore(app);
const storage = getStorage(app, 'streak-navi.firebasestorage.app');

// エクスポート
export {
  app,
  auth,
  signInWithCustomToken,
  db,
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
  doc,
  query,
  where,
  orderBy,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  setDoc,
  deleteDoc,
  collection,
  serverTimestamp,
  limit,
  writeBatch,
  deleteObject,
};

// ダイアログ関連
import { showDialog } from '../dialog/dialog.js';
export { showDialog };

// モーダル関連
import { showModal } from '../modal/modal.js';
export { showModal };

// グローバル定数
export const isTest = location.hostname.includes('streak-navi-test');
export const globalAppName = isTest ? 'streakNaviTest' : 'streakNavi';
export const globalClientId = '2007808275';
export const globalBaseUrl = window.location.origin;
export const globalStrTrue = 'true';
export const globalLineDefaultImage = '../../images/line-profile-unset.png';
export const globalBandLogoImage = '../../images/favicon.png';
export const globalAuthServerRailway =
  'https://streak-navi-auth-server-production.up.railway.app'; // railwayの認証サーバーURL
export const globalAuthServerRender =
  'https://streak-navi-auth-server-kz3v.onrender.com'; // 新しい Render の認証サーバーURL
export const globalSessionExpireMinutes = 120;

// GETパラメータたち
export const globalGetparams = new URLSearchParams(window.location.search);
export const globalGetParamCode = globalGetparams.get('code');
export const globalGetParamState = globalGetparams.get('state');
export const globalGetParamError = globalGetparams.get('error');
export const globalGetParamUid = globalGetparams.get('uid');
export const globalGetParamIsInit = globalGetparams.get('isInit');
export const globalGetParamMode = globalGetparams.get('mode');
export const globalGetParamScoreId = globalGetparams.get('scoreId');
export const globalGetParamEventId = globalGetparams.get('eventId');
export const globalGetParamVoteId = globalGetparams.get('voteId');
export const globalGetParamMediaId = globalGetparams.get('mediaId');
export const globalGetParamCallId = globalGetparams.get('callId');
export const globalGetParamStudioId = globalGetparams.get('studioId');
export const globalGetParamCollectId = globalGetparams.get('collectId');
export const globalGetParamBoardId = globalGetparams.get('boardId');
export const globalGetParamType = globalGetparams.get('type');

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

// 権限チェック(システム管理者は無条件にOK)
export function isAdmin(type) {
  return (
    getSession('isSystemAdmin') === globalStrTrue ||
    getSession('is' + type + 'Admin') === globalStrTrue
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
// 画面共通初期処理 (セキュリティと継続ログインを考慮した完全版)
export async function initDisplay(isShowSpinner = true) {
  if (isShowSpinner) {
    // スピナー表示
    showSpinner();
  }

  // --- 1. Firebase Auth の認証状態が確立されるのを待つ --- // セッションが有効であれば、認証済みユーザー (user) が返される
  const user = await new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe(); // 購読を解除
      resolve(user);
    });
  });

  // --- 2. 認証チェック ---
  if (!user) {
    // 認証情報がない、またはセッションが完全に期限切れの場合
    // ログイン画面への遷移ではない場合、ログイン後にその画面へ遷移するためのリダイレクト先を保存
    if (!window.location.href.includes('app/login/login.html')) {
      localStorage.setItem('redirectAfterLogin', window.location.href);
    }
    // ログインページへ遷移
    window.location.href = window.location.origin;
  }

  // --- 3. アカウント存在チェック (Firestore) --- // 認証された user.uid を使用
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getWrapDoc(userRef);
  if (!userSnap.exists()) {
    // Firebase Authにはユーザーがいるが、Firestoreからデータが削除されている場合
    // セッションもクリアし、ログインページへ遷移させる
    await auth.signOut(); // Firebase Authからもサインアウト
    clearAllAppSession();
    window.location.href = window.location.origin;
    hideSpinner();
    return; // 処理を中断
  }
  // --- 4. ユーザー情報をセッション (カスタムデータ) に更新 --- // Firebase Authのセッションとは別に、アプリ固有のユーザーデータを最新化
  for (const [key, value] of Object.entries(userSnap.data())) {
    setSession(key, value);
  }
  // 継続ログインの場合uidだけはセットされていないので、ここでセット
  setSession('uid', user.uid);

  // --- 5. 編集画面の権限チェックとリダイレクト
  const path = window.location.pathname;

  // 権限チェックが必要なモジュール名のリスト
  const modules = [
    'call',
    'event',
    'media',
    'notice',
    'score',
    'studio',
    'vote',
  ];

  for (const moduleName of modules) {
    // 編集画面初期表示時にチェック
    if (path.includes(modules) && path.includes('edit')) {
      const adminKey = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
      // 編集画面にいて、かつ対応するAdmin権限を持っていない場合
      if (!isAdmin(adminKey)) {
        // 一覧画面へリダイレクト
        alert('この画面を表示する権限がありません。一覧画面に遷移します。');
        const listPath = `../${moduleName}-list/${moduleName}-list.html`;
        window.location.replace(listPath);
        return;
      }
      // 権限がある場合は、他の画面チェックをせずにループを終了
      break;
    }
  }

  // // --- 6. コンポーネント読み込み ---
  await loadComponent('header');
  await loadComponent('footer');
  await loadComponent('dialog');
  await loadComponent('modal');

  // ウェルカム演出
  renderWelcomeOverlay();
}

// パンくずリスト取得
export function renderBreadcrumb(crumbs) {
  if (!crumbs || !crumbs.length) return;

  const $container = $('#breadcrumb-container');
  if ($container.length === 0) return;

  $container.empty();

  // <nav class="breadcrumb"> でラップ
  const $nav = $('<nav class="breadcrumb"></nav>');

  // 先頭にはホーム
  $nav.append(
    `<a href="../home/home.html"><i class="fa fa-home"></i> ホーム</a>`
  );

  crumbs.forEach((c, idx) => {
    // セパレーター
    $nav.append('<span class="separator">›</span>');

    const isLast = idx === crumbs.length - 1;

    if (isLast) {
      // 現在ページ
      $nav.append(`<span class="current">${c.title}</span>`);
    } else {
      // 中間リンク
      $nav.append(`<a href="${c.url}">${c.title}</a>`);
    }
  });

  $container.append($nav);
}

// ウェルカムオーバーレイ表示
function renderWelcomeOverlay() {
  // 挨拶メッセージを取得する関数
  function getGreetingMessage() {
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 5 && hour < 11) return 'おはようございます☀️';
    if (hour >= 11 && hour < 17) return 'こんにちは🎵';
    return 'こんばんは🌙';
  }
  const fromLogin = getSession('fromLogin') === 'true';
  const isInit = getSession('isInit') === 'true';

  // 初回遷移時ウェルカム演出
  if (fromLogin || isInit) {
    const lineIconPath = getSession('pictureUrl_decoded');
    const lineAccountName = getSession('displayName_decoded');

    $('#welcome-line-icon').attr('src', lineIconPath);
    $('#welcome-line-name').text(lineAccountName);

    // 挨拶メッセージ
    const greetingMessage = isInit ? 'ようこそ🌸' : getGreetingMessage();
    $('#greeting-message').text(greetingMessage);

    const $overlay = $('#first-login-overlay');
    $overlay.removeClass('hidden');
    // 表示
    setTimeout(() => {
      $overlay.addClass('show');
    }, 10); // 少し遅延させてCSS transitionを確実に動かす

    // 1.5秒表示 → フェードアウト（0.5秒）
    setTimeout(() => {
      $overlay.removeClass('show');
      // 完全に非表示に
      setTimeout(() => {
        $overlay.addClass('hidden');
      }, 500);
    }, 2000);

    // フラグクリア
    removeSession('fromLogin');
    removeSession('isInit');
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

/**
 * DateオブジェクトまたはFirestoreのTimestampオブジェクトを
 * 指定されたフォーマットの文字列に変換します。
 * (※ここでは 'yyyy.MM.dd' のみに対応するシンプルな実装例です)
 * * @param {Date | firebase.firestore.Timestamp} dateOrTimestamp - 変換する日付/タイムスタンプオブジェクト
 * @param {string} formatString - 日付のフォーマット文字列 (例: 'yyyy.MM.dd')
 * @returns {string} フォーマットされた日付文字列
 */
export function format(dateOrTimestamp, formatString = 'yyyy.MM.dd') {
  let date;

  // 1. 引数がTimestamp型かどうかをチェックし、Dateオブジェクトに変換
  if (dateOrTimestamp && typeof dateOrTimestamp.toDate === 'function') {
    date = dateOrTimestamp.toDate();
  } else if (dateOrTimestamp instanceof Date) {
    date = dateOrTimestamp;
  } else {
    // 不正な値が渡された場合は空文字列を返すか、エラー処理を行う
    return '';
  }

  // 2. フォーマット文字列に基づいた処理 (ここでは 'yyyy.MM.dd' のみを想定)
  if (formatString === 'yyyy.MM.dd') {
    const year = date.getFullYear();
    // getMonth() は 0 から始まるため、+1 する
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}.${month}.${day}`;
  }

  // その他のフォーマット（例: yyyy/MM/dd HH:mm）に対応する場合は、ここにロジックを追加

  return ''; // 対応しないフォーマットの場合は空文字列を返す
}

/**
 * 'yyyy.MM.dd' 形式の文字列を Date オブジェクトに変換します。
 * * @param {string} dateString - 'yyyy.MM.dd' 形式の日付文字列
 * @returns {Date | null} 変換された Date オブジェクト。形式が不正な場合は null
 */
export function parseDate(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }

  // yyyy.MM.dd 形式を想定して、. で分割し、数値に変換
  const parts = dateString.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  // 数値として有効か、範囲が適切かを確認
  if (
    isNaN(year) ||
    isNaN(month) ||
    isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  // monthは0から始まるため、-1する
  const date = new Date(year, month - 1, day);

  // Dateオブジェクトが有効な日付を表しているか、および入力と一致するか確認
  if (
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return null; // 例えば 2月30日などの不正な日付
  }

  return date;
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

    await setDoc(doc(db, status === 'success' ? 'logs' : 'errorLogs', id), {
      uid,
      screen: globalScreenName,
      action,
      dataId,
      status, // "success" or "error"
      errorDetail,
      createdAt: serverTimestamp(), // Firestoreサーバ時刻
    });
    // 正常ではない場合
    if (status !== 'success') {
      errorHandler(errorDetail.message || 'Unknown error');
    }
  } catch (e) {
    errorHandler(e.message || 'Unknown error');
  }
}

// エラーハンドラ
export function errorHandler(errorMessage) {
  // スピナー非表示
  hideSpinner();
  console.error('Error:', errorMessage);
  if (
    confirm(`エラーが発生しました: ${errorMessage}\nログイン画面に戻りますか？`)
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

// YouTube埋め込みモーダルのHTMLを生成する関数
export function buildYouTubeHtml(
  youtubeInput,
  showNotice = false,
  showLink = true
) {
  if (!youtubeInput) return '';

  // youtubeInput が配列かどうかチェック
  const isArray = Array.isArray(youtubeInput);

  let videoIds = [];

  if (isArray) {
    videoIds = youtubeInput
      .map(extractYouTubeId)
      .filter((id) => /^[\w-]{11}$/.test(id));
  } else {
    const singleId = extractYouTubeId(youtubeInput);
    if (/^[\w-]{11}$/.test(singleId)) {
      videoIds = [singleId];
    } else {
      console.warn('YouTube動画IDとして不正です:', singleId);
      return '';
    }
  }

  if (videoIds.length === 0) return '';

  // 埋め込み用 → 最初の動画を表示
  const embedId = videoIds[0];

  // 「YouTubeでみる」リンク
  const youtubeLink = isArray
    ? `https://www.youtube.com/watch_videos?video_ids=${videoIds.join(',')}`
    : `https://www.youtube.com/watch?v=${embedId}`;

  return `
    <div class="youtube-embed">
      <iframe
        src="https://www.youtube.com/embed/${embedId}?loop=1&playlist=${embedId}"
        allow="encrypted-media"
        allowfullscreen>
      </iframe>
    </div>
    <div class="youtube-link-container">
      ${
        showNotice
          ? `<span class="youtube-notice">🔒バンド内限定公開</span>`
          : ''
      }
      ${
        showLink
          ? `<a href="${youtubeLink}" target="_blank">
              ${isArray ? 'プレイリストを聴く' : 'YouTubeでみる'}
              <i class="fas fa-arrow-up-right-from-square"></i>
            </a>`
          : ''
      }
    </div>`;
}

/**
 * Instagram埋め込みHTMLを生成
 * @param {string} url - Instagramの投稿URL
 * @param {boolean} includeWrapper - trueなら外枠<div>も含める
 * @returns {string} HTML文字列
 */
export function buildInstagramHtml(url, includeWrapper = true) {
  if (!url) return '';

  const instaUrl = url.split('?')[0];

  const html = `<blockquote class="instagram-media" data-instgrm-permalink="${instaUrl}" data-instgrm-version="14"></blockquote>`;

  return includeWrapper ? `<div class="instagram-embed">${html}</div>` : html;
}

// Google Drive埋め込みHTMLを生成
export function buildGoogleDriveHtml(driveUrl, showNotice = false) {
  if (!driveUrl) return '';

  const match = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return '';

  const fileId = match[1];
  const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;

  return `
    <div class="drive-embed-wrapper">
      <div class="drive-embed">
        <iframe src="${embedUrl}" allow="autoplay; encrypted-media" allowfullscreen></iframe>
      </div>
      ${showNotice ? `<div class="drive-notice">🔒バンド内限定公開</div>` : ''}
    </div>
  `;
}
/**
 * yyyy.mm.dd 形式に変換
 * Date型、または日付として認識可能な文字列に対応
 */
export function formatDateToYMDDot(dateInput) {
  if (!dateInput) return '';

  // Dateオブジェクトでない場合はDateに変換を試みる
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  if (isNaN(date.getTime())) return '';

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

/**
 * yyyy-mm-dd 形式に変換 (input type="date" 用)
 * Date型、または yyyy.mm.dd / yyyy-mm-dd 形式の文字列に対応
 */
export function formatDateToYMDHyphen(dateInput) {
  if (!dateInput) return '';

  let date;
  if (dateInput instanceof Date) {
    date = dateInput;
  } else if (typeof dateInput === 'string' && dateInput.includes('.')) {
    // yyyy.mm.dd 形式を yyyy/mm/dd に置換してからパース（ブラウザ互換性のため）
    date = new Date(dateInput.replace(/\./g, '/'));
  } else {
    date = new Date(dateInput);
  }

  if (isNaN(date.getTime())) return '';

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function isInTerm(startDateStr, endDateStr) {
  const now = Date.now(); // 現在時刻（ミリ秒）
  return (
    (!startDateStr ||
      now >=
        new Date(
          formatDateToYMDHyphen(startDateStr) + 'T00:00:00'
        ).getTime()) &&
    (!endDateStr ||
      now <=
        new Date(formatDateToYMDHyphen(endDateStr) + 'T23:59:59').getTime())
  );
}

/**
 * ランダムなユニークIDを生成する関数
 * @param {string} prefix - 先頭に付与する文字列（省略可）
 * @returns {string} 例: "song-abc123xyz"
 */
export function generateId(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

//==================================
// 一意なIDを生成するヘルパー関数
//==================================
/**
 * 現在のタイムスタンプとランダムな文字列を組み合わせて一意なIDを生成します。
 * @returns {string} 一意なID文字列
 */
export function generateUniqueId() {
  const timestamp = new Date().getTime(); // 現在のタイムスタンプ
  // 16進数のランダムな8桁の文字列
  const random = Math.random().toString(16).substring(2, 10);

  // タイムスタンプとランダムな文字列を結合
  return 'id_' + timestamp + '_' + random;
}

export function extractYouTubeId(input) {
  try {
    const url = new URL(input);
    return url.searchParams.get('v') || url.pathname.split('/').pop();
  } catch {
    return input; // URLでなければそのまま
  }
}

//===========================
// ランダムインデックス取得
//===========================
export function getRandomIndex(exclude, arrayLength) {
  let idx;
  do {
    idx = Math.floor(Math.random() * arrayLength);
  } while (idx === exclude && arrayLength > 1);
  return idx;
}

//===========================
// youtube視聴順取得
//===========================
export function getWatchVideosOrder(currentIndex, blueNotes) {
  // 今のインデックスから最後まで
  const after = blueNotes.slice(currentIndex).map((n) => n.youtubeId_decoded);
  // 先頭から今のインデックス直前まで
  const before = blueNotes
    .slice(0, currentIndex)
    .map((n) => n.youtubeId_decoded);
  // 連結
  return [...after, ...before];
}

// ** 曜日を取得するヘルパー関数 (event-adjust-answer.js から再利用) **
export function getDayOfWeek(dateStr, isOnlyDayOfWeek = false) {
  // dateStrは "YYYY.MM.DD" 形式を想定
  try {
    const parts = dateStr.split('.').map(Number);
    // 月は0から始まるため -1 する
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const dayOfWeek = days[date.getDay()];
    return isOnlyDayOfWeek ? dayOfWeek : `${dateStr}(${dayOfWeek})`;
  } catch (e) {
    return ''; // パースエラー時は空文字
  }
}
// URL チェック用関数
export const isValidURL = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

//===========================
// エラー表示ユーティリティ
//===========================
export function clearErrors() {
  $('.error-message').remove();
  $('.error-field').removeClass('error-field');
}
export function markError($field, message) {
  $field
    .after(`<div class="error-message">${message}</div>`)
    .addClass('error-field');
}

//===========================
// XSS対策ユーティリティ
//===========================

/**
 * 文字列内のHTML特殊文字をエスケープする（データの安全な保存/取得用）
 * @param {string} str - サニタイズ対象の文字列
 * @returns {string} エスケープされた文字列
 */
function sanitizeString(str) {
  if (typeof str !== 'string') {
    return str;
  }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * オブジェクトを再帰的に走査し、すべての文字列値をサニタイズし、
 * さらに '_decoded' プロパティにデコード済みの値を追加する
 * @param {Object} obj - ドキュメントデータオブジェクト
 * @returns {Object} サニタイズされたデータオブジェクト
 */
function sanitizeObject(obj) {
  if (obj === null || typeof obj !== 'object') {
    // プリミティブな値はエスケープして返す
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // 1. 再帰的にサニタイズ（エスケープ）された値を取得
      const escapedValue = sanitizeObject(obj[key]);

      // 2. オリジナルのキーにエスケープされた値を設定
      sanitized[key] = escapedValue;

      // 3. 文字列の場合、デコード処理を実行し、'_decoded' キーで追加
      if (typeof escapedValue === 'string') {
        const decodedValue = escapedValue
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&');

        sanitized[key + '_decoded'] = decodedValue;
      }
    }
  }
  return sanitized;
}

//===========================
// Firestoreラッパー関数の修正
//===========================

/**
 * XSS対策付きの getDocs (Collection) ラッパー関数
 * @param {Query} q - Firestoreクエリ
 * @returns {Promise<QuerySnapshot>}
 */
export async function getWrapDocs(q) {
  const snapshot = await getDocs(q);

  // スナップショットの docs を変更可能な新しい配列として作成
  const sanitizedDocs = snapshot.docs.map((docSnap) => {
    // docSnap.data() のコピーを作成し、サニタイズを適用
    const sanitizedData = sanitizeObject(docSnap.data());

    // スナップショットの構造を維持するために、新しいオブジェクトとして返す
    return {
      id: docSnap.id,
      data: () => sanitizedData,
      exists: docSnap.exists,
      // 必要なプロパティがあればここに追加
      ref: docSnap.ref,
    };
  });

  // 元の snapshot に似た構造を返す（docsをサニタイズ済みのものに置き換え）
  return {
    empty: snapshot.empty,
    docs: sanitizedDocs,
    size: snapshot.size,
    forEach: (callback) => sanitizedDocs.forEach(callback),
  };
}

/**
 * XSS対策付きの getDoc (Document) ラッパー関数
 * @param {DocumentReference} ref - ドキュメント参照
 * @returns {Promise<DocumentSnapshot>}
 */
export async function getWrapDoc(ref) {
  const docSnap = await getDoc(ref);

  // exists() が false の場合はそのまま返す
  if (!docSnap.exists()) {
    return docSnap;
  }

  // data() の結果をサニタイズ
  const sanitizedData = sanitizeObject(docSnap.data());

  // 新しいドキュメントスナップショット構造を返す
  return {
    id: docSnap.id,
    data: () => sanitizedData, // サニタイズされたデータを返す
    exists: docSnap.exists,
    ref: docSnap.ref,
  };
}

/**
 * 指定されたドキュメントをarchiveコレクションに退避させ、元のドキュメントを削除します。
 * この操作はバッチ処理（アトミック）で実行されます。
 *
 * @param {string} collectionName - 削除対象のドキュメントが存在するコレクション名（例: 'calls', 'callAnswers'）。
 * @param {string} docId - 削除対象のドキュメントID（例: 'xxx', 'xxx_user123'）。
 * @returns {Promise<void>}
 */
export async function archiveAndDeleteDoc(collectionName, docId) {
  // 1. 削除対象ドキュメント参照の構築
  const docRef = doc(db, collectionName, docId);
  // const docRef = utils.doc(utils.db, collectionName, docId); // utilsがFirestore関数をラップしている場合

  // 2. バッチ処理の開始
  const batch = writeBatch(db); // utils.writeBatchではなく、直接FirestoreのwriteBatchを使用すると仮定

  // 3. 元ドキュメントのデータを取得
  const docSnap = await getDoc(docRef); // utils.getDocではなく、直接getDocを使用すると仮定

  if (!docSnap.exists()) {
    console.warn(
      `Document not found in ${collectionName}/${docId}. Skipping archive and delete.`
    );
    return;
  }

  const data = docSnap.data();

  // 4. アーカイブ用ドキュメントIDの作成: [コレクション名]_[元のドキュメントID]
  const archiveId = `${collectionName}_${docId}`;

  // 5. archiveコレクションへの参照を作成
  const archiveRef = doc(db, 'archives', archiveId);

  // 6. アーカイブデータを作成 (元のデータ + 履歴情報)
  const archiveData = {
    ...data,
    _archivedAt: serverTimestamp(), // 退避日時
    _originalCollection: collectionName,
    _originalDocId: docId,
    _archivedByUid: getSession('uid') || 'unknown', // 実行ユーザーID
  };

  // 7. バッチにアーカイブ操作（set）を追加
  batch.set(archiveRef, archiveData);

  // 8. バッチに削除操作（delete）を追加
  batch.delete(docRef);

  // 9. バッチの実行
  await batch.commit();
}

export async function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const max = 1000;
        if (width > height && width > max) {
          height *= max / width;
          width = max;
        } else if (height > max) {
          width *= max / height;
          height = max;
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
