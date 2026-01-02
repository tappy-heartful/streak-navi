import * as utils from '../common/functions.js';

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

  // 集金マスタ取得
  const snap = await utils.getWrapDoc(
    utils.doc(utils.db, 'collects', collectId)
  );
  if (!snap.exists()) throw new Error('データが見つかりません');
  const data = snap.data();

  // 値のセット
  const formatYen = (num) => (num ? `¥${Number(num).toLocaleString()}` : '-');

  $('#collect-title').text(data.title);
  $('#amount-per-person').text(formatYen(data.amountPerPerson));
  $('#target-date').text(data.targetDate || '-');
  $('#collect-remarks').text(data.remarks || '-');
  $('#accept-term').text(`${data.acceptStartDate} ～ ${data.acceptEndDate}`);

  $('#upfront-amount').text(formatYen(data.upfrontAmount));
  $('#upfront-payer').text(data.upfrontPayer || '-');
  $('#participant-count').text(`${data.participantCount || '-'} 名`);
  $('#manager-name').text(data.managerName || '-');

  // 支払いボタンの表示（期間内のみ表示、またはリンクがある場合のみ表示）
  const isActive = utils.isInTerm(data.acceptStartDate, data.acceptEndDate);
  const $payContainer = $('#payment-link-container').empty();

  if (data.paymentUrl) {
    if (isActive) {
      $payContainer.append(`
        <a href="${data.paymentUrl}" target="_blank" class="pay-external-btn">
          <i class="fas fa-external-link-alt"></i> 支払いページを開く (PayPay等)
        </a>
      `);
    } else {
      $payContainer.html(
        '<p class="info-msg">受付期間外のため、リンクは無効です。</p>'
      );
    }
  } else {
    $payContainer.text('設定されていません');
  }

  setupEventHandlers(collectId, isAdmin);
}

function setupEventHandlers(collectId, isAdmin) {
  // 管理メニュー表示制御
  if (!isAdmin) {
    $('#collect-menu').hide();
  }

  // 管理者：編集
  $('#collect-edit-button').on('click', () => {
    window.location.href = `../collect-edit/collect-edit.html?mode=edit&collectId=${collectId}`;
  });

  // 管理者：コピー
  $('#collect-copy-button').on('click', () => {
    window.location.href = `../collect-edit/collect-edit.html?mode=copy&collectId=${collectId}`;
  });

  // 管理者：削除
  $('#collect-delete-button').on('click', async () => {
    if (
      !(await utils.showDialog(
        'この集金データを完全に削除しますか？\nこの操作は取り消せません。'
      ))
    )
      return;

    try {
      utils.showSpinner();
      await utils.archiveAndDeleteDoc('collects', collectId);
      await utils.writeLog({ dataId: collectId, action: '集金削除' });
      window.location.href = '../collect-list/collect-list.html';
    } catch (e) {
      console.error(e);
      await utils.showDialog('削除に失敗しました。');
    } finally {
      utils.hideSpinner();
    }
  });
}
