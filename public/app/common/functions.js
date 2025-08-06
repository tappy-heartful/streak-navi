import { app, auth } from './firebase-init.js';

// グローバル定数
export const globalAppName = 'streakNavi';
export const globalClientId = '2007808275';
export const globalBaseUrl = window.location.href.startsWith(
  'https://tappy-heartful.github.io/streak-navi'
)
  ? 'https://tappy-heartful.github.io/streak-navi' // 旧本番環境(github Pagesはサブドメインまである)
  : window.location.origin + // 本番環境(firebase上で公開。publicのパス抜き)
    (window.location.href.includes('public') ? '/public' : ''); // ローカル環境(liveserverでhosting。publicのパスあり)

// JSONデータを取得する関数
export function getJsonData(jsonUrl) {
  return new Promise((resolve, reject) => {
    $.getJSON(jsonUrl, function (data) {
      resolve(data);
    }).fail(function () {
      reject('Failed to load JSON file');
    });
  });
}

// CSVデータを取得する関数
export async function fetchCsvData(fileName, skipRowCount = 0) {
  try {
    const response = await fetch(fileName);
    const text = await response.text();
    return parseCsv(text, skipRowCount);
  } catch (error) {
    throw new Error('Failed to load CSV file:' + fileName);
  }
}

// CSVデータをパースする関数（csvデータ内の「,」は「，」にしているため「,」に変換して返却）
export function parseCsv(csvText, skipRowCount) {
  var regx = new RegExp(appsettings.commaInString, 'g');
  return csvText
    .trim()
    .split(/\r?\n|\r/)
    .slice(skipRowCount)
    .map((line) => line.split(',').map((value) => value.replace(regx, ',')));
}

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

// エラー時処理
export function showError(errorMsg1, errorMsg2) {
  // コンソールに表示
  console.error(errorMsg1, errorMsg2);
  // 画面に表示
  alert(errorMsg2);
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
    script.defer = true; // 必須ではないがHTML後に実行させるなら
    document.body.appendChild(script);
  }
}

// 画面共通初期処理
export function initDisplay() {
  if (!getSessionArray('line_profile').userId) {
    // 不正遷移の場合ログインページへ遷移(セッションが正しくセットされていない場合を考慮)
    window.location.href = window.location.href.includes('tappy-heartful')
      ? 'https://tappy-heartful.github.io/streak-navi'
      : window.location.origin;
  } else {
    //共通スクリプト
    loadComponent('script', false, true, false);

    // ヘッダー、フッター
    loadComponent('header');
    loadComponent('footer');
    // ダイアログ読み込み
    loadComponent('dialog');
  }
}
