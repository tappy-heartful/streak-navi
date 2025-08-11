import * as utils from '../common/functions.js';

////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  // 初期処理
  await utils.initDisplay();

  // スピナー非表示
  utils.hideSpinner();

  const fromLogin = utils.globalGetParamFromLogin === '1'; // ログイン画面から
  const isInit = utils.globalGetParamIsInit === '1'; // ユーザ編集画面から

  // 初回遷移時ウェルカム演出
  if (fromLogin || isInit) {
    const lineIconPath = utils.getSession('pictureUrl');
    const lineAccountName = utils.getSession('displayName');

    $('#welcome-line-icon').attr('src', lineIconPath);
    $('#welcome-line-name').text(lineAccountName);

    // 挨拶メッセージ
    const greetingMessage = isInit
      ? 'ようこそ🌸'
      : fromLogin
      ? getGreetingMessage()
      : '';
    $('#greeting-message').text(greetingMessage);

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

// 挨拶メッセージを取得する関数
function getGreetingMessage() {
  const now = new Date();
  const hour = now.getHours();
  let message = '';

  if (hour >= 5 && hour < 11) {
    message = `おはようございます🌄`;
  } else if (hour >= 11 && hour < 17) {
    message = `こんにちは☀️`;
  } else {
    message = `こんばんは🌙`;
  }
  return message;
}
