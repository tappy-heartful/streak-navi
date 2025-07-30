////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  try {
    // セッションストレージ一度全削除
    clearAllAppSession(); //
  } catch (error) {
    // データ読み込み失敗時にエラー表示
    showError('Failed:', error);
  }
});

////////////////////////////
// ログインボタン押下
////////////////////////////
function loginWithLINE() {
  const redirectUri = encodeURIComponent(
    globalBaseUrl + '/public/app/login/callback.html' // テスト環境の場合、今のベースURLに結合
  );
  const state = Math.random().toString(36).substring(2); // 任意の文字列（CSRF対策）
  const scope = 'openid profile';

  const loginUrl =
    `https://access.line.me/oauth2/v2.1/authorize?` +
    `response_type=code&client_id=${globalClientId}&redirect_uri=${redirectUri}` +
    `&state=${state}&scope=${scope}`;

  window.location.href = loginUrl;
}
