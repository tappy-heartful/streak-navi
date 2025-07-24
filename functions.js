// 定数
const appName = 'streakNavi';

// JSONデータを取得する関数
function getJsonData(jsonUrl) {
  return new Promise((resolve, reject) => {
    $.getJSON(jsonUrl, function (data) {
      resolve(data);
    }).fail(function () {
      reject('Failed to load JSON file');
    });
  });
}

// CSVデータを取得する関数
async function fetchCsvData(fileName, skipRowCount = 0) {
  try {
    const response = await fetch(fileName);
    const text = await response.text();
    return parseCsv(text, skipRowCount);
  } catch (error) {
    throw new Error('Failed to load CSV file:' + fileName);
  }
}

// CSVデータをパースする関数（csvデータ内の「,」は「，」にしているため「,」に変換して返却）
function parseCsv(csvText, skipRowCount) {
  var regx = new RegExp(appsettings.commaInString, 'g');
  return csvText
    .trim()
    .split(/\r?\n|\r/)
    .slice(skipRowCount)
    .map((line) => line.split(',').map((value) => value.replace(regx, ',')));
}

// データをセッションストレージからクリアする関数
function removeSession(key) {
  sessionStorage.removeItem(appName + '.' + key);
}

// データをセッションストレージから全削除する関数
function clearAllAppSession() {
  const prefix = appName + '.';
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
function setSession(key, value) {
  sessionStorage.setItem(appName + '.' + key, value);
}

// セッションストレージからデータをゲットする関数
function getSession(key) {
  return sessionStorage.getItem(appName + '.' + key);
}

// セッションストレージから配列を取得(nullは空に)
function getSessionArray(key) {
  return JSON.parse(sessionStorage.getItem(appName + '.' + key)) ?? [];
}

// セッションストレージに配列設定(nullは空に)
function setSessionArray(key, array) {
  sessionStorage.setItem(appName + '.' + key, JSON.stringify(array ?? []));
}

// エラー時処理
function showError(errorMsg1, errorMsg2) {
  // コンソールに表示
  console.error(errorMsg1, errorMsg2);
  // 画面に表示
  alert(errorMsg2);
}

function scrollToTop() {
  // 一番上にスクロール
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  });
}
