import * as utils from '../common/functions.js';

////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  try {
    // ヘッダーなどの初期化
    await utils.initDisplay();

    // ★ ここでカレント表示を実行
    markCurrentPage();

    utils.hideSpinner();
  } catch (e) {}
});

/**
 * 現在のページに基づいてヘッダーのリンクに selected クラスを付与する
 */
export function markCurrentPage() {
  const currentPath = window.location.pathname;

  $('.nav-item').each(function () {
    const href = $(this).attr('href');

    // 1. パスが一致するか、またはHomeの場合でトップディレクトリへの配慮
    // 2. hrefが未設定（"#"）の場合はスキップ
    if (href && href !== '#') {
      // リンクのパスが現在のURLに含まれているか判定
      // (../home/home.html のような相対パスでも判定できるよう endsWith 等を使用)
      if (currentPath.endsWith(href.replace('../', '/'))) {
        $(this).addClass('selected');
      }
    }
  });
}
