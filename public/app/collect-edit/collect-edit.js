import * as utils from '../common/functions.js';

let initialState = {};

$(document).ready(async function () {
  try {
    await utils.initDisplay();

    const mode = utils.globalGetParamMode; // new / edit / copy
    const collectId = utils.globalGetParamCollectId;

    // パンくず設定
    let breadcrumb = [
      { title: '集金一覧', url: '../collect-list/collect-list.html' },
    ];
    if (mode === 'new') {
      breadcrumb.push({ title: '集金新規作成' });
    } else {
      breadcrumb.push(
        {
          title: '集金確認',
          url: `../collect-confirm/collect-confirm.html?collectId=${collectId}`,
        },
        { title: mode === 'edit' ? '集金編集' : '集金新規作成(コピー)' }
      );
    }
    utils.renderBreadcrumb(breadcrumb);

    await setupPage(mode, collectId);
    captureInitialState();
    setupEventHandlers(mode, collectId);
  } catch (e) {
    console.error(e);
  } finally {
    utils.hideSpinner();
  }
});

async function setupPage(mode, collectId) {
  if (mode === 'new') {
    $('#page-title, #title').text('集金新規作成');
    $('.back-link')
      .text('← 集金一覧に戻る')
      .attr('href', '../collect-list/collect-list.html');
  } else {
    $('#page-title, #title').text(
      mode === 'edit' ? '集金編集' : '集金新規作成(コピー)'
    );
    $('.back-link')
      .text('← 集金確認に戻る')
      .attr(
        'href',
        `../collect-confirm/collect-confirm.html?collectId=${collectId}`
      );
    await loadCollectData(collectId, mode);
  }
}

async function loadCollectData(docId, mode) {
  const docSnap = await utils.getWrapDoc(
    utils.doc(utils.db, 'collects', docId)
  );
  if (!docSnap.exists()) throw new Error('データが見つかりません');
  const data = docSnap.data();

  $('#target-date').val(
    data.targetDate ? utils.formatDateToYMDHyphen(data.targetDate) : ''
  );
  $('#collect-title').val(data.title + (mode === 'copy' ? '（コピー）' : ''));
  $('#accept-start-date').val(
    data.acceptStartDate
      ? utils.formatDateToYMDHyphen(data.acceptStartDate)
      : ''
  );
  $('#accept-end-date').val(
    data.acceptEndDate ? utils.formatDateToYMDHyphen(data.acceptEndDate) : ''
  );
  $('#amount-per-person').val(data.amountPerPerson || '');
  $('#payment-url').val(data.paymentUrl || '');
  $('#upfront-amount').val(data.upfrontAmount || '');
  $('#upfront-payer').val(data.upfrontPayer || '');
  $('#participant-count').val(data.participantCount || '');
  $('#manager-name').val(data.managerName || '');
  $('#collect-remarks').val(data.remarks || '');
}

function setupEventHandlers(mode, collectId) {
  $('#save-button').on('click', async () => {
    if (!validateData()) return;

    const actionText = mode === 'edit' ? '更新' : '登録';
    if (!(await utils.showDialog(`${actionText}しますか？`))) return;

    utils.showSpinner();
    try {
      const collectData = gatherData();
      if (mode === 'edit') {
        collectData.updatedAt = utils.serverTimestamp();
        await utils.updateDoc(
          utils.doc(utils.db, 'collects', collectId),
          collectData
        );
      } else {
        collectData.createdAt = utils.serverTimestamp();
        const docRef = await utils.addDoc(
          utils.collection(utils.db, 'collects'),
          collectData
        );
        collectId = docRef.id;
      }

      await utils.writeLog({ dataId: collectId, action: actionText });
      await utils.showDialog(`${actionText}しました`, true);
      window.location.href = `../collect-confirm/collect-confirm.html?collectId=${collectId}`;
    } catch (e) {
      console.error(e);
    } finally {
      utils.hideSpinner();
    }
  });

  $('#clear-button').on('click', async () => {
    if (await utils.showDialog('入力をリセットしますか？'))
      restoreInitialState();
  });
}

function gatherData() {
  return {
    targetDate: utils.formatDateToYMDDot($('#target-date').val()),
    title: $('#collect-title').val().trim(),
    acceptStartDate: utils.formatDateToYMDDot($('#accept-start-date').val()),
    acceptEndDate: utils.formatDateToYMDDot($('#accept-end-date').val()),
    amountPerPerson: Number($('#amount-per-person').val()),
    paymentUrl: $('#payment-url').val().trim(),
    upfrontAmount: Number($('#upfront-amount').val()),
    upfrontPayer: $('#upfront-payer').val().trim(),
    participantCount: Number($('#participant-count').val()),
    managerName: $('#manager-name').val().trim(),
    remarks: $('#collect-remarks').val().trim(),
  };
}

function validateData() {
  utils.clearErrors();
  let isValid = true;

  if (!$('#target-date').val()) {
    utils.markError($('#target-date'), '必須');
    isValid = false;
  }
  if (!$('#collect-title').val().trim()) {
    utils.markError($('#collect-title'), '必須');
    isValid = false;
  }
  if (!$('#accept-start-date').val()) {
    utils.markError($('#accept-start-date'), '必須');
    isValid = false;
  }
  if (!$('#accept-end-date').val()) {
    utils.markError($('#accept-end-date'), '必須');
    isValid = false;
  }
  if (!$('#amount-per-person').val()) {
    utils.markError($('#amount-per-person'), '必須');
    isValid = false;
  }

  return isValid;
}

function captureInitialState() {
  initialState = gatherData();
}

function restoreInitialState() {
  $('#target-date').val(utils.formatDateToYMDHyphen(initialState.targetDate));
  $('#collect-title').val(initialState.title);
  $('#accept-start-date').val(
    utils.formatDateToYMDHyphen(initialState.acceptStartDate)
  );
  $('#accept-end-date').val(
    utils.formatDateToYMDHyphen(initialState.acceptEndDate)
  );
  $('#amount-per-person').val(initialState.amountPerPerson);
  $('#payment-url').val(initialState.paymentUrl);
  $('#upfront-amount').val(initialState.upfrontAmount);
  $('#upfront-payer').val(initialState.upfrontPayer);
  $('#participant-count').val(initialState.participantCount);
  $('#manager-name').val(initialState.managerName);
  $('#collect-remarks').val(initialState.remarks);
}
