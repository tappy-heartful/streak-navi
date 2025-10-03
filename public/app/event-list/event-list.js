import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    // 画面ごとのパンくずをセット
    utils.renderBreadcrumb([{ title: 'イベント一覧' }]);
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
    const eventAttendance = eventData.attendance;

    let status = '';
    let statusClass = '';

    // 日付判定（当日は終了扱いしない）
    const now = new Date(); // 現在の日時
    const todayOnly = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ); // 今日の0:00

    // eventDate は 'yyyy.MM.dd' 形式
    const [year, month, day] = eventDate.split('.').map(Number);
    const eventDateObj = new Date(year, month - 1, day); // JSの月は0始まり

    if (eventDateObj < todayOnly) {
      // 昨日以前
      status = '終了';
      statusClass = 'closed';
      closedItems.push(
        makeEventItem(eventId, eventDate, eventTitle, status, statusClass)
      );
    } else if (!eventAttendance) {
      // 出欠を受け付けていない未来イベント → ラベルなし
      status = '';
      statusClass = '';
      pendingItems.push(
        makeEventItem(eventId, eventDate, eventTitle, status, statusClass)
      );
    } else {
      // 出欠を受け付けている未来イベント
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
  pendingItems.forEach((item) => $list.safeAppend(item));
  answeredItems.forEach((item) => $list.safeAppend(item));
  closedItems.forEach((item) => $list.safeAppend(item));
}

function makeEventItem(eventId, date, title, status, statusClass) {
  const statusHtml = status
    ? `<span class="answer-status ${statusClass}">${status}</span>`
    : ''; // ステータスが空ならラベル自体を非表示

  return $(`
    <li>
      <a href="../event-confirm/event-confirm.html?eventId=${eventId}" class="event-link">
        <div class="event-info">
          <span class="event-date">📅 ${date}</span>
          <span class="event-title">${title}</span>
        </div>
        ${statusHtml}
      </a>
    </li>
  `);
}

function showEmptyMessage($list) {
  $list.safeAppend(`
    <li class="empty-message">
      <div class="event-link empty">
        該当のイベントはありません🍀
      </div>
    </li>
  `);
}
