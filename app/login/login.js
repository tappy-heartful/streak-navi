////////////////////////////
// グローバル変数
////////////////////////////
let appsettings = [];

////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  try {
    // 設定ファイルを読み込み
    appsettings = await getJsonData('../../appsettings.json');

    // 設定ファイル情報をセッションストレージに保存
    clearAllAppSession(); // 一度全削除
    Object.keys(appsettings).forEach((key) => {
      setSession(key, appsettings[key]);
    });

    // 環境情報を保存(本番 or テスト)
    setSession(
      'isProd',
      window.location.href.startsWith(getSession('urlBaseProd'))
    );
  } catch (error) {
    // データ読み込み失敗時にエラー表示
    showError('Failed:', error);
  }
});

////////////////////////////
// ログインボタン押下
////////////////////////////
function loginWithLINE() {
  const clientId = getSession('clientId');
  const redirectUri = encodeURIComponent(
    window.location.origin + '/app/login/callback.html'
  );
  const state = Math.random().toString(36).substring(2); // 任意の文字列（CSRF対策）
  const scope = 'openid profile email';

  const loginUrl =
    `https://access.line.me/oauth2/v2.1/authorize?` +
    `response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}` +
    `&state=${state}&scope=${scope}`;

  window.location.href = loginUrl;
}
