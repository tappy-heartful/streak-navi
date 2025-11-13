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
    // 新規作成ボタンは日程調整用と出欠受付中のコンテナにのみ表示
    $('#schedule-add-button').show();
    $('#attendance-add-button').show();
  } else {
    $('#schedule-add-button').hide();
    $('#attendance-add-button').hide();
  }

  // 各リスト要素をクリア
  const $scheduleList = $('#schedule-list').empty();
  const $attendanceList = $('#attendance-list').empty();
  const $closedList = $('#closed-list').empty();

  const eventsRef = utils.collection(utils.db, 'events');
  const qEvent = utils.query(eventsRef, utils.orderBy('date', 'desc'));
  const eventSnap = await utils.getDocs(qEvent);

  if (eventSnap.empty) {
    // 全イベントがない場合、全リストにメッセージを表示（または非表示）
    showEmptyMessage($scheduleList);
    return;
  }

  // ステータスごとに配列を分ける
  const scheduleItems = []; // 日程調整中のイベント
  const attendanceItems = []; // 出欠受付中のイベント
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
    } else if (attendanceType === 'none') {
      // 回答を受け付けていない未来イベント (日程調整中コンテナに追加)
      status = '';
      statusClass = '';
      // attendanceType='none'のものは、便宜上、日程調整中のリストに追加
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
      // 回答を受け付けている未来イベント (attendance or schedule)
      const answerId = `${eventId}_${uid}`;
      let answerDocRef;

      if (attendanceType === 'schedule') {
        // 日程調整中 (scheduleItemsに分類)
        answerDocRef = utils.doc(utils.db, 'eventAdjustAnswers', answerId);
        displayDate = '日程調整中';
        dateIcon = '🗓️';
      } else {
        // 出欠受付中 (attendanceItemsに分類)
        answerDocRef = utils.doc(utils.db, 'eventAnswers', answerId);
        // displayDate, dateIcon は初期値のまま
      }

      const answerSnap = await utils.getDoc(answerDocRef);

      if (answerSnap.exists()) {
        status = '回答済';
        statusClass = 'answered';
      } else {
        status = '未回答';
        statusClass = 'pending';
      }

      // 回答タイプに応じて分類
      const item = makeEventItem(
        eventId,
        displayDate,
        dateIcon,
        eventTitle,
        status,
        statusClass
      );

      if (attendanceType === 'schedule') {
        scheduleItems.push(item);
      } else {
        attendanceItems.push(item);
      }
    }
  }

  // 1. 各コンテナにイベントを追加
  // 日程調整中のイベント
  if (scheduleItems.length > 0) {
    scheduleItems.forEach((item) => $scheduleList.append(item));
  } else if ($attendanceList.is(':empty')) {
    // 他のリストも空の場合のみ空メッセージを表示
    showEmptyMessage($scheduleList);
  }

  // 出欠受付中のイベント
  if (attendanceItems.length > 0) {
    attendanceItems.forEach((item) => $attendanceList.append(item));
  }

  // 2. 終了イベントの処理: イベントが存在しない場合コンテナごと非表示
  if (closedItems.length > 0) {
    closedItems.forEach((item) => $closedList.append(item));
    $('#closed-container').show(); // 存在する場合は表示（CSSで初期非表示にしておくことを推奨）
  } else {
    $('#closed-container').hide(); // 存在しない場合はコンテナごと非表示
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
