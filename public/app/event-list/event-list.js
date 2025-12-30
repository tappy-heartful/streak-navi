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

  $('.list-add-button').toggle(isAdmin);

  const $scheduleTbody = $('#schedule-tbody').empty();
  const $futureTbody = $('#future-tbody').empty();
  const $closedTbody = $('#closed-tbody').empty();

  const eventsRef = utils.collection(utils.db, 'events');
  const qEvent = utils.query(eventsRef, utils.orderBy('date', 'asc'));
  const eventSnap = await utils.getWrapDocs(qEvent);

  const now = new Date();
  const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const eventDoc of eventSnap.docs) {
    const eventData = eventDoc.data();
    const eventId = eventDoc.id;
    const eventDate = eventData.date;
    const attendanceType = eventData.attendanceType || 'attendance';

    let isClosed = false;
    if (eventDate) {
      const [year, month, day] = eventDate.split('.').map(Number);
      const eventDateObj = new Date(year, month - 1, day);
      if (eventDateObj < todayOnly) isClosed = true;
    }

    if (isClosed) {
      // 終了イベントには固定で「終了」ステータスを渡す
      const statusInfo = { text: '終了', class: 'closed' };
      $closedTbody.append(
        makeEventRow(eventId, eventData, 'closed', statusInfo)
      );
    } else if (attendanceType === 'schedule') {
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

  checkEmpty($scheduleTbody, 7);
  checkEmpty($futureTbody, 7);
  // 終了テーブルの空チェック（列数は5列）
  if ($closedTbody.children().length === 0) {
    $('#closed-container').hide();
  } else {
    $('#closed-container').show();
  }
}

async function getAnswerStatus(eventId, uid, collectionName, eventData) {
  const isInTerm =
    collectionName === 'eventAdjustAnswers'
      ? utils.isInTerm(eventData.acceptStartDate, eventData.acceptEndDate)
      : true;

  if (!eventData.isAcceptingResponses || !isInTerm) {
    return { text: '期間外', class: 'closed' };
  }

  const answerRef = utils.doc(utils.db, collectionName, `${eventId}_${uid}`);
  const answerSnap = await utils.getWrapDoc(answerRef);

  return answerSnap.exists()
    ? { text: '回答済', class: 'answered' }
    : { text: '未回答', class: 'pending' };
}

function makeEventRow(eventId, data, type, statusInfo = null) {
  const url = `../event-confirm/event-confirm.html?eventId=${eventId}`;

  // 日付・期間
  const dateDisplay = data.date
    ? `${data.date}(${utils.getDayOfWeek(data.date, true)})`
    : '-';
  const termDisplay = `${data.acceptStartDate || ''} ～ <br> ${
    data.acceptEndDate || ''
  }`;

  // ステータス
  const statusHtml = statusInfo
    ? `<td><span class="answer-status ${statusInfo.class}">${statusInfo.text}</span></td>`
    : '';

  // 場所 (websiteがある場合はリンク)
  const placeHtml = data.website
    ? `<td><a href="${
        data.website
      }" target="_blank" rel="noopener noreferrer">${
        data.placeName || 'リンク'
      }</a></td>`
    : `<td>${data.placeName || '-'}</td>`;

  // アクセス (アイコン: fa-train)
  const accessHtml =
    data.access && data.access.startsWith('http')
      ? `<td><a href="${data.access}" target="_blank" rel="noopener noreferrer"><i class="fas fa-train fa-fw"></i>アクセス</a></td>`
      : `<td>-</td>`;

  // Map (アイコン: fa-map-marker-alt)
  const mapHtml = data.googleMap
    ? `<td><a href="${data.googleMap}" target="_blank" rel="noopener noreferrer"><i class="fas fa-map-marker-alt fa-fw"></i>Map</a></td>`
    : `<td>-</td>`;

  // 譜割り (アイコン: fa-file-alt)
  const assignHtml = data.allowAssign
    ? `<td><a href="../assign-confirm/assign-confirm.html?eventId=${eventId}"><i class="fas fa-file-alt fa-fw"></i>譜割り</a></td>`
    : `<td>-</td>`;

  if (type === 'schedule') {
    return `
      <tr>
        <td><a href="${url}" class="table-link">${data.title}</a></td>
        <td class="text-small">${termDisplay}</td>
        ${statusHtml}
        ${placeHtml}
        ${accessHtml}
        ${mapHtml}
        ${assignHtml}
      </tr>`;
  } else if (type === 'future') {
    return `
      <tr>
        <td><a href="${url}" class="table-link">${data.title}</a></td>
        <td class="text-small">${dateDisplay}</td>
        ${statusHtml}
        ${placeHtml}
        ${accessHtml}
        ${mapHtml}
        ${assignHtml}
      </tr>`;
  } else {
    // 終了分 (状況を追加。アクセス、マップは表示しない設定を維持)
    return `
      <tr>
        <td><a href="${url}" class="table-link">${data.title}</a></td>
        <td class="text-small">${dateDisplay}</td>
        ${statusHtml}
        ${placeHtml}
        ${assignHtml}
      </tr>`;
  }
}

function checkEmpty($tbody, colspan) {
  if ($tbody.children().length === 0) {
    $tbody.append(
      `<tr><td colspan="${colspan}" class="empty-message">該当のイベントはありません🍀</td></tr>`
    );
  }
}
