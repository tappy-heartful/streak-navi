import * as utils from '../common/functions.js';

////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  // セッションストレージ一度全削除
  utils.clearAllAppSession();

  // 背景スライドショー開始
  startBackgroundSlideshow();

  // URLにcode/stateが付いていたら → LINEログイン処理を開始
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  const error = urlParams.get('error');

  if (code || state || error) {
    await handleLineLoginCallback(code, state, error);
  }
});

////////////////////////////
// ログインボタン押下
////////////////////////////
$('#login').click(async function () {
  const redirectUri = encodeURIComponent(
    utils.globalBaseUrl + '/app/login/login.html'
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
  localStorage.setItem('oauthState', state);
  return state;
}

////////////////////////////
// LINEコールバック処理
////////////////////////////
async function handleLineLoginCallback(code, state, error) {
  try {
    utils.showSpinner();

    if (error) throw new Error('LINEログインに失敗しました: ' + error);
    if (!code || !state) throw new Error('無効なLINEログイン応答です');

    // state検証
    const savedState = localStorage.getItem('oauthState');
    if (!savedState || savedState !== state) {
      throw new Error('不正なリクエストです（state不一致）。');
    }
    localStorage.removeItem('oauthState');

    // 認証サーバーにリクエスト
    const redirectUri = utils.globalBaseUrl + '/app/login/login.html';
    const loginResponse = await fetch(utils.globalAuthServerRender, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirectUri }),
    });
    const { customToken, profile } = await loginResponse.json();
    if (!customToken) throw new Error('カスタムトークン取得失敗');

    // Firebaseログイン
    const userCredential = await utils.signInWithCustomToken(
      utils.auth,
      customToken
    );
    const user = userCredential.user;
    utils.setSession('uid', user.uid);

    // Firestoreにユーザーデータ保存 or 更新
    const userRef = utils.doc(utils.db, 'users', user.uid);
    const docSnap = await utils.getDoc(userRef);
    const userExists = docSnap.exists();
    const displayName = profile.displayName || '名無し';
    const pictureUrl = profile.pictureUrl || utils.globalLineDefaultImage;

    if (userExists) {
      await utils.setDoc(
        userRef,
        {
          displayName,
          pictureUrl,
          lastLoginAt: utils.serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      await utils.setDoc(userRef, {
        displayName,
        pictureUrl,
        lastLoginAt: utils.serverTimestamp(),
        createdAt: utils.serverTimestamp(),
        roleId: utils.globalStrUnset,
        sectionId: utils.globalStrUnset,
      });
    }

    // 最新ユーザーデータをセッション保存
    const latestUserSnap = await utils.getDoc(userRef);
    const latestUserData = latestUserSnap.data();
    for (const [key, value] of Object.entries(latestUserData)) {
      utils.setSession(key, value);
    }

    // リダイレクト
    const redirectAfterLogin = localStorage.getItem('redirectAfterLogin');
    if (userExists) localStorage.removeItem('redirectAfterLogin');
    window.location.href = userExists
      ? redirectAfterLogin ??
        utils.globalBaseUrl + '/app/home/home.html?fromLogin=1'
      : utils.globalBaseUrl + '/app/login/consent.html';
  } catch (e) {
    alert('ログインエラー: ' + e.message);
    await utils.writeLog({
      dataId: 'none',
      action: 'ログイン',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
}

////////////////////////////
// 背景スライドショー（クロスフェード + ズームイン/アウト）
////////////////////////////
function startBackgroundSlideshow() {
  const imageMap = {
    1: 2,
    2: 5,
    3: 4,
    4: 5,
    5: 4,
    6: 2,
    99: 1,
  };
  const keys = Object.keys(imageMap).map(Number);

  let currentAIndex = Math.floor(Math.random() * keys.length);
  let currentB = 1;

  const $body = $('body.login-page');
  $body.css('position', 'relative');

  // 背景レイヤー2枚
  const $bg1 = $('<div class="bg-layer"></div>').appendTo($body);
  const $bg2 = $('<div class="bg-layer"></div>').appendTo($body);

  // 白カバー
  $('<div class="bg-cover"></div>').appendTo($body);

  let showing = $bg1;
  let hidden = $bg2;

  setBackground(showing, keys[currentAIndex], currentB);
  hidden.css('opacity', 0);

  const intervalTime = 10000; // 10秒ごとに切替
  const fadeTime = 2000; // フェード時間2秒

  setInterval(() => {
    const currentA = keys[currentAIndex];
    const maxB = imageMap[currentA];

    currentB++;
    if (currentB > maxB) {
      currentB = 1;
      currentAIndex = (currentAIndex + 1) % keys.length;
    }

    const nextUrl = `../../images/background/${keys[currentAIndex]}_${currentB}.jpg`;
    preloadImage(nextUrl); // 事前読み込み

    setBackground(hidden, keys[currentAIndex], currentB);

    // クロスフェード
    hidden.hide().fadeIn(fadeTime);
    showing.fadeOut(fadeTime, function () {
      const temp = showing;
      showing = hidden;
      hidden = temp;
    });
  }, intervalTime);

  // 画像事前読み込み
  function preloadImage(url) {
    const img = new Image();
    img.src = url;
  }

  // 背景セット＋ランダムズーム
  function setBackground($el, A, B) {
    const url = `../../images/background/${A}_${B}.jpg`;

    $el.css({
      'background-image': `url(${url})`,
      'background-position': 'center',
      'background-repeat': 'no-repeat',
      'background-size': 'cover',
      'background-color': 'black',
      position: 'absolute',
      inset: 0,
      'z-index': -1,
      width: '100%',
      height: '100%',
      opacity: 1,
    });

    // ランダムでズームイン/ズームアウト
    const animations = ['zoomIn', 'zoomOut'];
    const randomAnim =
      animations[Math.floor(Math.random() * animations.length)];

    // アニメーションリセットして再適用
    $el.css('animation', 'none');
    $el[0].offsetHeight; // reflow
    $el.css('animation', `${randomAnim} 10s ease-in-out forwards`);
  }
}
