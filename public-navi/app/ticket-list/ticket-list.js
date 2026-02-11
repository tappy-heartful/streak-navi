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
  const hasFullAccess = utils.isAdmin('Ticket');

  if (ticketArray.length === 0) {
    $tbody.append(
      '<tr><td colspan="6" class="text-center">予約データは見つかりませんでした。</td></tr>',
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

    let customerHtml = '';
    let inviterHtml = '-';
    const maskedRepresentative = t.representativeName || '未設定';
    const maskedCompanions = (t.companions || []).map((c) => c + ' 様');

    if (t.resType === 'invite') {
      customerHtml =
        maskedCompanions.length > 0
          ? maskedCompanions.join('<br>')
          : '(招待客なし)';
      inviterHtml = t.representativeName;
    } else {
      const allCustomers = [maskedRepresentative + ' 様', ...maskedCompanions];
      customerHtml = allCustomers.join('<br>');
      inviterHtml = '-';
    }

    const resTypeText = t.resType === 'invite' ? '招待' : '一般';
    const resTypeClass =
      t.resType === 'invite' ? 'status-invite' : 'status-general';

    totalSum += Number(t.totalCount) || 0;

    // isAdminがtrueの場合のみクリック可能なクラス「clickable-res-no」を付与
    const resNoLink = hasFullAccess
      ? `<a href="javascript:void(0)" class="open-checkin" data-id="${t.id}" style="font-weight:bold; color: #e91e63; text-decoration: underline;">${t.reservationNo || '-'}</a>`
      : `<span style="font-weight:bold;">${t.reservationNo || '-'}</span>`;

    const row = `
      <tr>
        <td class="text-center">
          ${resNoLink}
          <span class="res-type-label ${resTypeClass}">${resTypeText}</span>
        </td>
        <td class="text-center">${t.totalCount || 0} 名</td>
        <td style="line-height: 1.5;">${customerHtml}</td>
        <td>${inviterHtml}</td>
        <td style="font-size: 11px; color: #666;">${createdAt}</td>
        <td style="font-size: 11px; color: #666;">${updatedAt}</td>
      </tr>
    `;
    $tbody.append(row);
  });

  // チェックインモーダルを開くイベント
  $('.open-checkin').on('click', function () {
    const ticketId = $(this).data('id');
    const ticket = tickets.find((t) => t.id === ticketId);
    if (ticket) openCheckInModal(ticket);
  });

  $('#total-count-display').html(
    `該当: ${ticketArray.length}件 <br> 合計人数: ${totalSum}名`,
  );
}

async function openCheckInModal(ticket) {
  utils.showSpinner();
  try {
    // 1. 現在のチェックイン状況を取得（ドキュメントIDも一緒に保持する）
    const checkInsRef = utils.collection(utils.db, 'checkIns');
    const q = utils.query(
      checkInsRef,
      utils.where('ticketId', '==', ticket.id),
    );
    const snap = await utils.getWrapDocs(q);

    // { 名前: docId } の形式で保持しておくと削除が楽
    const currentCheckedMap = {};
    snap.docs.forEach((doc) => {
      currentCheckedMap[doc.data().name] = doc.id;
    });

    let targets = [];
    if (ticket.resType === 'invite') {
      targets = (ticket.companions || []).map((name) => ({
        name,
        type: '招待客',
      }));
    } else {
      targets.push({ name: ticket.representativeName, type: '代表者' });
      (ticket.companions || []).forEach((name) => {
        targets.push({ name, type: '同行者' });
      });
    }

    utils.hideSpinner();

    // 2. モーダルHTML生成
    let modalBody = `
      <div class="checkin-container">
        <p style="margin-bottom: 15px; font-size: 0.9em; color: #666;">
          予約番号: <strong>${ticket.reservationNo}</strong>
        </p>
        <div class="checkin-list" style="display: flex; flex-direction: column; gap: 10px;">
    `;

    targets.forEach((target, index) => {
      const isChecked = !!currentCheckedMap[target.name];
      const checkboxId = `checkin_${index}`;
      const checkedAttr = isChecked ? 'checked' : '';

      modalBody += `
        <label style="display: flex; align-items: center; padding: 12px; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; background: #fff;">
          <input type="checkbox" id="${checkboxId}" value="${target.name}" style="width: 20px; height: 20px; margin-right: 10px;" ${checkedAttr}>
          <div>
            <span style="font-weight: bold;">${target.name} 様</span>
            <span style="display: block; font-size: 0.75em; color: #888;">${target.type}</span>
          </div>
          ${isChecked ? '<span style="margin-left: auto; color: #4caf50; font-size: 0.8em;" class="status-badge"><i class="fas fa-check-circle"></i> 済み</span>' : ''}
        </label>
      `;
    });
    modalBody += '</div></div>';

    const result = await utils.showModal(
      `チェックイン確認`,
      modalBody,
      '決定',
      '閉じる',
    );

    if (result && result.success) {
      utils.showSpinner();
      const promises = [];

      targets.forEach((target, index) => {
        const checkboxId = `checkin_${index}`;
        const isNowChecked = result.data[checkboxId] === true;
        const existingDocId = currentCheckedMap[target.name];

        if (isNowChecked && !existingDocId) {
          // ★ 新しくチェックされた場合：追加
          promises.push(
            utils.addDoc(utils.collection(utils.db, 'checkIns'), {
              ticketId: ticket.id,
              reservationNo: ticket.reservationNo,
              liveId: ticket.liveId,
              name: target.name,
              createdAt: utils.serverTimestamp(),
            }),
          );
        } else if (!isNowChecked && existingDocId) {
          // ★ チェックが外された場合：削除
          const docRef = utils.doc(utils.db, 'checkIns', existingDocId);
          promises.push(utils.deleteDoc(docRef));
        }
      });

      if (promises.length > 0) {
        await Promise.all(promises);
        utils.showDialog('チェックイン情報を更新しました');
      }
      utils.hideSpinner();
    }
  } catch (e) {
    utils.hideSpinner();
    console.error(e);
    utils.showDialog('更新に失敗しました', true);
  }
}
