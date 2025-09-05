import * as utils from '../common/functions.js';
////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  // 閉じるボタン押下でモーダルを非表示にする
  $(document).on('click', '.modal-close', function () {
    $(this).closest('.modal').addClass('hidden');
  });

  // モーダルの外側をクリックした場合も閉じる
  $(document).on('click', '.modal', function (e) {
    if ($(e.target).hasClass('modal')) {
      $(this).addClass('hidden');
    }
  });
});
