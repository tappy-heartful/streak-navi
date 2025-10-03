/**
 * モーダル表示関数
 * @param {string} title - モーダルタイトル
 * @param {string} body - モーダル本文（HTML可）
 * @param {string} [saveLabel] - 保存ボタンのラベル。未指定なら非表示
 * @param {string} [cancelLabel] - キャンセルボタンのラベル。未指定なら非表示
 * @returns {Promise<boolean>} 保存=true, キャンセル=false
 */
export function showModal(title, body, saveLabel, cancelLabel) {
  return new Promise((resolve) => {
    const $modal = $('.modal');
    const $title = $modal.find('.modal-title');
    const $body = $modal.find('.modal-body');
    const $buttons = $modal.find('.confirm-buttons');
    const $saveBtn = $buttons.find('#modal-save-button');
    const $cancelBtn = $buttons.find('#modal-cancel-button');
    const $closeBtn = $modal.find('.modal-close');

    // タイトルと本文セット
    $title.text(title);
    $body.safeHTML(body);

    // ボタンラベルに応じて表示/非表示
    if (saveLabel) {
      $saveBtn.text(saveLabel).removeClass('hidden');
    } else {
      $saveBtn.addClass('hidden');
    }

    if (cancelLabel) {
      $cancelBtn.text(cancelLabel).removeClass('hidden');
    } else {
      $cancelBtn.addClass('hidden');
    }

    // ボタン全体を表示/非表示
    if (saveLabel || cancelLabel) {
      $buttons.removeClass('hidden');
    } else {
      $buttons.addClass('hidden');
    }

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
