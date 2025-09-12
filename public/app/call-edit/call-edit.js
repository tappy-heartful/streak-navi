import * as utils from '../common/functions.js';

let initialState = {};

//===========================
// 初期化
//===========================
$(document).ready(async function () {
  try {
    await utils.initDisplay();

    const mode = utils.globalGetParamMode; // new / edit / copy
    await setupPage(mode);
    captureInitialState();
    setupEventHandlers(mode);
  } catch (e) {
    await utils.writeLog({
      dataId: utils.globalGetParamCallId,
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

//===========================
// ページ設定
//===========================
async function setupPage(mode) {
  const pageTitle = $('#page-title');
  const title = $('#title');
  const submitButton = $('#save-button');
  const backLink = $('.back-link');

  if (mode === 'new') {
    pageTitle.text('曲募集新規作成');
    title.text('曲募集新規作成');
    submitButton.text('登録');
    backLink.text('← 曲募集一覧に戻る');
    // 回答を受け付けにチェック
    $('#is-open').prop('checked', true);
  } else if (mode === 'edit' || mode === 'copy') {
    pageTitle.text(mode === 'edit' ? '曲募集編集' : '曲募集新規作成');
    title.text(mode === 'edit' ? '曲募集編集' : '曲募集新規作成');
    submitButton.text(mode === 'edit' ? '更新' : '登録');
    backLink.text('← 曲募集確認に戻る');
    await loadCallData(utils.globalGetParamCallId, mode);
  } else {
    throw new Error('モード不正です');
  }
}

//===========================
// データ読み込み
//===========================
async function loadCallData(docId, mode) {
  const docSnap = await utils.getDoc(utils.doc(utils.db, 'calls', docId));
  if (!docSnap.exists()) throw new Error('募集が見つかりません');

  const data = docSnap.data();

  $('#call-title').val(data.title + (mode === 'copy' ? '（コピー）' : ''));
  $('#call-description').val(data.description || '');
  $('#is-open').prop('checked', data.isOpen || false);
  $('#is-anonymous').prop('checked', data.isAnonymous || false);

  // 募集項目を復元
  if (data.items && Array.isArray(data.items)) {
    data.items.forEach((item) => addItemToForm(item));
  }
}

//===========================
// イベント登録
//===========================
function setupEventHandlers(mode) {
  $('#add-item').on('click', () => addItemToForm(''));

  $('#clear-button').on('click', async () => {
    if (
      await utils.showDialog(
        mode === 'new' ? '入力内容をクリアしますか？' : '編集前に戻しますか？'
      )
    )
      restoreInitialState();
  });

  $('#save-button').on('click', async () => {
    if (!validateData()) {
      utils.showDialog('入力内容を確認してください', true);
      return;
    }

    if (
      !(await utils.showDialog(
        (['new', 'copy'].includes(mode) ? '登録' : '更新') + 'しますか？'
      ))
    )
      return;

    utils.showSpinner();
    try {
      const callData = collectData(mode);

      if (['new', 'copy'].includes(mode)) {
        const docRef = await utils.addDoc(
          utils.collection(utils.db, 'calls'),
          callData
        );
        await utils.writeLog({ dataId: docRef.id, action: '登録' });
        utils.hideSpinner();
        await utils.showDialog('登録しました', true);
        window.location.href = `../call-list/call-list.html`;
      } else {
        const callRef = utils.doc(
          utils.db,
          'calls',
          utils.globalGetParamCallId
        );
        callData.updatedAt = utils.serverTimestamp();
        await utils.updateDoc(callRef, callData);
        await utils.writeLog({
          dataId: utils.globalGetParamCallId,
          action: '更新',
        });
        utils.hideSpinner();
        await utils.showDialog('更新しました', true);
        window.location.href = `../call-list/call-list.html`;
      }
    } catch (e) {
      await utils.writeLog({
        dataId: utils.globalGetParamCallId,
        action: ['new', 'copy'].includes(mode) ? '登録' : '更新',
        status: 'error',
        errorDetail: { message: e.message, stack: e.stack },
      });
    } finally {
      utils.hideSpinner();
    }
  });

  $(document).on(
    'click',
    '.back-link',
    () =>
      (window.location.href = ['edit', 'copy'].includes(mode)
        ? `../call-confirm/call-confirm.html?callId=${utils.globalGetParamCallId}`
        : '../call-list/call-list.html')
  );
}

//===========================
// データ収集
//===========================
function collectData(mode) {
  const items = [];
  $('#call-items-container .call-item-input').each(function () {
    const val = $(this).val().trim();
    if (val) items.push(val);
  });

  const data = {
    title: $('#call-title').val().trim(),
    description: $('#call-description').val().trim(),
    items,
    isOpen: $('#is-open').prop('checked'),
    isAnonymous: $('#is-anonymous').prop('checked'),
    createdAt: utils.serverTimestamp(),
  };
  if (['new', 'copy'].includes(mode))
    data.createdBy = utils.getSession('displayName');
  return data;
}

//===========================
// 入力チェック
//===========================
function validateData() {
  let isValid = true;
  clearErrors();

  const title = $('#call-title').val().trim();
  if (!title) {
    markError($('#call-title'), '必須項目です');
    isValid = false;
  }

  const items = [];
  $('#call-items-container .call-item-input').each(function () {
    const val = $(this).val().trim();
    if (val) items.push(val);
  });
  if (items.length === 0) {
    markError($('#call-items-container'), '募集項目を1つ以上入力してください');
    isValid = false;
  }

  return isValid;
}

//===========================
// 募集項目の追加
//===========================
function addItemToForm(value = '') {
  const $container = $('#call-items-container');
  const $item = $(`
    <div class="call-item">
      <input type="text" class="call-item-input" value="${value}" placeholder="募集項目を入力..." />
      <button type="button" class="remove-item">× 項目を削除</button>
    </div>
  `);
  $item.find('.remove-item').on('click', () => $item.remove());
  $container.append($item);
}

//===========================
// 初期状態保存／復元
//===========================
function captureInitialState() {
  initialState = {
    title: $('#call-title').val(),
    description: $('#call-description').val(),
    items: $('#call-items-container .call-item-input')
      .map(function () {
        return $(this).val();
      })
      .get(),
    isOpen: $('#is-open').prop('checked'),
    isAnonymous: $('#is-anonymous').prop('checked'),
  };
}

function restoreInitialState() {
  $('#call-title').val(initialState.title);
  $('#call-description').val(initialState.description);
  $('#call-items-container').empty();
  initialState.items.forEach((item) => addItemToForm(item));
  $('#is-open').prop('checked', initialState.isOpen);
  $('#is-anonymous').prop('checked', initialState.isAnonymous);
  clearErrors();
}

//===========================
// エラー表示ユーティリティ
//===========================
function clearErrors() {
  $('.error-message').remove();
  $('.error-field').removeClass('error-field');
}
function markError($field, message) {
  $field
    .after(`<div class="error-message">${message}</div>`)
    .addClass('error-field');
}
