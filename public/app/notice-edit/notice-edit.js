import * as utils from '../common/functions.js';

let initialState = {};

$(document).ready(async function () {
  try {
    const mode = utils.globalGetParamMode;
    const noticeId = utils.globalGetparams.get('noticeId');
    await utils.initDisplay();

    // 画面ごとのパンくずをセット
    let breadcrumb = [
      { title: '通知一覧', url: '../notice-list/notice-list.html' },
    ];
    if (['new'].includes(mode)) {
      breadcrumb.push({ title: '通知編集' });
    } else {
      breadcrumb.push(
        {
          title: '通知確認',
          url: `../notice-confirm/notice-confirm.html?mode=${mode}
        ${mode === 'base' ? '' : `&noticeId=${noticeId}`}`,
        },
        { title: mode === 'new' ? '通知新規作成' : '通知編集' }
      );
    }
    utils.renderBreadcrumb(breadcrumb);

    await setupPage(mode, noticeId);
    captureInitialState(mode, noticeId);
    setupEventHandlers(mode, noticeId);
  } catch (e) {
    await utils.writeLog({
      dataId: 'none',
      action: '通知編集',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

async function setupPage(mode, noticeId) {
  if (mode === 'base') {
    $('#page-title').text('通知基本設定');
    $('#base-config-section').removeClass('hidden');
    await loadBaseConfig();
  } else {
    $('#page-title').text(noticeId ? 'カスタム通知編集' : 'カスタム通知作成');
    $('#custom-config-section').removeClass('hidden');
    if (noticeId) await loadCustomNotice(noticeId);
  }
}

// データ読み込み（基本設定）
async function loadBaseConfig() {
  const docSnap = await utils.getWrapDoc(
    utils.doc(utils.db, 'configs', 'noticeBase')
  );
  if (docSnap.exists()) {
    const d = docSnap.data();
    $('#base-event-notify').prop('checked', d.eventNotify);
    $('#base-event-days').val(d.eventDaysBefore);
    $('#base-event-msg').val(d.eventMessage);
    $('#base-vote-notify').prop('checked', d.voteNotify);
    $('#base-vote-days').val(d.voteDaysBefore);
    $('#base-vote-msg').val(d.voteMessage);
    $('#base-call-notify').prop('checked', d.callNotify);
    $('#base-call-days').val(d.callDaysBefore);
    $('#base-call-msg').val(d.callMessage);
  }
}

// データ読み込み（カスタム通知）
async function loadCustomNotice(id) {
  const docSnap = await utils.getWrapDoc(utils.doc(utils.db, 'notices', id));
  if (docSnap.exists()) {
    const d = docSnap.data();
    $('#custom-title').val(d.title);
    $('#custom-date').val(utils.formatDateToYMDHyphen(d.scheduledDate));
    $('#custom-time').val(d.scheduledTime);
    $('#custom-message').val(d.message);

    // 紐づけ対象の復元
    if (d.relatedType !== 'none') {
      $('#related-type').val(d.relatedType).trigger('change');
      // IDのセットは非同期ロード後に行うため、setTimeout等で微調整が必要な場合あり
      setTimeout(() => $('#related-id').val(d.relatedId), 500);
    }
  }
}

function setupEventHandlers(mode, noticeId) {
  // カスタム通知：紐づけ対象の動的切り替え
  $('#related-type').on('change', async function () {
    const type = $(this).val();
    const $idSelect = $('#related-id');

    if (type === 'none') {
      $idSelect.addClass('hidden').empty();
      return;
    }

    utils.showSpinner();
    const snap = await utils.getWrapDocs(utils.collection(utils.db, type));
    $idSelect
      .empty()
      .append('<option value="">対象を選択してください</option>');
    snap.docs.forEach((doc) => {
      const d = doc.data();
      $idSelect.append(
        `<option value="${doc.id}">${
          d.title || d.name || '名称未設定'
        }</option>`
      );
    });
    $idSelect.removeClass('hidden');
    utils.hideSpinner();
  });

  $('#clear-button').on('click', () => restoreInitialState(mode));

  $('#save-button').on('click', async () => {
    if (!validateData(mode)) return;
    const confirm = await utils.showDialog('設定を保存しますか？');
    if (!confirm) return;

    utils.showSpinner();
    try {
      const noticeId = utils.globalGetparams.get('noticeId');
      if (mode === 'base') {
        const data = collectBaseData();
        await utils.setDoc(utils.doc(utils.db, 'configs', 'noticeBase'), data);
      } else {
        const data = collectCustomData();
        if (noticeId) {
          await utils.updateDoc(utils.doc(utils.db, 'notices', noticeId), data);
        } else {
          await utils.addDoc(utils.collection(utils.db, 'notices'), data);
        }
      }
      await utils.showDialog('保存しました', true);
      window.location.href = `../notice-comfirm/notice-comfirm.html?mode=${mode}
        ${mode === 'base' ? '' : `&noticeId=${noticeId}`}`;
    } catch (e) {
      utils.hideSpinner();
      await utils.showDialog('エラーが発生しました');
    }
  });

  $(document).on(
    'click',
    '.back-link',
    () =>
      (window.location.href = ['new'].includes(mode)
        ? '../notice-list/notice-list.html'
        : `../notice-confirm/notice-confirm.html?mode=${mode}
        ${mode === 'base' ? '' : `&noticeId=${noticeId}`}`)
  );
}

function collectBaseData() {
  return {
    eventNotify: $('#base-event-notify').prop('checked'),
    eventDaysBefore: parseInt($('#base-event-days').val()) || 0,
    eventMessage: $('#base-event-msg').val(),
    voteNotify: $('#base-vote-notify').prop('checked'),
    voteDaysBefore: parseInt($('#base-vote-days').val()) || 0,
    voteMessage: $('#base-vote-msg').val(),
    callNotify: $('#base-call-notify').prop('checked'),
    callDaysBefore: parseInt($('#base-call-days').val()) || 0,
    callMessage: $('#base-call-msg').val(),
    updatedAt: utils.serverTimestamp(),
  };
}

function collectCustomData() {
  const relId = $('#related-id').val();
  const relTitle = $('#related-id option:selected').text();
  return {
    title: $('#custom-title').val(),
    scheduledDate: utils.formatDateToYMDDot($('#custom-date').val()),
    scheduledTime: $('#custom-time').val(),
    relatedType: $('#related-type').val(),
    relatedId: relId || '',
    relatedTitle: relId ? relTitle : '',
    message: $('#custom-message').val(),
    createdAt: utils.serverTimestamp(),
  };
}

function validateData(mode) {
  utils.clearErrors();
  if (mode === 'base') return true; // 基本設定は任意

  let isValid = true;
  if (!$('#custom-title').val()) {
    utils.markError($('#custom-title'), '必須');
    isValid = false;
  }
  if (!$('#custom-date').val()) {
    utils.markError($('#custom-date'), '必須');
    isValid = false;
  }
  if (!$('#custom-time').val()) {
    utils.markError($('#custom-time'), '必須');
    isValid = false;
  }
  if (!$('#custom-message').val()) {
    utils.markError($('#custom-message'), '必須');
    isValid = false;
  }
  return isValid;
}

function captureInitialState(mode, noticeId) {
  /* 復元ロジック（省略可、reloadで代用） */
}
function restoreInitialState(mode) {
  location.reload();
}
