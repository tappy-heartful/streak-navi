import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    // ログイン中のアイコン反映
    const picUrl = utils.getSession('pictureUrl');
    if (picUrl) {
      $('#header-icon-img').attr('src', picUrl);
    }

    markCurrentPage();
    utils.hideSpinner();
  } catch (e) {
    console.error('Header initialization error:', e);
  }
});

/**
 * 現在のページに基づいてヘッダーのリンクに selected クラスを付与する
 */
export function markCurrentPage() {
  const currentPath = window.location.pathname;

  $('.nav-item').each(function () {
    const href = $(this).attr('href');
    if (href && href !== '#') {
      // パスの一致判定（../home/home.html 等に対応）
      const normalizedHref = href.replace('../', '/');
      if (currentPath.endsWith(normalizedHref)) {
        $(this).addClass('selected');
      }
    }
  });
}
