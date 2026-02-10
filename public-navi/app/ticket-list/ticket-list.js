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

  // 1. ライブ一覧を取得（プルダウン用）
  const livesRef = utils.collection(utils.db, 'lives');
  const liveSnap = await utils.getWrapDocs(
    utils.query(livesRef, utils.orderBy('date', 'desc')),
  );
  lives = liveSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  const $liveSelect = $('#live-filter-select');
  const today = utils.format(new Date(), 'yyyy.MM.dd');
  let closestLiveId = '';

  // 直近のライブ（今日以降で最も日付が近いもの）を探す
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

  // 2. 予約データを全取得（本来はクエリ制限すべきですが、検索仕様に基づき全取得してフィルタリング）
  const ticketsRef = utils.collection(utils.db, 'tickets');
  const ticketSnap = await utils.getWrapDocs(ticketsRef);
  tickets = ticketSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // イベント登録
  $('#search-res-no, #search-name, #live-filter-select').on(
    'input change',
    () => {
      filterTickets();
    },
  );

  $('#clear-button').on('click', () => {
    $('#search-res-no').val('');
    $('#search-name').val('');
    $('#live-filter-select').val(closestLiveId); // クリア時は直近ライブに戻す
    filterTickets();
  });

  // 初期表示
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

  // 予約番号順（昇順）にソート
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
      '<tr><td colspan="5" class="text-center">予約データは見つかりませんでした。</td></tr>',
    );
    $('#total-count-display').text('該当: 0件 / 合計人数: 0名');
    return;
  }

  ticketArray.forEach((t) => {
    const live = lives.find((l) => l.id === t.liveId);
    const liveTitle = live ? live.title : '不明なライブ';

    // --- 日付変換の安全な処理 ---
    let createdAt = '-';
    if (t.createdAt) {
      let dateObj;
      if (typeof t.createdAt.toDate === 'function') {
        // 通常のTimestamp型の場合
        dateObj = t.createdAt.toDate();
      } else if (t.createdAt.seconds) {
        // 単純なオブジェクト（{seconds, nanoseconds}）の場合
        dateObj = new Date(t.createdAt.seconds * 1000);
      } else if (t.createdAt instanceof Date) {
        // すでにDateオブジェクトの場合
        dateObj = t.createdAt;
      }

      if (dateObj) {
        createdAt = utils.format(dateObj, 'yyyy/MM/dd HH:mm');
      }
    }
    // --------------------------

    totalSum += Number(t.totalCount) || 0;

    const row = `
      <tr>
        <td class="text-center" style="font-weight:bold;">${t.reservationNo || '-'}</td>
        <td>
          <a href="../ticket-confirm/ticket-confirm.html?ticketId=${t.id}">
            ${t.representativeName || '未設定'} 様
          </a>
        </td>
        <td class="text-center">${t.totalCount || 0} 名</td>
        <td style="font-size: 12px;">${liveTitle}</td>
        <td style="font-size: 12px; color: #666;">${createdAt}</td>
      </tr>
    `;
    $tbody.append(row);
  });

  $('#total-count-display').text(
    `該当: ${ticketArray.length}件 / 合計人数: ${totalSum}名`,
  );
}
