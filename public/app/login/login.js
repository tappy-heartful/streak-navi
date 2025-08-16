import * as utils from '../common/functions.js';

////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  try {
    // セッションストレージ一度全削除
    utils.clearAllAppSession();
  } catch (e) {
    // ログ登録
    await utils.writeLog({
      dataId: 'none',
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  }
});

////////////////////////////
// ログインボタン押下
////////////////////////////
$('#login').click(async function () {
  try {
    const redirectUri = encodeURIComponent(
      utils.globalBaseUrl + '/app/login/callback.html' // テスト環境の場合、今のベースURLに結合
    );
    const state = generateAndStoreState();
    const scope = 'openid profile';

    const loginUrl =
      `https://access.line.me/oauth2/v2.1/authorize?` +
      `response_type=code&client_id=${utils.globalClientId}&redirect_uri=${redirectUri}` +
      `&state=${state}&scope=${scope}`;

    window.location.href = loginUrl;
  } catch (e) {
    // ログ登録
    await utils.writeLog({
      dataId: 'none',
      action: 'ログインボタン押下',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  }
});

// 認証開始直前に呼ぶ
function generateAndStoreState() {
  const array = new Uint32Array(10);
  window.crypto.getRandomValues(array);
  const state = Array.from(array, (dec) => dec.toString(16)).join('');
  utils.setSession('oauthState', state);
  return state;
}
