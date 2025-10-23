import * as utils from '../common/functions.js';

////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  // テスト環境
  if (utils.isTest) {
    $('#logo-text').html('Streak <span class="logo-n">T</span>est');
  }

  // ICONのみ表示
  const lineIconPath = utils.getSession('pictureUrl');
  $('#header-line-icon').attr('src', lineIconPath);

  // ✅ロゴクリック → HOMEへ
  $('#logo-text').on('click', function () {
    window.location.href = '../home/home.html';
  });

  // ✅ハンバーガーメニュー開閉
  $('#hamburger-menu').on('click', function (e) {
    e.stopPropagation();
    $('#side-menu').slideToggle(200);
  });

  // ✅ユーザアイコンクリック → プロフィールメニュー
  $('#header-line-icon').on('click', function (e) {
    e.stopPropagation();
    $('#logout-menu').slideToggle(200);
  });

  // メニュー項目クリック
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

  // ✅プロフィール画面
  $('#profile-button').on('click', function () {
    window.location.href =
      '../user-confirm/user-confirm.html?uid=' + utils.getSession('uid');
  });

  // ✅ログアウト
  $('#logout-button').on('click', function () {
    utils.clearAllAppSession();
    window.location.href = utils.globalBaseUrl;
  });

  // ✅外部クリックで閉じる
  $(document).on('click', function () {
    $('#side-menu').slideUp(200);
    $('#logout-menu').slideUp(200);
  });

  // ✅既存：シェア
  document.getElementById('share-button').addEventListener('click', () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator
        .share({
          title: document.title,
          url: url,
        })
        .catch(console.error);
    } else {
      navigator.clipboard.writeText(url).then(() => {
        alert('URLをコピーしました');
      });
    }
  });
});
