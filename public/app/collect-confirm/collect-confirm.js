import * as utils from '../common/functions.js';

let currentTargetUserId = null;

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

/**
 * Storage上のファイルを削除する共通関数
 */
async function deleteStorageFile(url) {
  if (!url || !url.startsWith('http')) return;
  try {
    const fileRef = utils.ref(utils.storage, url);
    await utils.deleteObject(fileRef);
  } catch (err) {
    console.warn('Storage file delete warning:', err);
  }
}

async function renderCollect() {
  const collectId = utils.globalGetParamCollectId;
  const isAdmin = utils.isAdmin('Collect');
  const myUid = utils.getSession('uid');

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
    const uData = d.data();
    userFullMap[d.id] = {
      name: uData.displayName,
      sectionId: uData.sectionId,
      paypayId: uData.paypayId,
    };
  });

  const formatYen = (num) => (num ? `¥${Number(num).toLocaleString()}` : '-');
  const isActive = utils.isInTerm(data.acceptStartDate, data.acceptEndDate);

  // --- ステータスラベルの初期表示 ---
  updateGlobalStatusLabel(data, responseMap, myUid, isActive);

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
  $('#collect-remarks').text(data.remarks || '-');

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
            isAdmin && hasRemiReceipt
              ? `<button class="btn-receipt-delete" data-uid="remittance_evidence" data-url="${remiResp.receiptUrl}"><i class="fas fa-trash-alt"></i></button>`
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
        sectionsMap[sId] || '❓未設定'
      }</div></div>`
    );
    grouped[sId].forEach((u) => {
      const resp = responseMap[u.id];
      const hasReceipt = !!resp?.receiptUrl;
      const isManager = u.id === data.managerName;
      const isUpfrontPayer = u.id === data.upfrontPayer;

      const $row = $(`
        <div class="user-receipt-row" data-uid="${u.id}">
          <div class="user-name-cell">
            ${u.name} 
            ${
              isManager
                ? '<span class="status-badge uploaded">集金担当</span>'
                : isUpfrontPayer
                ? '<span class="status-badge uploaded">建替担当</span>'
                : hasReceipt
                ? '<span class="status-badge uploaded">済</span>'
                : ''
            }
          </div>
          <div class="receipt-actions">
            ${
              !isManager && !isUpfrontPayer && hasReceipt
                ? `<button class="btn-receipt-view" data-url="${resp.receiptUrl}">表示</button>`
                : ''
            }
            ${
              !isManager && !isUpfrontPayer && isAdmin && hasReceipt
                ? `<button class="btn-receipt-delete" data-uid="${u.id}" data-url="${resp.receiptUrl}"><i class="fas fa-trash-alt"></i></button>`
                : ''
            }
            ${
              !isManager && !isUpfrontPayer && isAdmin
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

  // 支払いメニューの表示
  let paymentHtml = `
    <div class="menu-section">
    <h2 class="menu-title">支払いメニュー</h2>
      ${
        !isActive
          ? `
            <div class="payment-guide-box">
              <p class="guide-title"><i class="fas fa-info-circle"></i> 送金手順</p>
              <ol class="guide-list">
                <li>下の「PayPayアプリを開く」を押す</li>
                <li>「送る」タブを選択</li>
                <li>${
                  userFullMap[data.managerName]?.paypayId
                    ? `<strong>「${
                        userFullMap[data.managerName].paypayId
                      }」</strong>を検索`
                    : '集金担当者を検索'
                }</li>
                <li><strong>${formatYen(
                  data.amountPerPerson
                )}</strong> を送金</li>
              </ol>
            </div>
          `
          : ''
      }
      <div class="confirm-buttons">
        ${
          !isActive
            ? ` <button id="pay-app-button" class="pay-app-button">
                  <i class="fas fa-external-link-alt"></i> PayPayアプリを開く
                </button>`
            : data.paymentUrl
            ? `<button id="pay-link-button" class="save-button">支払う</button>`
            : ''
        }
      </div>
      ${
        !isActive
          ? '<p class="closed-warning">※受付期間外のため、<br>手動支払いでお願いします</p>'
          : ''
      }
    </div>
  `;
  $('#payment-link-container').html(paymentHtml);

  // イベント登録
  $('#pay-app-button').on('click', () => {
    window.location.href = 'paypay://';
  });
  if (data.paymentUrl) {
    $('#pay-link-button').on('click', () =>
      window.open(data.paymentUrl, '_blank')
    );
  }

  setupEventHandlers(collectId, isAdmin, data, myUid, isActive);
}

// ステータスラベルを更新する共通関数
function updateGlobalStatusLabel(data, responseMap, myUid, isActive) {
  const isParticipant = (data.participants || []).includes(myUid);
  const hasPaid = !!responseMap[myUid];
  const $statusLabel = $('#answer-status-label');

  if (isParticipant && hasPaid) {
    $statusLabel.attr('class', 'answer-status answered').text('支払い済');
  } else {
    $statusLabel
      .attr('class', 'answer-status ' + (isActive ? 'pending' : 'closed'))
      .text(isActive ? '受付中' : '期間外');
  }
}

function setupEventHandlers(collectId, isAdmin, data, myUid, isActive) {
  if (!isAdmin) $('#collect-menu').hide();

  $(document)
    .off('click', '.btn-receipt-view')
    .on('click', '.btn-receipt-view', function () {
      const url = $(this).data('url');
      const overlay = $(`
      <div class="image-preview-overlay">
        <div class="image-preview-content">
          <img src="${url}">
        </div>
      </div>
    `);
      $('body').append(overlay);
    });

  $(document).on('click', '.image-preview-overlay', function () {
    $(this).remove();
  });

  $(document)
    .off('click', '.btn-receipt-upload')
    .on('click', '.btn-receipt-upload', function () {
      currentTargetUserId = $(this).data('uid');
      $('#receipt-file-input').click();
    });

  $('#receipt-file-input')
    .off('change')
    .on('change', async function (e) {
      const file = e.target.files[0];
      if (!file || !currentTargetUserId) return;

      try {
        utils.showSpinner();
        const docRef = utils.doc(
          utils.db,
          'collects',
          collectId,
          'responses',
          currentTargetUserId
        );
        const oldDoc = await utils.getDoc(docRef);
        if (oldDoc.exists() && oldDoc.data().receiptUrl) {
          await deleteStorageFile(oldDoc.data().receiptUrl);
        }

        const compressedBlob = await utils.compressImage(file);
        const path = `receipts/${collectId}/${currentTargetUserId}_${Date.now()}.jpg`;
        const storageRef = utils.ref(utils.storage, path);
        await utils.uploadBytes(storageRef, compressedBlob);
        const url = await utils.getDownloadURL(storageRef);

        const resData = {
          userId: currentTargetUserId,
          receiptUrl: url,
          updatedAt: utils.serverTimestamp(),
        };
        await utils.setDoc(docRef, resData, { merge: true });

        // UI行を更新し、ステータスラベルも更新
        updateUIRow(currentTargetUserId, url, isAdmin);

        // メモリ上のマップも更新してステータスラベル反映
        const responseMap = { [currentTargetUserId]: resData };
        updateGlobalStatusLabel(data, responseMap, myUid, isActive);
      } catch (err) {
        console.error(err);
        alert('アップロードに失敗しました');
      } finally {
        utils.hideSpinner();
        $(this).val('');
      }
    });

  $(document)
    .off('click', '.btn-receipt-delete')
    .on('click', '.btn-receipt-delete', async function () {
      const uid = $(this).data('uid');
      const url = $(this).data('url');

      if (
        !(await utils.showDialog(
          'このスクショを削除し、支払い記録を取り消してもよろしいですか？'
        ))
      )
        return;

      try {
        utils.showSpinner();
        if (url) {
          await deleteStorageFile(url);
        }
        const responseDocRef = utils.doc(
          utils.db,
          'collects',
          collectId,
          'responses',
          uid
        );
        await utils.deleteDoc(responseDocRef);

        updateUIRow(uid, null, isAdmin);
        updateGlobalStatusLabel(data, {}, myUid, isActive);
      } catch (err) {
        console.error(err);
        alert('削除に失敗しました');
      } finally {
        utils.hideSpinner();
      }
    });

  function updateUIRow(uid, url, isAdmin) {
    const $row = $(`.user-receipt-row[data-uid="${uid}"]`);
    const $nameCell = $row.find('.user-name-cell');
    const $actions = $row.find('.receipt-actions');

    if (url) {
      if ($nameCell.find('.status-badge:contains("済")').length === 0) {
        $nameCell.append(' <span class="status-badge uploaded">済</span>');
      }
      $actions.find('.btn-receipt-view, .btn-receipt-delete').remove();
      $actions.prepend(`
        <button class="btn-receipt-view" data-url="${url}">表示</button>
        ${
          isAdmin
            ? `<button class="btn-receipt-delete" data-uid="${uid}" data-url="${url}"><i class="fas fa-trash-alt"></i></button>`
            : ''
        }
      `);
    } else {
      $nameCell.find('.status-badge:contains("済")').remove();
      $actions.find('.btn-receipt-view, .btn-receipt-delete').remove();
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
