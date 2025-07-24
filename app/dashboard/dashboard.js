////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  // ログイン済みチェック
  if (!getSessionArray('line_profile').userId) {
    // 不正遷移の場合ログインページへ遷移
    window.location.href = getSession('isProd')
      ? getSession('urlBaseProd') // 本番環境の場合、設定ファイルの情報(github Pagesはサブドメインまであるため)
      : window.location.origin; // テスト環境の場合、今のベースURLに結合;
  }
});
