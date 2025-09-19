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
// 背景スライドショー（クロスフェード + 白カバー）
////////////////////////////
function startBackgroundSlideshow() {
  const imageMap = {
    1: 1,
    2: 5,
    3: 3,
    4: 5,
    5: 2,
    6: 3,
    99: 1,
  };
  const keys = Object.keys(imageMap).map(Number);

  let currentAIndex = Math.floor(Math.random() * keys.length);
  let currentB = 1;

  const $body = $('body.login-page');
  $body.css('position', 'relative');

  // 背景用 div
  const $bg1 = $('<div class="bg-layer"></div>').appendTo($body);
  const $bg2 = $('<div class="bg-layer"></div>').appendTo($body);

  // 白カバー div
  const $cover = $('<div class="bg-cover"></div>').appendTo($body);

  let showing = $bg1;
  let hidden = $bg2;

  setBackground(showing, keys[currentAIndex], currentB);
  hidden.css('opacity', 0);

  setInterval(() => {
    const currentA = keys[currentAIndex];
    const maxB = imageMap[currentA];

    currentB++;
    if (currentB > maxB) {
      currentB = 1;
      currentAIndex = (currentAIndex + 1) % keys.length;
    }

    setBackground(hidden, keys[currentAIndex], currentB);

    // クロスフェード
    hidden.animate({ opacity: 1 }, 2000);
    showing.animate({ opacity: 0 }, 2000, function () {
      const temp = showing;
      showing = hidden;
      hidden = temp;
    });
  }, 10000);

  function setBackground($el, A, B) {
    $el.css({
      background: `url(../../images/background/${A}_${B}.jpg) no-repeat center center`,
      'background-size': 'cover',
      'background-color': 'black',
      position: 'absolute',
      inset: 0,
      'z-index': -1,
      width: '100%',
      height: '100%',
    });
  }
}
