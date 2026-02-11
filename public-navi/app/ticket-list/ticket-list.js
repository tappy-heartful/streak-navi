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

  const maskName = (name) => {
    if (!name || hasFullAccess) return name;
    if (name.length <= 1) return name;
    return name.substring(0, 1) + '*'.repeat(name.length - 1);
  };

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
    const maskedRepresentative = maskName(t.representativeName || '未設定');
    const maskedCompanions = (t.companions || []).map(
      (c) => maskName(c) + ' 様',
    );

    if (t.resType === 'invite') {
      customerHtml =
        maskedCompanions.length > 0
          ? maskedCompanions.join('<br>')
          : '(同行者なし)';
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

  $('#total-count-display').text(
    `該当: ${ticketArray.length}件 / 合計人数: ${totalSum}名`,
  );
}

/**
 * チェックインモーダル
 */
async function openCheckInModal(ticket) {
  utils.showSpinner();
  try {
    const checkInsRef = utils.collection(utils.db, 'checkIns');
    const q = utils.query(
      checkInsRef,
      utils.where('ticketId', '==', ticket.id),
    );
    const snap = await utils.getWrapDocs(q);
    const checkedNames = snap.docs.map((doc) => doc.data().name);

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

    let modalBody = `
      <div class="checkin-container">
        <p style="margin-bottom: 15px; font-size: 0.9em; color: #666;">
          予約番号: <strong>${ticket.reservationNo}</strong>
        </p>
        <div class="checkin-list" style="display: flex; flex-direction: column; gap: 10px;">
    `;

    targets.forEach((target, index) => {
      const isChecked = checkedNames.includes(target.name);
      const disabled = isChecked ? 'checked disabled' : '';
      // ★ 修正ポイント: 全てのチェックボックスに id を付与 (checkin_0, checkin_1...)
      const checkboxId = `checkin_${index}`;

      modalBody += `
        <label style="display: flex; align-items: center; padding: 12px; border: 1px solid #ddd; border-radius: 8px; background: ${isChecked ? '#f9f9f9' : '#fff'};">
          <input type="checkbox" id="${checkboxId}" value="${target.name}" style="width: 20px; height: 20px; margin-right: 10px;" ${disabled}>
          <div>
            <span style="font-weight: bold;">${target.name} 様</span>
            <span style="display: block; font-size: 0.75em; color: #888;">${target.type}</span>
          </div>
          ${isChecked ? '<span style="margin-left: auto; color: #4caf50; font-size: 0.8em;"><i class="fas fa-check-circle"></i> 済み</span>' : ''}
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

    // --- 💡 取得ロジックの修正 ---
    if (result && result.success) {
      // result.data は { "checkin_0": true, "checkin_1": false, ... } という形式で返ってくる
      const selectedNames = [];

      targets.forEach((target, index) => {
        const checkboxId = `checkin_${index}`;
        // 新しくチェックが入った（もともとチェック済みでdisabledなものは除外される）ものを抽出
        if (result.data[checkboxId] === true) {
          // すでにチェック済みだった人は対象外にする（念のため）
          if (!checkedNames.includes(target.name)) {
            selectedNames.push(target.name);
          }
        }
      });

      if (selectedNames.length === 0) {
        return; // 何も選択されなかったら終了
      }

      utils.showSpinner();
      const batch = selectedNames.map((name) => {
        return utils.addDoc(utils.collection(utils.db, 'checkIns'), {
          ticketId: ticket.id,
          reservationNo: ticket.reservationNo,
          liveId: ticket.liveId,
          name: name,
          createdAt: utils.serverTimestamp(),
        });
      });

      await Promise.all(batch);
      utils.hideSpinner();
      utils.showDialog('チェックインを記録しました');
    }
  } catch (e) {
    utils.hideSpinner();
    console.error(e);
    utils.showDialog('チェックイン処理に失敗しました', true);
  }
}
