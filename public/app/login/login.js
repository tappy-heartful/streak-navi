import * as utils from '../common/functions.js';

////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  // セッションストレージ一度全削除
  utils.clearAllAppSession();

  // 背景スライドショー開始
  startBackgroundSlideshow();

  // テスト環境用表示
  if (utils.isTest) {
    $('#title').html(
      '<h1>Streak <span style="color: rgb(208, 2, 2)">T</span>est</h1>'
    );
  }

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
  $('#login')
    .prop('disabled', true)
    .addClass('logging-in')
    .text('ログイン準備中...');
  try {
    // サーバーにリクエストしてLINEログインURLとstateを取得
    const res = await fetch(
      `${utils.globalAuthServerRender}/get-line-login-url`
    );
    const { loginUrl } = await res.json();

    // LINEログインURLへ遷移
    window.location.href = loginUrl;
  } catch (err) {
    alert('ログインURL取得失敗: ' + err.message);
  } finally {
    $('#login')
      .prop('disabled', false)
      .removeClass('logging-in')
      .text('LINEでログイン');
  }
});

////////////////////////////
// LINEコールバック処理
////////////////////////////
async function handleLineLoginCallback(code, state, error) {
  try {
    $('#login')
      .prop('disabled', true)
      .addClass('logging-in')
      .text('ログイン中...');

    if (error) throw new Error('LINEログインに失敗しました: ' + error);
    if (!code || !state) throw new Error('無効なLINEログイン応答です');

    // 認証サーバーにstateも含めて送信
    const redirectUri = utils.globalBaseUrl + '/app/login/login.html';
    const loginResponse = await fetch(
      `${utils.globalAuthServerRender}/line-login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state, redirectUri }),
      }
    );
    const {
      customToken,
      profile,
      error: loginError,
    } = await loginResponse.json();

    if (loginError) throw new Error(loginError);
    if (!customToken) throw new Error('カスタムトークン取得失敗');

    // 以下は既存処理（Firebaseログイン～リダイレクト）
    const userCredential = await utils.signInWithCustomToken(
      utils.auth,
      customToken
    );
    const user = userCredential.user;
    utils.setSession('uid', user.uid);

    // Firestore保存／更新処理もそのまま
    const userRef = utils.doc(utils.db, 'users', user.uid);
    const docSnap = await utils.getDoc(userRef);
    const userExists = docSnap.exists();
    const displayName = profile.displayName || '名無し';
    const pictureUrl = profile.pictureUrl || utils.globalLineDefaultImage;

    if (userExists) {
      await utils.setDoc(
        userRef,
        { displayName, pictureUrl, lastLoginAt: utils.serverTimestamp() },
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

    const latestUserSnap = await utils.getDoc(userRef);
    const latestUserData = latestUserSnap.data();
    for (const [key, value] of Object.entries(latestUserData)) {
      utils.setSession(key, value);
    }

    // セッション有効期限登録
    utils.setSession(
      'expiresAt',
      Date.now() + 1000 * 60 * utils.globalSessionExpireMinutes
    );

    $('#login').removeClass('logging-in').text('ようこそ！');

    if (userExists) {
      //ユーザ存在
      // redirectAfterLoginは削除
      const redirectAfterLogin = localStorage.getItem('redirectAfterLogin');
      localStorage.removeItem('redirectAfterLogin');

      // ログイン後ウェルカム演出用にフラグ保持
      utils.setSession('fromLogin', true);

      // リダイレクト(指定されたURLがある：そこへ、通常ログイン：ホームへ)
      window.location.href = redirectAfterLogin ?? '../home/home.html';
    } else {
      // ユーザ非存在
      // 同意画面へ
      window.location.href = '../login/consent.html';
    }
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
