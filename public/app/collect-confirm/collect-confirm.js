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
  const uid = utils.getSession('uid');

  // 集金マスタ取得
  const snap = await utils.getWrapDoc(
    utils.doc(utils.db, 'collects', collectId)
  );
  if (!snap.exists()) throw new Error('データが見つかりません');
  const data = snap.data();

  // 自分の回答（入金報告）取得
  const myAnsSnap = await utils.getWrapDoc(
    utils.doc(utils.db, 'collectAnswers', `${collectId}_${uid}`)
  );
  const myAnswer = myAnsSnap?.data();

  // 全体の回答取得（進捗計算用）
  const allAnsSnap = await utils.getWrapDocs(
    utils.query(utils.collection(utils.db, 'collectAnswers'))
  );
  const participantAnswers = allAnsSnap.docs.filter((d) =>
    d.id.startsWith(collectId + '_')
  );
  const paidCount = participantAnswers.length;

  // 期間判定
  const isActive = utils.isInTerm(data.acceptStartDate, data.acceptEndDate);

  // ステータス表示
  let statusClass = 'pending';
  let statusText = '未対応';

  if (!isActive) {
    statusClass = 'closed';
    statusText = '期間外';
  } else if (myAnswer) {
    statusClass = 'answered';
    statusText = '完了';
  }

  $('#my-status-label').addClass(statusClass).text(statusText);

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

  $('#collect-progress').text(
    `現在の報告数: ${paidCount} / ${data.participantCount || '-'} 名`
  );

  // 支払いボタン
  const $payContainer = $('#payment-link-container').empty();
  if (data.paymentUrl) {
    $payContainer.append(`
      <a href="${data.paymentUrl}" target="_blank" class="pay-external-btn">
        <i class="fas fa-external-link-alt"></i> 支払いページを開く (PayPay等)
      </a>
    `);
  } else {
    $payContainer.text('設定されていません');
  }

  // ボタン文言の切り替え
  if (myAnswer) {
    $('#answer-save-button').html(
      '<i class="fas fa-edit"></i> 入金報告を修正する'
    );
    $('#answer-delete-button').show();
  } else {
    $('#answer-save-button').html(
      '<i class="fas fa-paper-plane"></i> 入金を報告する'
    );
    $('#answer-delete-button').hide();
  }

  setupEventHandlers(collectId, isAdmin, isActive, uid);
}

function setupEventHandlers(collectId, isAdmin, isActive, uid) {
  // 回答メニュー表示制御
  if (!isActive) {
    $('#answer-menu').html(
      '<p class="info-msg">受付期間外のため報告できません。</p>'
    );
  }

  // 管理メニュー表示制御
  if (!isAdmin) $('#collect-menu').hide();

  // 回答/修正ボタン
  $('#answer-save-button').on('click', () => {
    window.location.href = `../collect-answer/collect-answer.html?collectId=${collectId}`;
  });

  // 回答削除
  $('#answer-delete-button').on('click', async () => {
    if (!(await utils.showDialog('入金報告を取り消しますか？'))) return;
    try {
      utils.showSpinner();
      await utils.archiveAndDeleteDoc('collectAnswers', `${collectId}_${uid}`);
      await utils.showDialog('取り消しました', true);
      window.location.reload();
    } catch (e) {
      console.error(e);
    } finally {
      utils.hideSpinner();
    }
  });

  // 管理者：編集・コピー・削除
  $('#collect-edit-button').on('click', () => {
    window.location.href = `../collect-edit/collect-edit.html?mode=edit&collectId=${collectId}`;
  });

  $('#collect-copy-button').on('click', () => {
    window.location.href = `../collect-edit/collect-edit.html?mode=copy&collectId=${collectId}`;
  });

  $('#collect-delete-button').on('click', async () => {
    if (
      !(await utils.showDialog(
        'この集金データを完全に削除しますか？\n全員の回答も削除されます。'
      ))
    )
      return;
    try {
      utils.showSpinner();
      await utils.archiveAndDeleteDoc('collects', collectId);
      // 関連する回答も消す処理は共通関数側で実装（もしくはここでループ削除）
      window.location.href = '../collect-list/collect-list.html';
    } finally {
      utils.hideSpinner();
    }
  });
}
