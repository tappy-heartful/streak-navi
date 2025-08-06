////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  // 初期処理
  initDisplay();

  //初回ログインウェルカム演出
  const urlParams = new URLSearchParams(window.location.search);
  const isFirstLogin = urlParams.get('first_login') === '1';

  if (isFirstLogin) {
    const lineProfile = getSessionArray('line_profile');
    const lineIconPath = lineProfile.pictureUrl;
    const lineAccountName = lineProfile.displayName;

    $('#line-icon').attr('src', lineIconPath);
    $('#line-name').text(lineAccountName);

    const $overlay = $('#first-login-overlay');
    $overlay.removeClass('hidden');
    // 表示
    setTimeout(() => {
      $overlay.addClass('show');
    }, 10); // 少し遅延させてCSS transitionを確実に動かす

    // 1.5秒表示 → フェードアウト（0.5秒）
    setTimeout(() => {
      $overlay.removeClass('show');
      // 完全に非表示に
      setTimeout(() => {
        $overlay.addClass('hidden');
      }, 500);
    }, 3000);
  }
});
