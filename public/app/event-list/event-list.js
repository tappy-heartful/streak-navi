import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    utils.renderBreadcrumb([{ title: 'イベント一覧' }]);
    await setUpPage();
  } catch (e) {
    await utils.writeLog({
      dataId: 'none',
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

async function setUpPage() {
  const isAdmin = utils.isAdmin('Event');
  const uid = utils.getSession('uid');

  // ボタン制御
  $('.list-add-button').toggle(isAdmin);

  // 各テーブルボディをクリア
  const $scheduleTbody = $('#schedule-tbody').empty();
  const $futureTbody = $('#future-tbody').empty();
  const $closedTbody = $('#closed-tbody').empty();

  // イベント取得
  const eventsRef = utils.collection(utils.db, 'events');
  const qEvent = utils.query(eventsRef, utils.orderBy('date', 'asc'));
  const eventSnap = await utils.getWrapDocs(qEvent);

  const now = new Date();
  const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const eventDoc of eventSnap.docs) {
    const eventData = eventDoc.data();
    const eventId = eventDoc.id;
    const eventTitle = eventData.title;
    const eventDate = eventData.date; // yyyy.MM.dd
    const attendanceType = eventData.attendanceType || 'attendance';
    const isAcceptingResponses = eventData.isAcceptingResponses;

    let isClosed = false;
    if (eventDate) {
      const [year, month, day] = eventDate.split('.').map(Number);
      const eventDateObj = new Date(year, month - 1, day);
      if (eventDateObj < todayOnly) isClosed = true;
    }

    if (isClosed) {
      // --- 終了したイベント ---
      $closedTbody.append(makeEventRow(eventId, eventData, 'closed'));
    } else if (attendanceType === 'schedule') {
      // --- 日程調整中 ---
      const statusInfo = await getAnswerStatus(
        eventId,
        uid,
        'eventAdjustAnswers',
        eventData
      );
      $scheduleTbody.append(
        makeEventRow(eventId, eventData, 'schedule', statusInfo)
      );
    } else {
      // --- 今後の予定 (出欠確認) ---
      const statusInfo = await getAnswerStatus(
        eventId,
        uid,
        'eventAttendanceAnswers',
        eventData
      );
      $futureTbody.append(
        makeEventRow(eventId, eventData, 'future', statusInfo)
      );
    }
  }

  // 0件判定
  checkEmpty($scheduleTbody, 2);
  checkEmpty($futureTbody, 3);
  if ($closedTbody.children().length === 0) {
    $('#closed-container').hide();
  } else {
    $('#closed-container').show();
  }
}

/**
 * 回答状況の取得
 */
async function getAnswerStatus(eventId, uid, collectionName, eventData) {
  // 受付期間外または受付停止中か
  const isInTerm =
    collectionName === 'eventAdjustAnswers'
      ? utils.isInTerm(eventData.acceptStartDate, eventData.acceptEndDate)
      : true;

  if (!eventData.isAcceptingResponses || !isInTerm) {
    return { text: '停止中', class: 'closed' };
  }

  const answerRef = utils.doc(utils.db, collectionName, `${eventId}_${uid}`);
  const answerSnap = await utils.getWrapDoc(answerRef);

  if (answerSnap.exists()) {
    return { text: '回答済', class: 'answered' };
  } else {
    return { text: '未回答', class: 'pending' };
  }
}

/**
 * テーブル行の生成
 */
function makeEventRow(eventId, data, type, statusInfo = null) {
  const url = `../event-confirm/event-confirm.html?eventId=${eventId}`;
  const dateDisplay = data.date
    ? `${data.date}(${utils.getDayOfWeek(data.date, true)})`
    : '-';
  const statusHtml = statusInfo
    ? `<td><span class="answer-status ${statusInfo.class}">${statusInfo.text}</span></td>`
    : '';

  if (type === 'schedule') {
    // 日程調整は日付列なし
    return `
      <tr>
        <td><a href="${url}" class="table-link">${data.title}</a></td>
        ${statusHtml}
      </tr>`;
  } else if (type === 'future') {
    return `
      <tr>
        <td class="text-small">${dateDisplay}</td>
        <td><a href="${url}" class="table-link">${data.title}</a></td>
        ${statusHtml}
      </tr>`;
  } else {
    // 終了
    return `
      <tr>
        <td class="text-small">${dateDisplay}</td>
        <td><a href="${url}" class="table-link">${data.title}</a></td>
      </tr>`;
  }
}

/**
 * 空メッセージの表示
 */
function checkEmpty($tbody, colspan) {
  if ($tbody.children().length === 0) {
    $tbody.append(
      `<tr><td colspan="${colspan}" class="empty-message">該当のイベントはありません🍀</td></tr>`
    );
  }
}
