import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    // 画面ごとのパンくずをセット
    utils.renderBreadcrumb([{ title: 'メディア一覧' }]);
    await setUpPage();
  } catch (e) {
    // ログ登録
    await utils.writeLog({
      dataId: 'none',
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    // スピナー非表示
    utils.hideSpinner();
  }
});

async function setUpPage() {
  // 管理者の場合のみ新規登録ボタン表示
  utils.getSession('isMediaAdmin') === utils.globalStrTrue
    ? $('#add-button').show()
    : $('#add-button').hide();

  const $list = $('#media-list').empty();

  const mediasRef = utils.collection(utils.db, 'medias');
  const qMedia = utils.query(mediasRef, utils.orderBy('date', 'desc'));
  const mediaSnap = await utils.getDocs(qMedia);

  if (mediaSnap.empty) {
    showEmptyMessage($list);
    return;
  }

  for (const mediaDoc of mediaSnap.docs) {
    const mediaData = mediaDoc.data();
    const mediaId = mediaDoc.id;

    $list.safeAppend(makeMediaItem(mediaId, mediaData.date, mediaData.title));
  }
}

function makeMediaItem(mediaId, date, title) {
  return $(`
    <li>
      <a href="../media-confirm/media-confirm.html?mediaId=${mediaId}" class="media-link">
        <span class="media-date">📅 ${date}</span>
        <span class="media-title">${title}</span>
      </a>
    </li>
  `);
}

function showEmptyMessage($list) {
  $list.safeAppend(`
    <li class="empty-message">
      <div class="media-link empty">
        該当のメディアはありません🍀
      </div>
    </li>
  `);
}
