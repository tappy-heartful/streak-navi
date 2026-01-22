/**
 * モーダル表示関数
 * @param {string} title - モーダルタイトル
 * @param {string} body - モーダル本文（HTML可）
 * @param {string} [saveLabel] - 保存ボタンのラベル。未指定なら非表示
 * @param {string} [cancelLabel] - キャンセルボタンのラベル。未指定なら非表示
 * @returns {Promise<object|boolean>} 保存時は { success: true, data: { id名: 値, ... } }、キャンセル時は false
 */
export function showModal(title, body, saveLabel, cancelLabel) {
  // 返り値の型を Promise<object|boolean> に変更
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
    $body.html(body);

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
      $title.text('');
      $body.html('');
      $modal.addClass('hidden');
      $buttons.addClass('hidden');
      $saveBtn.off('click');
      $cancelBtn.off('click');
      $closeBtn.off('click');
      $modal.off('click.modalOuter');
    };

    // 💡 修正箇所: 保存ボタン → 入力内容を取得し、オブジェクトを返す
    $saveBtn.on('click', () => {
      // 1. $body内にある、idを持つ要素（input, textarea, selectなど）から値を取得
      const formData = {};
      $body.find('[id]').each(function () {
        const $el = $(this);
        const id = $el.attr('id');
        let value;

        // input type="checkbox" の場合は checked 状態を取得
        if ($el.is(':checkbox')) {
          value = $el.prop('checked');
        }
        // input type="radio" の場合は、選択されている要素のみを取得 (同じnameを持つ要素を探す)
        else if ($el.is(':radio')) {
          // ラジオボタンの場合は、同じ name を持つグループ全体から checked なものを探すが、
          // シンプルにIDを持つ要素自体の値を取得する (ここではIDを持つラジオボタンの value を取得)
          // 複数のラジオボタンが同じIDを持つことはないので、このIDの要素がチェックされているかを確認
          if ($el.prop('checked')) {
            value = $el.val();
          } else {
            return; // チェックされていないラジオボタンはスキップ
          }
        }
        // それ以外の要素 (text, number, textarea, select など) は val() を取得
        else {
          value = $el.val();
        }

        formData[id] = value;
      });

      // 2. クリーンアップを実行
      cleanup();

      // 3. 取得したデータと成功フラグをオブジェクトで返す
      resolve({ success: true, data: formData });
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
