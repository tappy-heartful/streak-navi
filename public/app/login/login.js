import * as utils from '../common/functions.js';

////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  try {
    // セッションストレージ一度全削除
    utils.clearAllAppSession(); //
  } catch (error) {
    // データ読み込み失敗時にエラー表示
    utils.showError('Failed:', error);
  }
});

////////////////////////////
// ログインボタン押下
////////////////////////////
$('#login').click(function () {
  const redirectUri = encodeURIComponent(
    utils.globalBaseUrl + '/app/login/callback.html' // テスト環境の場合、今のベースURLに結合
  );
  const state = Math.random().toString(36).substring(2); // 任意の文字列（CSRF対策）
  const scope = 'openid profile';

  const loginUrl =
    `https://access.line.me/oauth2/v2.1/authorize?` +
    `response_type=code&client_id=${utils.globalClientId}&redirect_uri=${redirectUri}` +
    `&state=${state}&scope=${scope}`;

  window.location.href = loginUrl;
});
