export function showModal(title, body) {
  const $modal = $('.modal');
  const $title = $modal.find('.modal-title');
  const $body = $modal.find('.modal-body');

  // タイトルと本文をセット
  $title.text(title);
  $body.html(body);

  // 表示
  $modal.removeClass('hidden');

  // --- モーダルが閉じられるまで待つ Promise ---
  const closed = new Promise((resolve) => {
    const close = () => {
      $modal.addClass('hidden');
      $(document).off('click.modalClose');
      resolve(true);
    };

    // 閉じるボタン
    $(document).on('click.modalClose', '.modal-close', close);

    // 外側クリック
    $(document).on('click.modalClose', '.modal', function (e) {
      if ($(e.target).hasClass('modal')) {
        close();
      }
    });
  });

  return { closed };
}
