import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
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

    $list.append(makeMediaItem(mediaId, mediaData.date, mediaData.title));
  }
}

function makeMediaItem(mediaId, date, title) {
  return $(`
    <li>
      <div class="media-link">
        <span class="media-date">📅 ${date}</span>
        <span class="media-title">${title}</span>
      </div>
    </li>
  `);
}

function showEmptyMessage($list) {
  $list.append(`
    <li class="empty-message">
      <div class="media-link empty">
        該当のメディアはありません🍀
      </div>
    </li>
  `);
}
