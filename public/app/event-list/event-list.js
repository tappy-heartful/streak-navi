import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    // 画面ごとのパンくずをセット
    utils.setBreadcrumb([{ title: '練習・本番一覧' }]);
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
  // 管理者の場合のみ新規登録ボタン表示
  utils.getSession('isEventAdmin') === utils.globalStrTrue
    ? $('#add-button').show()
    : $('#add-button').hide();

  const $list = $('#event-list').empty();

  const eventsRef = utils.collection(utils.db, 'events');
  const qEvent = utils.query(eventsRef, utils.orderBy('date', 'desc'));
  const eventSnap = await utils.getDocs(qEvent);

  if (eventSnap.empty) {
    showEmptyMessage($list);
    return;
  }

  for (const eventDoc of eventSnap.docs) {
    const eventData = eventDoc.data();
    const eventId = eventDoc.id;

    $list.append(makeEventItem(eventId, eventData.date, eventData.title));
  }
}

function makeEventItem(eventId, date, title) {
  return $(`
    <li>
      <a href="../event-confirm/event-confirm.html?eventId=${eventId}" class="event-link">
        <span class="event-date">📅 ${date}</span>
        <span class="event-title">${title}</span>
      </a>
    </li>
  `);
}

function showEmptyMessage($list) {
  $list.append(`
    <li class="empty-message">
      <div class="event-link empty">
        該当の練習・本番はありません🍀
      </div>
    </li>
  `);
}
