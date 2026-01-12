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
      paypayId: uData.paypayId, // 🔽 paypayIdを取得
    };
  });

  const formatYen = (num) => (num ? `¥${Number(num).toLocaleString()}` : '-');
  const isActive = utils.isInTerm(data.acceptStartDate, data.acceptEndDate);

  $('#answer-status-label')
    .attr('class', 'answer-status ' + (isActive ? 'pending' : 'closed'))
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

  // 対象者リスト表示
  Object.keys(grouped).forEach((sId) => {
    const $section = $(
      `<div class="confirm-section-group"><div class="confirm-section-title">${
        sectionsMap[sId] || '❓未設定'
      }</div></div>`
    );
    grouped[sId].forEach((u) => {
      const resp = responseMap[u.id];
      const hasReceipt = !!resp?.receiptUrl;
      const isManager = u.id === data.managerName; // 💡判定追加

      const $row = $(`
        <div class="user-receipt-row" data-uid="${u.id}">
          <div class="user-name-cell">
            ${u.name} 
            ${
              isManager
                ? '<span class="status-badge uploaded">集金担当</span>'
                : hasReceipt
                ? '<span class="status-badge uploaded">済</span>'
                : ''
            }
          </div>
          <div class="receipt-actions">
            ${
              !isManager && hasReceipt // 💡担当者以外かつ画像あり
                ? `<button class="btn-receipt-view" data-url="${resp.receiptUrl}">表示</button>`
                : ''
            }
            ${
              !isManager && isAdmin && hasReceipt // 💡担当者以外かつ管理者かつ画像あり
                ? `<button class="btn-receipt-delete" data-uid="${u.id}" data-url="${resp.receiptUrl}"><i class="fas fa-trash-alt"></i></button>`
                : ''
            }
            ${
              !isManager && isAdmin // 💡担当者以外かつ管理者の場合のみアップロード可能
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

  // 🔽 支払いメニューの表示 (期間外の場合ナビ表示)
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

  setupEventHandlers(collectId, isAdmin);
}

function setupEventHandlers(collectId, isAdmin) {
  if (!isAdmin) $('#collect-menu').hide();

  // プレビュー表示（✕ボタンを削除）
  $(document)
    .off('click', '.btn-receipt-view')
    .on('click', '.btn-receipt-view', function () {
      const url = $(this).data('url');
      const overlay = $(`
      <div class="receipt-preview-overlay">
        <div class="receipt-preview-content">
          <img src="${url}">
        </div>
      </div>
    `);
      $('body').append(overlay);
    });

  // プレビュー閉じる（どこをタップしても閉じるように修正）
  $(document).on('click', '.receipt-preview-overlay', function () {
    $(this).remove();
  });

  // アップロード開始
  $(document)
    .off('click', '.btn-receipt-upload')
    .on('click', '.btn-receipt-upload', function () {
      currentTargetUserId = $(this).data('uid');
      $('#receipt-file-input').click();
    });

  // ファイル選択後のアップロード処理
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

        const compressedBlob = await compressImage(file);
        const path = `receipts/${collectId}/${currentTargetUserId}_${Date.now()}.jpg`;
        const storageRef = utils.ref(utils.storage, path);
        await utils.uploadBytes(storageRef, compressedBlob);
        const url = await utils.getDownloadURL(storageRef);

        await utils.setDoc(
          docRef,
          {
            userId: currentTargetUserId,
            receiptUrl: url,
            updatedAt: utils.serverTimestamp(),
          },
          { merge: true }
        );

        updateUIRow(currentTargetUserId, url, isAdmin);
      } catch (err) {
        console.error(err);
        alert('アップロードに失敗しました');
      } finally {
        utils.hideSpinner();
        $(this).val('');
      }
    });
  // 削除機能
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

        // 1. Storageの画像ファイルを削除
        if (url) {
          await deleteStorageFile(url);
        }

        // 2. Firestoreのresponsesドキュメント自体を削除 💡修正ポイント
        const responseDocRef = utils.doc(
          utils.db,
          'collects',
          collectId,
          'responses',
          uid
        );
        await utils.deleteDoc(responseDocRef);

        // 3. UIの表示を更新
        updateUIRow(uid, null, isAdmin);
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
      if ($nameCell.find('.status-badge').length === 0) {
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
      $nameCell.find('.status-badge').remove();
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
