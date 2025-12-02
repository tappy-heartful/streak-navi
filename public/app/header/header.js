import * as utils from '../common/functions.js';

////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  // テスト環境
  if (utils.isTest) {
    $('#logo-text').html('Streak <span class="logo-n">T</span>est');
  }

  // ✅ロゴクリック → HOMEへ
  $('#logo-text').on('click', function () {
    window.location.href = '../home/home.html';
  });

  const icon = utils.getSession('pictureUrl_decoded');
  const name = utils.getSession('displayName_decoded');

  // LINEアイコン
  $('#header-line-icon').attr('src', icon || utils.globalLineDefaultImage);

  $('#menu-user-icon').attr('src', icon);
  $('#menu-user-name').text(name);

  // 開く
  $('#header-right').on('click', function () {
    $('#menu-overlay').fadeIn(150);
    $('#slide-menu').addClass('open');
  });

  // 閉じる
  $('#close-menu').on('click', closeMenu);
  $('#menu-overlay').on('click', closeMenu);

  function closeMenu() {
    $('#menu-overlay').fadeOut(150);
    $('#slide-menu').removeClass('open');
  }

  // 各遷移（※既存）
  $('#menu-user-name').on(
    'click',
    () =>
      (location.href =
        '../user-confirm/user-confirm.html?uid=' + utils.getSession('uid'))
  );
  $('#menu-home').on('click', () => (location.href = '../home/home.html'));
  $('#menu-score-list').on(
    'click',
    () => (location.href = '../score-list/score-list.html')
  );
  $('#menu-event-list').on(
    'click',
    () => (location.href = '../event-list/event-list.html')
  );
  $('#menu-assign-list').on(
    'click',
    () => (location.href = '../assign-list/assign-list.html')
  );
  $('#menu-call-list').on(
    'click',
    () => (location.href = '../call-list/call-list.html')
  );
  $('#menu-vote-list').on(
    'click',
    () => (location.href = '../vote-list/vote-list.html')
  );
  $('#menu-user-list').on(
    'click',
    () => (location.href = '../user-list/user-list.html')
  );
  $('#menu-blue-note-edit').on(
    'click',
    () => (location.href = '../blue-note-edit/blue-note-edit.html')
  );
  $('#menu-media-list').on(
    'click',
    () => (location.href = '../media-list/media-list.html')
  );

  $('#profile-button').on(
    'click',
    () =>
      (location.href =
        '../user-confirm/user-confirm.html?uid=' + utils.getSession('uid'))
  );

  $('#logout-button').on('click', () => {
    utils.clearAllAppSession();
    location.href = utils.globalBaseUrl;
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
