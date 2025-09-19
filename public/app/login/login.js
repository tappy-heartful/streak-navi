import * as utils from '../common/functions.js';

////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  // セッションストレージ一度全削除
  utils.clearAllAppSession();

  // 背景スライドショー開始
  startBackgroundSlideshow();
});

////////////////////////////
// ログインボタン押下
////////////////////////////
$('#login').click(async function () {
  const redirectUri = encodeURIComponent(
    utils.globalBaseUrl + '/app/login/callback.html'
  );
  const state = generateAndStoreState();
  const scope = 'openid profile';

  const loginUrl =
    `https://access.line.me/oauth2/v2.1/authorize?` +
    `response_type=code&client_id=${utils.globalClientId}&redirect_uri=${redirectUri}` +
    `&state=${state}&scope=${scope}`;

  window.location.href = loginUrl;
});

// 認証開始直前に呼ぶ
function generateAndStoreState() {
  const array = new Uint32Array(10);
  window.crypto.getRandomValues(array);
  const state = Array.from(array, (dec) => dec.toString(16)).join('');
  // LINEアプリ経由だと別タブでコールバックされることがあるため
  // ローカルストレージに保存しておく
  localStorage.setItem('oauthState', state);
  return state;
}

////////////////////////////
// 背景スライドショー
////////////////////////////
function startBackgroundSlideshow() {
  // 各番号Aの画像枚数を定義
  const imageMap = {
    1: 3,
    2: 4,
    3: 4,
    4: 6,
    5: 6,
    6: 1,
    7: 1,
  };

  // 番号Aの順番リスト
  const keys = Object.keys(imageMap).map(Number);

  // 最初はランダム
  let currentAIndex = Math.floor(Math.random() * keys.length);
  let currentB = 1;

  // 初期表示
  setBackground(keys[currentAIndex], currentB);

  setInterval(() => {
    const currentA = keys[currentAIndex];
    const maxB = imageMap[currentA];

    // Bを進める
    currentB++;
    if (currentB > maxB) {
      // 次のAへ
      currentB = 1;
      currentAIndex = (currentAIndex + 1) % keys.length;
    }

    $('body.login-page').fadeOut(800, function () {
      setBackground(keys[currentAIndex], currentB);
      $(this).fadeIn(800);
    });
  }, 10000);

  function setBackground(A, B) {
    $('body.login-page').css({
      background: `url(../../images/background/${A}_${B}.jpg) no-repeat center center`,
      'background-size': 'cover',
      'background-color': 'black', // 余白は黒で埋める
    });
  }
}
