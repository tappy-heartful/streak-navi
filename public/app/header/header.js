import * as utils from '../common/functions.js';
import { globalBaseUrl } from '../common/functions.js';
////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  // ログイン情報反映
  const lineIconPath = utils.getSession('pictureUrl');
  const lineAccountName = utils.getSession('displayName');
  $('#header-line-icon').attr('src', lineIconPath);
  $('#header-line-name').text(lineAccountName);

  // --- 左ロゴクリックでサイドメニュー表示 ---
  $('.header-left').on('click', function (e) {
    e.stopPropagation();
    $('#side-menu').slideToggle(200);
  });

  // サイドメニュー項目クリック
  $('#menu-top').on('click', function () {
    window.location.href = '../home/home.html';
  });
  $('#menu-score-list').on('click', function () {
    window.location.href = '../score-list/score-list.html';
  });
  $('#menu-event-list').on('click', function () {
    window.location.href = '../event-list/event-list.html';
  });
  $('#menu-call-list').on('click', function () {
    window.location.href = '../call-list/call-list.html';
  });
  $('#menu-vote-list').on('click', function () {
    window.location.href = '../vote-list/vote-list.html';
  });
  $('#menu-user-list').on('click', function () {
    window.location.href = '../user-list/user-list.html';
  });
  $('#menu-blue-note-edit').on('click', function () {
    window.location.href = '../blue-note-edit/blue-note-edit.html';
  });
  $('#menu-media-list').on('click', function () {
    window.location.href = '../media-list/media-list.html';
  });

  // --- 右側メニュー制御 ---
  $('.header-right').on('click', function (e) {
    e.stopPropagation(); // 外側のクリックイベントを防ぐ
    $('#logout-menu').slideToggle(200);
  });

  // プロフィールボタンクリック時にユーザ確認画面に遷移
  $('#profile-button').on('click', function () {
    window.location.href =
      '../user-confirm/user-confirm.html?uid=' + utils.getSession('uid');
  });

  // ログアウトボタンクリック時にログイン画面へ遷移
  $('#logout-button').on('click', function () {
    // ログインページへ遷移
    window.location.href = globalBaseUrl;
  });

  // 外部クリックで閉じる
  $(document).on('click', function () {
    $('#logout-menu').slideUp(200);
    $('#side-menu').slideUp(200);
  });
});
