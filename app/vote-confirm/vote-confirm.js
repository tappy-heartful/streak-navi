////////////////////////////
// グローバル変数
////////////////////////////
let initialStateHtml;

////////////////////////////
// 初期処理（画面読み込み時）
////////////////////////////
$(document).ready(function () {
  initDisplay();
  setupEventHandlers();
});

////////////////////////////
// イベントハンドラー設定
////////////////////////////
function setupEventHandlers() {
  // クリアボタン：初期状態に戻す
  $('.delete-button').on('click', function () {
    showDialog('削除しますか？').then((result) => {
      if (result) {
        restoreInitialState();
      }
    });
  });
}
