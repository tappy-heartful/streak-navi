export function showModal(title, body) {
  return new Promise((resolve) => {
    const $modal = $('.modal');
    const $title = $modal.find('.modal-title');
    const $body = $modal.find('.modal-body');
    const $buttons = $modal.find('.confirm-buttons');
    const $saveBtn = $buttons.find('.save-button');
    const $cancelBtn = $buttons.find('.cancel-button');
    const $closeBtn = $modal.find('.modal-close');

    // タイトルと本文セット
    $title.text(title);
    $body.html(body);

    // ボタン表示
    $buttons.removeClass('hidden');

    // モーダル表示
    $modal.removeClass('hidden');

    // クリーンアップ関数
    const cleanup = () => {
      $modal.addClass('hidden');
      $buttons.addClass('hidden');
      $saveBtn.off('click');
      $cancelBtn.off('click');
      $closeBtn.off('click');
      $modal.off('click.modalOuter');
    };

    // 保存ボタン → resolve(true)
    $saveBtn.on('click', () => {
      cleanup();
      resolve(true);
    });

    // キャンセル系 → resolve(false)
    const cancelHandler = () => {
      cleanup();
      resolve(false);
    };

    $cancelBtn.on('click', cancelHandler);
    $closeBtn.on('click', cancelHandler);
    $modal.on('click.modalOuter', function (e) {
      if ($(e.target).hasClass('modal')) {
        cancelHandler();
      }
    });
  });
}
