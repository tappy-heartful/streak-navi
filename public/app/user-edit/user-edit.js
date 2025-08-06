import * as utils from '../common/functions.js';

$(document).ready(function () {
  initDisplay();
  setUpPage();
  setupEventHandlers();
});

function setUpPage() {
  const userData = {
    name: 'カウント 太郎',
    isUserAdmin: true,
    isVoteAdmin: false,
  };

  $('#user-name').text(userData.name);
  $('#is-user-admin').prop('checked', userData.isUserAdmin);
  $('#is-vote-admin').prop('checked', userData.isVoteAdmin);
}

function setupEventHandlers() {
  $('#save-button').on('click', function () {
    const updatedData = {
      isUserAdmin: $('#is-user-admin').is(':checked'),
      isVoteAdmin: $('#is-vote-admin').is(':checked'),
    };

    console.log('更新内容:', updatedData);

    utils.showDialog('ユーザ情報を更新しますか？').then((result) => {
      if (result) {
        alert('ユーザ情報を更新しました（仮）');
      }
    });
  });

  //ツールチップ
  $('.tooltip-icon').on('click touchstart', function (e) {
    e.preventDefault(); // ← これを追加（クリック動作防止）
    e.stopPropagation(); // 他のイベントをブロック

    const $tooltip = $(this);

    // 既存のツールチップをすべて非表示
    $('.tooltip-icon').not(this).removeClass('show');

    // トグル表示
    $tooltip.toggleClass('show');
  });

  // 他の場所をタップしたら消す
  $(document).on('click touchstart', function () {
    $('.tooltip-icon').removeClass('show');
  });
}
