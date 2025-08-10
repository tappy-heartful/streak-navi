import * as utils from '../common/functions.js';
import { globalBaseUrl } from '../common/functions.js';
////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  // ログイン情報反映
  const lineIconPath = utils.getSession('pictureUrl');
  const lineAccountName = utils.getSession('displayName');
  $('#line-icon').attr('src', lineIconPath);
  $('#line-name').text(lineAccountName);

  // バンドアイコンボタン制御
  // TOPへ遷移
  $('.header-left').on('click', function (e) {
    window.location.href = '../top/top.html';
  });

  // ログアウトボタン制御
  // トグル表示
  $('.header-right').on('click', function (e) {
    e.stopPropagation(); // 外側のクリックイベントを防ぐ
    $('#logout-menu').slideToggle(200);
  });

  // ログアウトボタンクリック時にログイン画面へ遷移
  $('#logout-button').on('click', function () {
    // ログインページへ遷移
    window.location.href = globalBaseUrl;
  });

  // 外部クリックで閉じる
  $(document).on('click', function () {
    $('#logout-menu').slideUp(200);
  });
});
