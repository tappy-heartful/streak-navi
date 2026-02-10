import * as utils from '../common/functions.js';

let tickets = []; // 全予約データ
let lives = []; // 全ライブデータ

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    utils.renderBreadcrumb([{ title: '予約者一覧' }]);
    await setUpPage();
  } catch (e) {
    console.error(e);
    await utils.writeLog({
      dataId: 'none',
      action: '予約者一覧初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

async function setUpPage() {
  utils.showSpinner();

  const livesRef = utils.collection(utils.db, 'lives');
  const liveSnap = await utils.getWrapDocs(
    utils.query(livesRef, utils.orderBy('date', 'desc')),
  );
  lives = liveSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  const $liveSelect = $('#live-filter-select');
  const today = utils.format(new Date(), 'yyyy.MM.dd');
  let closestLiveId = '';

  const futureLives = lives
    .filter((l) => l.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (futureLives.length > 0) {
    closestLiveId = futureLives[0].id;
  }

  lives.forEach((l) => {
    const isSelected = l.id === closestLiveId ? 'selected' : '';
    $liveSelect.append(
      `<option value="${l.id}" ${isSelected}>${l.date} ${l.title}</option>`,
    );
  });

  const ticketsRef = utils.collection(utils.db, 'tickets');
  const ticketSnap = await utils.getWrapDocs(ticketsRef);
  tickets = ticketSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  $('#search-res-no, #search-name, #live-filter-select').on(
    'input change',
    () => {
      filterTickets();
    },
  );

  $('#clear-button').on('click', () => {
    $('#search-res-no').val('');
    $('#search-name').val('');
    $('#live-filter-select').val(closestLiveId);
    filterTickets();
  });

  filterTickets();
}

function filterTickets() {
  const resNoKeyword = $('#search-res-no').val().trim();
  const nameKeyword = $('#search-name').val().toLowerCase();
  const selectedLiveId = $('#live-filter-select').val();

  let filtered = tickets.filter((t) => {
    const matchResNo =
      !resNoKeyword ||
      (t.reservationNo && t.reservationNo.includes(resNoKeyword));
    const matchName =
      !nameKeyword ||
      (t.representativeName &&
        t.representativeName.toLowerCase().includes(nameKeyword));
    const matchLive = !selectedLiveId || t.liveId === selectedLiveId;
    return matchResNo && matchName && matchLive;
  });

  filtered.sort((a, b) => {
    const noA = parseInt(a.reservationNo) || 0;
    const noB = parseInt(b.reservationNo) || 0;
    return noA - noB;
  });

  renderTickets(filtered);
}

function renderTickets(ticketArray) {
  const $tbody = $('#ticket-table-body').empty();
  let totalSum = 0;

  if (ticketArray.length === 0) {
    $tbody.append(
      '<tr><td colspan="7" class="text-center">予約データは見つかりませんでした。</td></tr>',
    );
    $('#total-count-display').text('該当: 0件 / 合計人数: 0名');
    return;
  }

  ticketArray.forEach((t) => {
    const createdAt = t.createdAt
      ? utils.format(t.createdAt, 'yyyy/MM/dd HH:mm')
      : '-';
    const updatedAt = t.updatedAt
      ? utils.format(t.updatedAt, 'yyyy/MM/dd HH:mm')
      : '-';

    // 同伴者リストの処理
    const companionsHtml =
      Array.isArray(t.companions) && t.companions.length > 0
        ? t.companions.join('<br>')
        : '-';

    // 予約種別
    const resTypeText = t.resType === 'invite' ? '招待予約' : '一般予約';
    const resTypeClass =
      t.resType === 'invite' ? 'status-invite' : 'status-general';

    totalSum += Number(t.totalCount) || 0;

    const row = `
      <tr>
        <td class="text-center">
          <a href="../ticket-confirm/ticket-confirm.html?ticketId=${t.id}" style="font-weight:bold;">
            ${t.reservationNo || '-'}
          </a>
        </td>
        <td>${t.representativeName || '未設定'}</td>
        <td style="font-size: 12px; line-height: 1.4;">${companionsHtml}</td>
        <td class="text-center">${t.totalCount || 0} 名</td>
        <td class="text-center"><span class="res-type-label ${resTypeClass}">${resTypeText}</span></td>
        <td style="font-size: 11px; color: #666;">${createdAt}</td>
        <td style="font-size: 11px; color: #666;">${updatedAt}</td>
      </tr>
    `;
    $tbody.append(row);
  });

  $('#total-count-display').text(
    `該当: ${ticketArray.length}件 / 合計人数: ${totalSum}名`,
  );
}
