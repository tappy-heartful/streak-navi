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
  // 用意する背景画像リスト
  const imagesLength = 10; // images/background/1.jpg ～ 10.jpg

  // 最初はランダムに
  let currentIndex = Math.floor(Math.random() * imagesLength);
  $('body.login-page').css({
    background: `url(../../images/background/${
      currentIndex + 1
    }.jpg) no-repeat center center`,
    'background-size': 'cover',
  });

  // 10秒ごとに次の画像へ
  setInterval(() => {
    currentIndex = (currentIndex + 1) % imagesLength;
    $('body.login-page').fadeOut(800, function () {
      $(this)
        .css({
          background: `url(../../images/background/${
            currentIndex + 1
          }.jpg) no-repeat center center`,
          'background-size': 'cover',
        })
        .fadeIn(800);
    });
  }, 10000);
}
