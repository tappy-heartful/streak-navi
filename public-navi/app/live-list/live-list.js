import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    utils.renderBreadcrumb([{ title: 'ライブ一覧' }]);
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
  const isAdmin = utils.isAdmin('Live');
  // 予約状況を確認する場合はUIDが必要（必要に応じて使用）
  // const uid = utils.getSession('uid');

  $('.list-add-button').toggle(isAdmin);

  const $futureTbody = $('#future-tbody').empty();
  const $closedTbody = $('#closed-tbody').empty();

  // livesコレクションを参照
  const livesRef = utils.collection(utils.db, 'lives');
  const qLive = utils.query(livesRef, utils.orderBy('date', 'asc'));
  const liveSnap = await utils.getWrapDocs(qLive);

  const now = new Date();
  const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const closedLives = [];
  const futureLives = [];

  liveSnap.forEach((doc) => {
    const data = doc.data();
    const id = doc.id;
    const liveDate = data.date;

    let isClosed = false;
    if (liveDate) {
      const [year, month, day] = liveDate.split('.').map(Number);
      const liveDateObj = new Date(year, month - 1, day);
      if (liveDateObj < todayOnly) isClosed = true;
    }

    if (isClosed) {
      closedLives.push({ id, data });
    } else {
      futureLives.push({ id, data });
    }
  });

  // --- 今後の予定の描画 ---
  futureLives.forEach((item) => {
    const statusInfo = getReserveStatus(item.data);
    $futureTbody.append(makeLiveRow(item.id, item.data, 'future', statusInfo));
  });

  // --- 終了ライブの描画 (降順) ---
  closedLives.sort((a, b) =>
    (b.data.date || '').localeCompare(a.data.date || ''),
  );
  const closedStatus = { text: '終了', class: 'closed' };
  closedLives.forEach((item) => {
    $closedTbody.append(
      makeLiveRow(item.id, item.data, 'closed', closedStatus),
    );
  });

  // 今後の予定 空判定 (列数に合わせて調整: 今回は8列想定)
  checkEmpty($futureTbody, 8);

  // 終了分 表示制御
  if (closedLives.length === 0) {
    $('#closed-container').hide();
  } else {
    $('#closed-container').show();
  }
}

/**
 * 予約受付状況の判定
 */
function getReserveStatus(data) {
  if (!data.isAcceptReserve) {
    return { text: '予約対象外', class: 'closed' };
  }

  const isInTerm = utils.isInTerm(data.acceptStartDate, data.acceptEndDate);
  if (!isInTerm) {
    return { text: '期間外', class: 'closed' };
  }

  // 残数チェック
  const stock = Number(data.ticketStock) || 0;
  const reserved = Number(data.totalReserved) || 0;
  if (stock > 0 && reserved >= stock) {
    return { text: '満席', class: 'closed' };
  }

  return { text: '受付中', class: 'answered' };
}

/**
 * 行のHTML生成
 */
function makeLiveRow(liveId, data, type, statusInfo = null) {
  // 詳細画面へのリンク（ファイル名は適宜調整してください）
  const url = `../live-confirm/live-confirm.html?liveId=${liveId}`;

  const dateDisplay = data.date
    ? `${data.date}(${utils.getDayOfWeek(data.date, true)})`
    : '-';

  const timeDisplay =
    data.open || data.start
      ? `${data.open || '--:--'} / ${data.start || '--:--'}`
      : '-';

  const priceHtml = `
    <td class="text-small">
      前: ${data.advance || '-'}<br>
      当: ${data.door || '-'}
    </td>`;

  const statusHtml = statusInfo
    ? `<td><span class="answer-status ${statusInfo.class}">${statusInfo.text}</span></td>`
    : '';

  const venueHtml = data.venueUrl
    ? `<td><a href="${data.venueUrl}" target="_blank" rel="noopener noreferrer">${data.venue || '会場サイト'}</a></td>`
    : `<td>${data.venue || '-'}</td>`;

  const mapHtml = data.venueGoogleMap
    ? `<td><a href="${data.venueGoogleMap}" target="_blank" rel="noopener noreferrer"><i class="fas fa-map-marker-alt fa-fw"></i>Map</a></td>`
    : `<td>-</td>`;

  // ライブ一覧では「フライヤー」へのリンクを入れる例
  const flyerHtml = data.flyerUrl
    ? `<td><a href="${data.flyerUrl}" target="_blank" rel="noopener noreferrer"><i class="fas fa-image fa-fw"></i>画像</a></td>`
    : `<td>-</td>`;

  if (type === 'future') {
    return `
      <tr>
        <td><a href="${url}" class="table-link">${data.title}</a></td>
        <td class="text-small">${dateDisplay}</td>
        <td class="text-small">${timeDisplay}</td>
        ${venueHtml}
        ${priceHtml}
        ${statusHtml}
        ${mapHtml}
        ${flyerHtml}
      </tr>`;
  } else {
    // 終了分（項目を少し絞る）
    return `
      <tr>
        <td><a href="${url}" class="table-link">${data.title}</a></td>
        <td class="text-small">${dateDisplay}</td>
        ${venueHtml}
        ${priceHtml}
        <td><span class="answer-status closed">終了</span></td>
        ${flyerHtml}
      </tr>`;
  }
}

function checkEmpty($tbody, colspan) {
  if ($tbody.children().length === 0) {
    $tbody.append(
      `<tr><td colspan="${colspan}" class="empty-message">該当のライブはありません🍀</td></tr>`,
    );
  }
}
