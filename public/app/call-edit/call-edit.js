import * as utils from '../common/functions.js';

let initialState = {};

//===========================
// 初期化
//===========================
$(document).ready(async function () {
  try {
    await utils.initDisplay();

    // 画面ごとのパンくずをセット
    let breadcrumb = [
      { title: '曲募集一覧', url: '../call-list/call-list.html' },
    ];
    if (['new'].includes(utils.globalGetParamMode)) {
      breadcrumb.push({ title: '曲募集新規作成' });
    } else if (['edit', 'copy'].includes(utils.globalGetParamMode)) {
      breadcrumb.push(
        {
          title: '曲募集確認',
          url:
            '../call-confirm/call-confirm.html?callId=' +
            utils.globalGetParamCallId,
        },
        {
          title:
            utils.globalGetParamMode === 'edit'
              ? '曲募集編集'
              : '曲募集新規作成(コピー)',
        }
      );
    }
    utils.renderBreadcrumb(breadcrumb);

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
    // 初期表示で投票項目一つ表示
    $('#call-items-container').append(addItemToForm());
  } else if (mode === 'edit' || mode === 'copy') {
    pageTitle.text(mode === 'edit' ? '曲募集編集' : '曲募集新規作成(コピー)');
    title.text(mode === 'edit' ? '曲募集編集' : '曲募集新規作成(コピー)');
    submitButton.text(mode === 'edit' ? '更新' : '登録');
    backLink.text('← 曲募集確認に戻る');
    await loadCallData(utils.globalGetParamCallId, mode);
  } else {
    throw new Error('モード不正です');
  }

  // 募集受付期間の初期値設定（明日〜13日後）
  if (mode === 'new' || mode === 'copy') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const day13th = new Date();
    day13th.setDate(day13th.getDate() + 13);
    $('#accept-start-date').val(utils.formatDateToYMDHyphen(tomorrow));
    $('#accept-end-date').val(utils.formatDateToYMDHyphen(day13th));
  }
}

//===========================
// データ読み込み
//===========================
async function loadCallData(docId, mode) {
  const docSnap = await utils.getWrapDoc(utils.doc(utils.db, 'calls', docId));
  if (!docSnap.exists()) throw new Error('募集が見つかりません');

  const data = docSnap.data();

  $('#call-title').val(data.title + (mode === 'copy' ? '（コピー）' : ''));
  $('#call-description').val(data.description || '');
  $('#accept-start-date').val(
    data.acceptStartDate
      ? utils.formatDateToYMDHyphen(data.acceptStartDate)
      : ''
  );
  $('#accept-end-date').val(
    data.acceptEndDate ? utils.formatDateToYMDHyphen(data.acceptEndDate) : ''
  );
  $('#is-anonymous').prop('checked', data.isAnonymous || false);

  // 募集ジャンルを復元
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
        window.location.href = `../call-confirm/call-confirm.html?callId=${docRef.id}`;
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
        window.location.href = `../call-confirm/call-confirm.html?callId=${utils.globalGetParamCallId}`;
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
    acceptStartDate: utils.formatDateToYMDDot($('#accept-start-date').val()),
    acceptEndDate: utils.formatDateToYMDDot($('#accept-end-date').val()),
    items,
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
  utils.clearErrors();

  const title = $('#call-title').val().trim();
  if (!title) {
    utils.markError($('#call-title'), '必須項目です');
    isValid = false;
  }

  const description = $('#call-description').val().trim();
  if (!description) {
    utils.markError($('#call-description'), '必須項目です');
    isValid = false;
  }

  const acceptStartDate = $('#accept-start-date').val().trim();
  const acceptEndDate = $('#accept-end-date').val().trim();
  const mode = utils.globalGetParamMode; // モード取得

  // 開始日付必須
  if (!acceptStartDate) {
    utils.markError($('#accept-date'), '必須項目です');
    isValid = false;
  }
  // 終了日付必須
  else if (!acceptEndDate) {
    utils.markError($('#accept-date'), '必須項目です');
    isValid = false;
  }

  // 日付の妥当性チェック
  if (acceptStartDate && acceptEndDate) {
    const start = new Date(acceptStartDate + 'T00:00:00');
    const end = new Date(acceptEndDate + 'T23:59:59');

    // 今日の日付（時刻を00:00:00にリセット）
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ✅ 新規またはコピー時、開始日は明日以降かチェック
    if (mode === 'new' || mode === 'copy') {
      if (start.getTime() <= today.getTime()) {
        utils.markError(
          $('#accept-date'),
          '開始日は明日以降の日付を指定してください'
        );
        isValid = false;
      }
    }

    // ✅ 開始日 > 終了日のチェック
    if (start.getTime() > end.getTime()) {
      utils.markError($('#accept-date'), '終了日は開始日以降にしてください');
      isValid = false;
    }
  }

  const items = [];
  $('#call-items-container .call-item-input').each(function () {
    const val = $(this).val().trim();
    if (val) items.push(val);
  });
  if (items.length === 0) {
    utils.markError(
      $('#call-items-container'),
      '募集ジャンルを1つ以上入力してください'
    );
    isValid = false;
  } else {
    // 重複チェック
    const uniqueItems = new Set(items);
    if (uniqueItems.size !== items.length) {
      utils.markError(
        $('#call-items-container'),
        '募集ジャンルが重複しています'
      );
      isValid = false;
    }
  }

  return isValid;
}

//===========================
// 募集ジャンルの追加
//===========================
function addItemToForm(value = '') {
  const $container = $('#call-items-container');
  const $item = $(`
    <div class="call-item">
      <input type="text" class="call-item-input" value="${value}" placeholder="募集ジャンルを入力..." />
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
    acceptStartDate: $('#accept-start-date').val(),
    acceptEndDate: $('#accept-end-date').val(),
    items: $('#call-items-container .call-item-input')
      .map(function () {
        return $(this).val();
      })
      .get(),
    isAnonymous: $('#is-anonymous').prop('checked'),
  };
}

function restoreInitialState() {
  $('#call-title').val(initialState.title);
  $('#call-description').val(initialState.description);
  $('#accept-start-date').val(initialStateHtml.acceptStartDate || ''); // ← yyyy-MM-dd形式
  $('#accept-end-date').val(initialStateHtml.acceptEndDate || ''); // ← yyyy-MM-dd形式
  $('#call-items-container').empty();
  initialState.items.forEach((item) => addItemToForm(item));
  $('#is-anonymous').prop('checked', initialState.isAnonymous);
  utils.clearErrors();
}
