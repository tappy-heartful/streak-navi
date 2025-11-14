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
  const isAdmin = utils.getSession('isEventAdmin') === utils.globalStrTrue;

  if (isAdmin) {
    // 新規作成ボタンは日程調整用と今後の予定（出欠受付用）コンテナに表示
    $('#schedule-add-button').show();
    $('#attendance-add-button').show();
  } else {
    $('#schedule-add-button').hide();
    $('#attendance-add-button').hide();
  }

  // 各リスト要素をクリア
  // 変更点: $attendanceList の代わりに $futureList を使用
  const $scheduleList = $('#schedule-list').empty(); // 日程調整中
  const $futureList = $('#future-list').empty(); // 今後の予定（出欠受付中 and 受付なし）
  const $closedList = $('#closed-list').empty(); // 終了

  const eventsRef = utils.collection(utils.db, 'events');
  const qEvent = utils.query(eventsRef, utils.orderBy('date', 'asc'));
  const eventSnap = await utils.getDocs(qEvent);

  if (eventSnap.empty) {
    // 日程調整中も今後の予定もイベントがない場合、空メッセージを表示
    showEmptyMessage($scheduleList);
    return;
  }

  // ステータスごとに配列を分ける
  const scheduleItems = []; // 日程調整中のイベント
  const futureItems = []; // 今後の予定 (出欠受付中 and 受付なし)
  const closedItems = []; // 終了したイベント

  const uid = utils.getSession('uid');

  for (const eventDoc of eventSnap.docs) {
    const eventData = eventDoc.data();
    const eventId = eventDoc.id;
    const eventDate = eventData.date;
    const eventTitle = eventData.title;
    const attendanceType = eventData.attendanceType || 'none'; // none, attendance, schedule

    let status = '';
    let statusClass = '';
    let isClosed = false;
    let displayDate = eventDate;
    let dateIcon = '📅';

    // 日付判定（終了判定）
    if (eventDate) {
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
        isClosed = true;
      }
    }

    if (isClosed) {
      // 終了イベント
      status = '終了';
      statusClass = 'closed';
      closedItems.push(
        makeEventItem(
          eventId,
          displayDate,
          dateIcon,
          eventTitle,
          status,
          statusClass
        )
      );
    } else if (attendanceType === 'schedule') {
      // 日程調整中 (scheduleItemsに分類)
      const answerId = `${eventId}_${uid}`;
      const answerDocRef = utils.doc(utils.db, 'eventAdjustAnswers', answerId);

      displayDate = '日程調整中';
      dateIcon = '🗓️';

      const answerSnap = await utils.getDoc(answerDocRef);

      if (answerSnap.exists()) {
        status = '回答済';
        statusClass = 'answered';
      } else {
        status = '未回答';
        statusClass = 'pending';
      }

      scheduleItems.push(
        makeEventItem(
          eventId,
          displayDate,
          dateIcon,
          eventTitle,
          status,
          statusClass
        )
      );
    } else {
      // 今後の予定 (attendance or none) に分類
      // 変更点: attendanceType === 'none' の場合もここに統合
      status = ''; // デフォルトは空
      statusClass = '';

      if (attendanceType === 'attendance') {
        // 出欠受付中の場合のみ回答状況を判定し、ステータスを表示
        const answerId = `${eventId}_${uid}`;
        const answerDocRef = utils.doc(utils.db, 'eventAnswers', answerId);
        const answerSnap = await utils.getDoc(answerDocRef);

        if (answerSnap.exists()) {
          status = '回答済';
          statusClass = 'answered';
        } else {
          status = '未回答';
          statusClass = 'pending';
        }
      }
      // attendanceType === 'none' の場合は、status/statusClass は空のまま（ラベル非表示）

      futureItems.push(
        makeEventItem(
          eventId,
          displayDate,
          dateIcon,
          eventTitle,
          status,
          statusClass
        )
      );
    }
  }

  // 1. 各コンテナにイベントを追加
  // 日程調整中のイベント
  if (scheduleItems.length > 0) {
    scheduleItems.forEach((item) => $scheduleList.append(item));
  }

  // 今後の予定イベント
  // 変更点: $attendanceList の代わりに $futureList を使用
  if (futureItems.length > 0) {
    futureItems.forEach((item) => $futureList.append(item));
  }

  // どちらのリストも空の場合のみ、空メッセージを表示
  if (scheduleItems.length === 0 && futureItems.length === 0) {
    showEmptyMessage($scheduleList); // どちらか一方のリストに表示すればOK ($scheduleList or $futureList)
  }

  // 2. 終了イベントの処理: イベントが存在しない場合コンテナごと非表示
  if (closedItems.length > 0) {
    closedItems.forEach((item) => $closedList.append(item));
    $('#closed-container').show();
  } else {
    $('#closed-container').hide();
  }
}

// 【修正なし】
function makeEventItem(eventId, date, dateIcon, title, status, statusClass) {
  const statusHtml = status
    ? `<span class="answer-status ${statusClass}">${status}</span>`
    : ''; // ステータスが空ならラベル自体を非表示

  return $(`
    <li>
      <a href="../event-confirm/event-confirm.html?eventId=${eventId}" class="event-link">
        <div class="event-info">
          <span class="event-date">${dateIcon} ${date}</span>
          <span class="event-title">${title}</span>
        </div>
        ${statusHtml}
      </a>
    </li>
  `);
}

function showEmptyMessage($list) {
  $list.append(`
    <li class="empty-message">
      <div class="event-link empty">
        該当のイベントはありません🍀
      </div>
    </li>
  `);
}
