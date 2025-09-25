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

  // ステータスごとに配列を分ける
  const pendingItems = [];
  const answeredItems = [];
  const closedItems = [];

  for (const eventDoc of eventSnap.docs) {
    const eventData = eventDoc.data();
    const eventId = eventDoc.id;
    const eventDate = eventData.date;
    const eventTitle = eventData.title;

    let status = '';
    let statusClass = '';

    // 日付判定
    const today = new Date().toISOString().split('T')[0]; // yyyy-mm-dd 形式
    if (eventDate < today) {
      status = '終了';
      statusClass = 'closed';
      closedItems.push(
        makeEventItem(eventId, eventDate, eventTitle, status, statusClass)
      );
    } else {
      // 回答チェック
      const answerId = `${eventId}_${utils.getSession('uid')}`;
      const answerDocRef = utils.doc(utils.db, 'eventAnswers', answerId);
      const answerSnap = await utils.getDoc(answerDocRef);

      if (answerSnap.exists()) {
        status = '回答済';
        statusClass = 'answered';
        answeredItems.push(
          makeEventItem(eventId, eventDate, eventTitle, status, statusClass)
        );
      } else {
        status = '未回答';
        statusClass = 'pending';
        pendingItems.push(
          makeEventItem(eventId, eventDate, eventTitle, status, statusClass)
        );
      }
    }
  }

  // 表示順: 未回答 → 回答済 → 終了
  pendingItems.forEach((item) => $list.append(item));
  answeredItems.forEach((item) => $list.append(item));
  closedItems.forEach((item) => $list.append(item));
}

function makeEventItem(eventId, date, title, status, statusClass) {
  return $(`
    <li>
      <a href="../event-confirm/event-confirm.html?eventId=${eventId}" class="event-link">
        <div class="event-info">
          <span class="event-date">📅 ${date}</span>
          <span class="event-title">${title}</span>
        </div>
        <span class="answer-status ${statusClass}">${status}</span>
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
