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

  if (utils.isAdmin('Ticket')) {
    const $cameraBtn = $(
      `<button type="button" class="btn-qr-scan">
        <i class="fas fa-camera"></i>
        <span>QRスキャン</span>
      </button>`,
    );

    $cameraBtn.on('click', openCameraModal);
    $('#admin-camera-btn-placeholder').append($cameraBtn);
  }

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

  $('#search-button').on('click', () => {
    fetchAndRenderTickets();
  });

  $('#clear-button').on('click', () => {
    $('#search-res-no').val('');
    $('#search-name').val('');
    $('#live-filter-select').val(closestLiveId);
    fetchAndRenderTickets();
  });

  fetchAndRenderTickets();
}

async function fetchAndRenderTickets() {
  utils.showSpinner();
  try {
    const ticketsRef = utils.collection(utils.db, 'tickets');
    const ticketSnap = await utils.getWrapDocs(
      utils.query(ticketsRef, utils.orderBy('reservationNo', 'asc')),
    );
    tickets = ticketSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    const checkInsRef = utils.collection(utils.db, 'checkIns');
    const checkInSnap = await utils.getWrapDocs(checkInsRef);
    const checkedNames = checkInSnap.docs.map((doc) => doc.data().name);

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

    renderTickets(filtered, checkedNames);
  } catch (e) {
    console.error(e);
  } finally {
    utils.hideSpinner();
  }
}

function renderTickets(ticketArray, checkedNames = []) {
  const $tbody = $('#ticket-table-body').empty();
  let totalSum = 0;
  let totalRows = 0;

  if (ticketArray.length === 0) {
    $tbody.append(
      '<tr><td colspan="6" class="text-center">予約データは見つかりませんでした。</td></tr>',
    );
    $('#total-count-display').text('該当: 0件 / 合計人数: 0名');
    return;
  }

  const formatName = (name) => {
    if (!name) return '未設定';
    return checkedNames.includes(name)
      ? `<span style="color: #28a745;">✅ ${name} 様</span>`
      : `${name} 様`;
  };

  ticketArray.forEach((t) => {
    const createdAt = t.createdAt
      ? utils.format(t.createdAt, 'yyyy/MM/dd HH:mm')
      : '-';
    const updatedAt = t.updatedAt
      ? utils.format(t.updatedAt, 'yyyy/MM/dd HH:mm')
      : '-';

    if (t.resType === 'invite' && t.groups) {
      t.groups.forEach((group, gIdx) => {
        totalRows++;
        const gNo = `${t.reservationNo}-${gIdx + 1}`;
        const companionsFormatted = group.companions
          .filter((c) => c !== '')
          .map((c) => formatName(c));
        const groupCount = companionsFormatted.length;
        totalSum += groupCount;

        const customerHtml =
          groupCount > 0 ? companionsFormatted.join('<br>') : '(招待客なし)';

        // ID生成時に明確に _g を付与
        const row = `
          <tr>
            <td class="text-center">
              <a href="javascript:void(0)" class="open-checkin" data-id="${t.id}_g${gIdx + 1}" style="font-weight:bold; color: #e91e63; text-decoration: underline;">${gNo}</a>
              <span class="res-type-label status-invite">招待</span>
            </td>
            <td class="text-center">${groupCount} 名</td>
            <td style="line-height: 1.5;">${customerHtml}</td>
            <td>${t.representativeName}<br><small style="color:#888;">(${group.groupName})</small></td>
            <td style="font-size: 11px; color: #666;">${createdAt}</td>
            <td style="font-size: 11px; color: #666;">${updatedAt}</td>
          </tr>
        `;
        $tbody.append(row);
      });
    } else {
      totalRows++;
      const repNameFormatted = formatName(t.representativeName);
      const companionsFormatted = (t.companions || [])
        .filter((c) => c !== '')
        .map((c) => formatName(c));
      const allCustomers = [repNameFormatted, ...companionsFormatted];
      const count = allCustomers.length;
      totalSum += count;

      const row = `
        <tr>
          <td class="text-center">
            <a href="javascript:void(0)" class="open-checkin" data-id="${t.id}" style="font-weight:bold; color: #e91e63; text-decoration: underline;">${t.reservationNo || '-'}</a>
            <span class="res-type-label status-general">一般</span>
          </td>
          <td class="text-center">${count} 名</td>
          <td style="line-height: 1.5;">${allCustomers.join('<br>')}</td>
          <td>-</td>
          <td style="font-size: 11px; color: #666;">${createdAt}</td>
          <td style="font-size: 11px; color: #666;">${updatedAt}</td>
        </tr>
      `;
      $tbody.append(row);
    }
  });

  $('.open-checkin')
    .off('click')
    .on('click', function () {
      openCheckInModal($(this).data('id'));
    });

  $('#total-count-display').html(
    `該当: ${totalRows}件 <br> 合計人数: ${totalSum}名`,
  );
}

async function openCheckInModal(fullId) {
  utils.showSpinner();
  try {
    let ticketId = fullId;
    let groupSuffix = null;

    // --- ID解析ロジック ---
    const underscoreCount = (fullId.match(/_/g) || []).length;
    const gIndex = fullId.lastIndexOf('_g');

    if (underscoreCount >= 2 && gIndex !== -1) {
      ticketId = fullId.substring(0, gIndex); // liveId_uid 部分
      groupSuffix = fullId.substring(gIndex + 2); // N 部分
    }

    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) throw new Error('Ticket not found');

    const checkInsRef = utils.collection(utils.db, 'checkIns');
    const q = utils.query(
      checkInsRef,
      utils.where('ticketId', '==', ticket.id),
    );
    const snap = await utils.getWrapDocs(q);

    const currentCheckedMap = {};
    snap.docs.forEach((doc) => {
      currentCheckedMap[doc.data().name] = doc.id;
    });

    let targets = [];
    let displayNo = ticket.reservationNo;

    if (groupSuffix && ticket.groups) {
      // 特定の招待グループのみ表示
      const gIdx = parseInt(groupSuffix) - 1;
      const group = ticket.groups[gIdx];
      if (group) {
        displayNo = `${ticket.reservationNo}-${groupSuffix}`;
        targets = group.companions
          .filter((c) => c !== '')
          .map((name) => ({ name, type: group.groupName }));
      }
    } else if (ticket.resType === 'invite') {
      // 全招待グループ表示
      ticket.groups.forEach((g) => {
        g.companions
          .filter((c) => c !== '')
          .forEach((name) => {
            targets.push({ name, type: g.groupName });
          });
      });
    } else {
      // 一般予約（修正箇所）
      targets.push({ name: ticket.representativeName, type: '代表者' });
      (ticket.companions || []) // ここを t から ticket に修正しました
        .filter((c) => c !== '')
        .forEach((name) => {
          targets.push({ name, type: '同行者' });
        });
    }

    utils.hideSpinner();

    let modalBody = `
      <div class="checkin-container">
        <p style="margin-bottom: 15px; font-size: 0.9em; color: #666;">
          予約番号: <strong>${displayNo}</strong>
        </p>
        <div class="checkin-list" style="display: flex; flex-direction: column; gap: 10px;">
    `;

    targets.forEach((target, index) => {
      const isChecked = !!currentCheckedMap[target.name];
      modalBody += `
        <label style="display: flex; align-items: center; padding: 12px; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; background: #fff;">
          <input type="checkbox" id="checkin_${index}" value="${target.name}" style="width: 20px; height: 20px; margin-right: 10px;" ${isChecked ? 'checked' : ''}>
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
        const isNowChecked = result.data[`checkin_${index}`] === true;
        const existingDocId = currentCheckedMap[target.name];

        if (isNowChecked && !existingDocId) {
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
          promises.push(
            utils.deleteDoc(utils.doc(utils.db, 'checkIns', existingDocId)),
          );
        }
      });

      if (promises.length > 0) {
        await Promise.all(promises);
        utils.showDialog('チェックイン情報を更新しました');
        await fetchAndRenderTickets();
      }
      utils.hideSpinner();
    }
  } catch (e) {
    utils.hideSpinner();
    console.error(e);
    utils.showDialog('更新に失敗しました', true);
  }
}

let videoStream = null;

async function openCameraModal() {
  const modalBody = `
    <div class="qr-video-container">
      <video id="qr-video" playsinline></video>
      <canvas id="qr-canvas" style="display:none;"></canvas>
    </div>
    <p style="text-align:center; margin-top:10px; font-size:0.8em; color:#666;">QRコードを枠内に写してください</p>
  `;
  utils
    .showModal('QRスキャン', modalBody, null, '閉じる')
    .then(() => stopCamera());
  startCamera();
}

async function startCamera() {
  const video = document.getElementById('qr-video');
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });
    video.srcObject = videoStream;
    video.play();
    requestAnimationFrame(scanTick);
  } catch (err) {
    utils.showDialog('カメラの起動に失敗しました', true);
  }
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach((track) => track.stop());
    videoStream = null;
  }
}

function scanTick() {
  const video = document.getElementById('qr-video');
  if (!video || video.paused || video.ended) return;

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    const canvas = document.getElementById('qr-canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    canvas.height = video.videoHeight;
    canvas.width = video.videoWidth;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
      const fullId = code.data;
      stopCamera();
      $('.modal-close').click();

      // 解析ロジックを統一
      const underscoreCount = (fullId.match(/_/g) || []).length;
      const gIndex = fullId.lastIndexOf('_g');
      const baseId =
        underscoreCount >= 2 && gIndex !== -1
          ? fullId.substring(0, gIndex)
          : fullId;

      const ticketExists = tickets.some((t) => t.id === baseId);
      if (ticketExists) {
        setTimeout(() => openCheckInModal(fullId), 300);
      } else {
        utils.showDialog('該当する予約が見つかりません', true);
      }
      return;
    }
  }
  requestAnimationFrame(scanTick);
}
