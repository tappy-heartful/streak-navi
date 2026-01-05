import * as utils from '../common/functions.js';

let currentTargetUserId = null;
let $currentUploadButton = null;

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    utils.renderBreadcrumb([
      { title: '集金一覧', url: '../collect-list/collect-list.html' },
      { title: '集金確認' },
    ]);
    await renderCollect();
  } catch (e) {
    console.error(e);
    await utils.writeLog({
      dataId: utils.globalGetParamCollectId,
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

async function renderCollect() {
  const collectId = utils.globalGetParamCollectId;
  const isAdmin = utils.isAdmin('Collect');

  const [collectSnap, usersSnap, sectionsSnap, responsesSnap] =
    await Promise.all([
      utils.getWrapDoc(utils.doc(utils.db, 'collects', collectId)),
      utils.getWrapDocs(utils.collection(utils.db, 'users')),
      utils.getWrapDocs(utils.collection(utils.db, 'sections')),
      utils.getWrapDocs(
        utils.collection(utils.db, 'collects', collectId, 'responses')
      ),
    ]);

  if (!collectSnap.exists()) throw new Error('データが見つかりません');
  const data = collectSnap.data();

  const responseMap = {};
  responsesSnap.docs.forEach((d) => {
    responseMap[d.id] = d.data();
  });

  const sectionsMap = {};
  sectionsSnap.docs.forEach((d) => {
    sectionsMap[d.id] = d.data().name;
  });

  const userFullMap = {};
  usersSnap.docs.forEach((d) => {
    userFullMap[d.id] = {
      name: d.data().displayName,
      sectionId: d.data().sectionId,
    };
  });

  const formatYen = (num) => (num ? `¥${Number(num).toLocaleString()}` : '-');
  const isActive = utils.isInTerm(data.acceptStartDate, data.acceptEndDate);

  $('#answer-status-label')
    .addClass(isActive ? 'pending' : 'closed')
    .text(isActive ? '受付中' : '期間外');
  $('#target-date').text(
    data.targetDate ? utils.getDayOfWeek(data.targetDate_decoded) : '-'
  );
  $('#collect-title').text(data.title);
  $('#accept-term').text(
    `${data.acceptStartDate || ''} ～ ${data.acceptEndDate || ''}`
  );
  $('#amount-per-person').text(formatYen(data.amountPerPerson));
  $('#upfront-amount').text(formatYen(data.upfrontAmount));
  $('#upfront-payer').text(userFullMap[data.upfrontPayer]?.name || '-');
  $('#participant-count').text(`${data.participantCount || 0} 名`);
  $('#manager-name').text(userFullMap[data.managerName]?.name || '-');

  // 送金額とエビデンス表示
  const $remittanceArea = $('#remittance-amount-area').empty();
  const isSamePerson = data.upfrontPayer === data.managerName;

  if (isSamePerson) {
    $remittanceArea.append(
      '<span style="font-size: 0.85rem; color: #666;">なし<br />(建替者=担当者のため)</span>'
    );
  } else {
    const remiResp = responseMap['remittance_evidence'];
    const hasRemiReceipt = !!remiResp?.receiptUrl;

    $remittanceArea.append(`
      <div class="user-receipt-row" data-uid="remittance_evidence" style="padding:0; width:100%;">
        <div class="user-name-cell" style="font-weight:bold; color:#222;">
          ${formatYen(data.remittanceAmount)}
          ${
            hasRemiReceipt
              ? '<span class="status-badge uploaded">済</span>'
              : ''
          }
        </div>
        <div class="receipt-actions">
          ${
            hasRemiReceipt
              ? `<button class="btn-receipt-view" data-url="${remiResp.receiptUrl}">表示</button>`
              : ''
          }
          ${
            isAdmin
              ? `<button class="btn-receipt-upload" data-uid="remittance_evidence"><i class="fas fa-upload"></i></button>`
              : ''
          }
        </div>
      </div>
    `);
  }

  // 調整情報の表示
  if (data.isAdjustmentEnabled) {
    $('#adjustment-status').text('あり（端数調整）');
    $('#adjustment-details').show();
    $('#adjustment-payer').text(
      userFullMap[data.adjustmentPayer]?.name || '未設定'
    );
    const baseTotal = data.amountPerPerson * data.participantCount;
    const diff = data.upfrontAmount - baseTotal;
    const finalAmount = data.amountPerPerson + diff;
    $('#adjustment-payer-amount').text(formatYen(finalAmount));
  } else {
    $('#adjustment-status').text('なし（一律）');
    $('#adjustment-details').hide();
  }

  // 対象者リスト表示
  const $listContainer = $('#participant-list-container').empty();
  const grouped = {};
  (data.participants || []).forEach((uId) => {
    const user = userFullMap[uId];
    const sId = user?.sectionId || 'unknown';
    if (!grouped[sId]) grouped[sId] = [];
    grouped[sId].push({ id: uId, name: user?.name || '不明' });
  });

  Object.keys(grouped).forEach((sId) => {
    const $section = $(
      `<div class="confirm-section-group"><div class="confirm-section-title">${
        sectionsMap[sId] || 'その他'
      }</div></div>`
    );
    grouped[sId].forEach((u) => {
      const resp = responseMap[u.id];
      const hasReceipt = !!resp?.receiptUrl;
      const $row = $(`
        <div class="user-receipt-row" data-uid="${u.id}">
          <div class="user-name-cell">${u.name} ${
        hasReceipt ? '<span class="status-badge uploaded">済</span>' : ''
      }</div>
          <div class="receipt-actions">
            ${
              hasReceipt
                ? `<button class="btn-receipt-view" data-url="${resp.receiptUrl}">表示</button>`
                : ''
            }
            ${
              isAdmin
                ? `<button class="btn-receipt-upload" data-uid="${u.id}"><i class="fas fa-upload"></i></button>`
                : ''
            }
          </div>
        </div>
      `);
      $section.append($row);
    });
    $listContainer.append($section);
  });

  if (data.paymentUrl && isActive) {
    $('#payment-link-container').html(
      `<div class="menu-section"><h2 class="menu-title">支払いメニュー</h2><div class="confirm-buttons"><button id="pay-button" class="save-button">支払う</button></div></div>`
    );
    $('#pay-button').on('click', () => window.open(data.paymentUrl, '_blank'));
  }

  setupEventHandlers(collectId, isAdmin);
}

function setupEventHandlers(collectId, isAdmin) {
  if (!isAdmin) $('#collect-menu').hide();

  $(document)
    .off('click', '.btn-receipt-view')
    .on('click', '.btn-receipt-view', function () {
      const url = $(this).data('url');
      const overlay = $(`
      <div class="receipt-preview-overlay">
        <div class="receipt-preview-content">
          <span class="close-preview">&times;</span>
          <img src="${url}">
        </div>
      </div>
    `);
      $('body').append(overlay);
    });

  $(document).on(
    'click',
    '.close-preview, .receipt-preview-overlay',
    function (e) {
      if ($(e.target).closest('img').length > 0) return;
      $('.receipt-preview-overlay').remove();
    }
  );

  $(document)
    .off('click', '.btn-receipt-upload')
    .on('click', '.btn-receipt-upload', function () {
      currentTargetUserId = $(this).data('uid');
      $currentUploadButton = $(this);
      $('#receipt-file-input').click();
    });

  $('#receipt-file-input')
    .off('change')
    .on('change', async function (e) {
      const file = e.target.files[0];
      const collectId = utils.globalGetParamCollectId;
      if (!file || !currentTargetUserId) return;

      try {
        utils.showSpinner();
        const compressedBlob = await compressImage(file);
        const path = `receipts/${collectId}/${currentTargetUserId}_${Date.now()}.jpg`;
        const storageRef = utils.ref(utils.storage, path);
        await utils.uploadBytes(storageRef, compressedBlob);
        const url = await utils.getDownloadURL(storageRef);

        await utils.setDoc(
          utils.doc(
            utils.db,
            'collects',
            collectId,
            'responses',
            currentTargetUserId
          ),
          {
            userId: currentTargetUserId,
            receiptUrl: url,
            updatedAt: utils.serverTimestamp(),
          },
          { merge: true }
        );

        updateUIAfterUpload(currentTargetUserId, url);
        await utils.showDialog('スクショを登録しました', true);
      } catch (err) {
        console.error(err);
        alert('アップロード失敗');
      } finally {
        utils.hideSpinner();
        $(this).val('');
      }
    });

  function updateUIAfterUpload(uid, url) {
    const $row = $(`.user-receipt-row[data-uid="${uid}"]`);
    if ($row.find('.status-badge').length === 0) {
      $row
        .find('.user-name-cell')
        .append(' <span class="status-badge uploaded">済</span>');
    }
    let $viewBtn = $row.find('.btn-receipt-view');
    if ($viewBtn.length === 0) {
      $row
        .find('.receipt-actions')
        .prepend(
          `<button class="btn-receipt-view" data-url="${url}">表示</button>`
        );
    } else {
      $viewBtn.data('url', url).attr('data-url', url);
    }
  }

  $('#collect-edit-button').on(
    'click',
    () =>
      (window.location.href = `../collect-edit/collect-edit.html?mode=edit&collectId=${collectId}`)
  );
  $('#collect-copy-button').on(
    'click',
    () =>
      (window.location.href = `../collect-edit/collect-edit.html?mode=copy&collectId=${collectId}`)
  );
  $('#collect-delete-button').on('click', async () => {
    if (!(await utils.showDialog('この集金データを削除してもよろしいですか？')))
      return;
    try {
      utils.showSpinner();
      await utils.archiveAndDeleteDoc('collects', collectId);
      await utils.showDialog('削除しました', true);
      window.location.href = '../collect-list/collect-list.html';
    } finally {
      utils.hideSpinner();
    }
  });
}

async function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const max = 1000;
        if (width > height && width > max) {
          height *= max / width;
          width = max;
        } else if (height > max) {
          width *= max / height;
          height = max;
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
