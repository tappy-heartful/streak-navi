import * as utils from '../common/functions.js';

////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  // 初期処理
  await utils.initDisplay();

  // スピナー非表示
  utils.hideSpinner();

  // 初回遷移時ウェルカム演出
  if (utils.globalGetParamFirstLogin === '1') {
    const lineIconPath = utils.getSession('pictureUrl');
    const lineAccountName = utils.getSession('displayName');

    $('#welcome-line-icon').attr('src', lineIconPath);
    $('#welcome-line-name').text(lineAccountName);

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
    }, 2000);
  }
});
