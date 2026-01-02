import * as utils from '../common/functions.js';

let initialState = {};

$(document).ready(async function () {
  try {
    await utils.initDisplay();

    const mode = utils.globalGetParamMode;
    const collectId = utils.globalGetParamCollectId;

    // ユーザーリストを取得してセレクトボックスを初期化
    await initUserSelects();

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

/**
 * ユーザー情報の取得とセレクトボックスへの反映
 */
async function initUserSelects() {
  const usersSnap = await utils.getWrapDocs(
    utils.collection(utils.db, 'users')
  );
  const allUsers = usersSnap.docs.map((d) => d.data());

  // ソート用関数 (sectionId ASC, roleId ASC)
  const sortUsers = (a, b) => {
    if (a.sectionId !== b.sectionId)
      return a.sectionId.localeCompare(b.sectionId);
    return a.roleId.localeCompare(b.roleId);
  };

  // 全ユーザー（建て替え担当者用）
  const upfrontUsers = [...allUsers].sort(sortUsers);
  // sectionId === "1" のみ（集金担当者用）
  const managerUsers = allUsers
    .filter((u) => u.sectionId === '1')
    .sort(sortUsers);

  upfrontUsers.forEach((u) =>
    $('#upfront-payer').append(new Option(u.displayName, u.displayName))
  );
  managerUsers.forEach((u) =>
    $('#manager-name').append(new Option(u.displayName, u.displayName))
  );
}

async function setupPage(mode, collectId) {
  const saveBtn = $('#save-button');

  if (mode === 'new' || mode === 'copy') {
    saveBtn.text('登録');
    // 日付の初期値設定 (new/copy時)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const day13th = new Date();
    day13th.setDate(day13th.getDate() + 13);

    $('#accept-start-date').val(utils.formatDateToYMDHyphen(tomorrow));
    $('#accept-end-date').val(utils.formatDateToYMDHyphen(day13th));

    if (mode === 'copy') {
      $('#page-title, #title').text('集金新規作成(コピー)');
      await loadCollectData(collectId, mode);
    } else {
      $('#page-title, #title').text('集金新規作成');
    }
  } else {
    $('#page-title, #title').text('集金編集');
    saveBtn.text('更新');
    await loadCollectData(collectId, mode);
  }
}

/**
 * 自動計算ロジック
 */
function calculatePerPerson() {
  const total = Number($('#upfront-amount').val()) || 0;
  const count = Number($('#participant-count').val()) || 0;

  if (total > 0 && count > 0) {
    const perPerson = Math.ceil(total / count); // 切り上げ
    $('#amount-per-person').val(perPerson);
    // 送金額の初期値としてもセット（必要に応じて手修正可能）
    $('#remittance-amount').val(total);
  } else {
    $('#amount-per-person').val('');
  }
}

function setupEventHandlers(mode, collectId) {
  // 自動計算のトリガー
  $('#upfront-amount, #participant-count').on('input', calculatePerPerson);

  $('#save-button').on('click', async () => {
    if (!validateData()) return;
    const actionText = mode === 'edit' ? '更新' : '登録';
    if (!(await utils.showDialog(`${actionText}しますか？`))) return;

    utils.showSpinner();
    try {
      const collectData = gatherData();
      let targetId = collectId;
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
        targetId = docRef.id;
      }
      await utils.writeLog({ dataId: targetId, action: actionText });
      await utils.showDialog(`${actionText}しました`, true);
      window.location.href = `../collect-confirm/collect-confirm.html?collectId=${targetId}`;
    } catch (e) {
      console.error(e);
    } finally {
      utils.hideSpinner();
    }
  });

  $('#clear-button').on('click', async () => {
    if (await utils.showDialog('リセットしますか？')) restoreInitialState();
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
    upfrontPayer: $('#upfront-payer').val(),
    participantCount: Number($('#participant-count').val()),
    managerName: $('#manager-name').val(),
    remittanceAmount: Number($('#remittance-amount').val()),
    remarks: $('#collect-remarks').val().trim(),
  };
}

async function loadCollectData(docId, mode) {
  const docSnap = await utils.getWrapDoc(
    utils.doc(utils.db, 'collects', docId)
  );
  const data = docSnap.data();

  $('#target-date').val(utils.formatDateToYMDHyphen(data.targetDate));
  $('#collect-title').val(data.title + (mode === 'copy' ? '（コピー）' : ''));
  $('#accept-start-date').val(
    utils.formatDateToYMDHyphen(data.acceptStartDate)
  );
  $('#accept-end-date').val(utils.formatDateToYMDHyphen(data.acceptEndDate));
  $('#amount-per-person').val(data.amountPerPerson);
  $('#payment-url').val(data.paymentUrl || '');
  $('#upfront-amount').val(data.upfrontAmount || '');
  $('#upfront-payer').val(data.upfrontPayer || '');
  $('#participant-count').val(data.participantCount || '');
  $('#manager-name').val(data.managerName || '');
  $('#remittance-amount').val(data.remittanceAmount || '');
  $('#collect-remarks').val(data.remarks || '');
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
  if (!$('#amount-per-person').val()) {
    utils.markError($('#amount-per-person'), '金額が計算されていません');
    isValid = false;
  }
  return isValid;
}

function captureInitialState() {
  initialState = gatherData();
}
function restoreInitialState() {
  // ...初期状態への復元処理 (省略可、または上記loadDataに近い処理)
  location.reload();
}
