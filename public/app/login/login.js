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
  const imagesLength = 9; // 1.jpg ～ 9.jpg

  // 最初の画像
  let currentIndex = Math.floor(Math.random() * imagesLength);
  setBackground(currentIndex);

  setInterval(() => {
    // 次もランダムに選ぶ
    currentIndex = Math.floor(Math.random() * imagesLength);
    $('body.login-page').fadeOut(800, function () {
      setBackground(currentIndex);
      $(this).fadeIn(800);
    });
  }, 10000);

  function setBackground(index) {
    $('body.login-page').css({
      background: `url(../../images/background/${
        index + 1
      }.jpg) no-repeat center center`,
      'background-size': 'cover',
      'background-color': 'black', // 余白は黒で埋める
    });
  }
}
