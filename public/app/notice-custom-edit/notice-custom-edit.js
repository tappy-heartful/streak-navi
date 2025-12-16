import * as utils from '../common/functions.js';

let initialState = {};

$(document).ready(async function () {
  try {
    const mode = utils.globalGetParamMode || 'new';
    let noticeId = utils.globalGetparams.get('noticeId');

    await utils.initDisplay();

    let breadcrumb = [
      { title: '通知設定一覧', url: '../notice-list/notice-list.html' },
    ];

    if (mode === 'new') {
      breadcrumb.push({ title: 'カスタム通知新規作成' });
    } else {
      breadcrumb.push(
        {
          title: 'カスタム通知確認',
          url: `../notice-custom-confirm/notice-custom-confirm.html?noticeId=${noticeId}`,
        },
        {
          title:
            mode === 'copy'
              ? 'カスタム通知新規作成(コピー)'
              : 'カスタム通知編集',
        }
      );
    }
    utils.renderBreadcrumb(breadcrumb);

    await setupPage(mode, noticeId);

    captureInitialState(mode, noticeId);
    setupEventHandlers(mode, noticeId);
  } catch (e) {
    await utils.writeLog({
      dataId: 'custom',
      action: 'カスタム通知編集',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

async function setupPage(mode, targetId) {
  const pageTitle = $('#page-title');
  const title = $('#title');
  const submitButton = $('#save-button');
  const backLink = $('.back-link');

  if (mode === 'new') {
    pageTitle.text('カスタム通知新規作成');
    title.text('カスタム通知新規作成');
    submitButton.text('登録');
    backLink.text('← カスタム通知一覧に戻る');
  } else if (mode === 'edit' || mode === 'copy') {
    pageTitle.text(
      mode === 'edit' ? 'カスタム通知編集' : 'カスタム通知新規作成(コピー)'
    );
    title.text(
      mode === 'edit' ? 'カスタム通知編集' : 'カスタム通知新規作成(コピー)'
    );
    submitButton.text(mode === 'edit' ? '更新' : '登録');
    backLink.text('← カスタム通知確認に戻る');
  }

  if (targetId) {
    await loadCustomNotice(targetId);
  } else {
    // 💡 新規作成時は空のセクションを1つだけ作成
    addSingleDateSection();
  }
}

// データ読み込み（カスタム通知）
async function loadCustomNotice(id) {
  const docSnap = await utils.getWrapDoc(utils.doc(utils.db, 'notices', id));
  if (docSnap.exists()) {
    const d = docSnap.data();

    // 紐づけ対象の復元
    if (d.relatedType) {
      await loadRelatedOptions(d.relatedType, d.relatedId);
    }
    $('#related-type').val(d.relatedType || 'none');

    // スケジュールの復元（最初の1つだけ使用）
    if (d.schedules && d.schedules.length > 0) {
      addSingleDateSection(d.schedules[0]);
    } else {
      addSingleDateSection();
    }
  } else {
    addSingleDateSection();
  }
}

async function loadRelatedOptions(type, selectedId) {
  const $typeSelect = $('#related-type');
  const $idSelect = $('#related-id');
  $typeSelect.val(type);

  if (type === 'none') {
    $idSelect.addClass('hidden').empty();
    return;
  }

  utils.showSpinner();
  const snap = await utils.getWrapDocs(utils.collection(utils.db, type));
  let docs = snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));

  if (type === 'events') {
    docs.sort((a, b) =>
      (a.data.date || '9999/12/31').localeCompare(b.data.date || '9999/12/31')
    );
  }

  $idSelect.empty().append('<option value="">対象を選択してください</option>');
  docs.forEach((doc) => {
    const d = doc.data;
    let title = d.title || d.name || '名称未設定';
    if (type === 'events' && d.date) title = `${d.date} ${title}`;
    $idSelect.append(`<option value="${doc.id}">${title}</option>`);
  });

  $idSelect.val(selectedId).removeClass('hidden');
  utils.hideSpinner();
}

async function setupRelatedDate() {
  const type = $('#related-type').val();
  const relatedId = $('#related-id').val();
  if (type !== 'events' || !relatedId) return;

  const $dateInput = $('.schedule-date-input');
  utils.showSpinner();
  try {
    const docSnap = await utils.getWrapDoc(
      utils.doc(utils.db, type, relatedId)
    );
    if (docSnap.exists()) {
      const date = docSnap.data().date;
      if (date) $dateInput.val(date.replace(/[\./]/g, '-'));
    }
  } catch (e) {
    console.error(e);
  } finally {
    utils.hideSpinner();
  }
}

// 💡 1つ固定の日付セクションを生成する関数に統合
function addSingleDateSection(
  schedule = {
    scheduledDate: '',
    notifications: [{ scheduledTime: '09:00', message: '' }],
  }
) {
  const $container = $('#schedule-container');
  $container.empty(); // 念のため空に

  const $dateSection = $(`
    <div class="date-section">
      <div class="date-header">
        <h4>通知日 <span class="required">*</span></h4>
        <div class="date-control">
          <input type="date" class="schedule-date-input" value="${schedule.scheduledDate.replace(
            /\./g,
            '-'
          )}" />
        </div>
      </div>
      <div class="time-message-container"></div>
      <button type="button" class="add-time-button add-button">
        + 時間/メッセージを追加
      </button>
    </div>
  `);

  $container.append($dateSection);
  const $timeContainer = $dateSection.find('.time-message-container');

  schedule.notifications.forEach((notification) => {
    addTimeMessageGroup($timeContainer, notification);
  });
}

function addTimeMessageGroup(
  $container,
  notification = { scheduledTime: '09:00', message: '' }
) {
  const $group = $(`
    <div class="time-message-group">
      <div class="form-group-time-msg">
        <div class="form-sub form-sub-time">
          <div class="time-input-control">
            <input type="time" class="schedule-time-input" value="${
              notification.scheduledTime || '09:00'
            }" />
            <button type="button" class="remove-time-button remove-button" title="この通知を削除">
              <i class="fas fa-minus-circle"></i>
            </button>
          </div>
        </div>
        <div class="form-sub form-sub-msg">
          <textarea class="schedule-message-input" rows="4" placeholder="通知メッセージ...">${
            notification.message || ''
          }</textarea>
        </div>
      </div>
    </div>
  `);

  $container.append($group);
  updateRemoveButtons($container);
}

function updateRemoveButtons($container) {
  const count = $container.children('.time-message-group').length;
  $container.find('.remove-time-button').toggle(count > 1);
}

function setupEventHandlers(mode, noticeId) {
  // 時間/メッセージ項目の追加
  $(document).on('click', '.add-time-button', function () {
    const $container = $(this).siblings('.time-message-container');
    let newTime = '09:00';
    const $lastTime = $container.find('.schedule-time-input:last');
    if ($lastTime.length > 0) newTime = $lastTime.val();

    addTimeMessageGroup($container, { scheduledTime: newTime, message: '' });
  });

  // 時間/メッセージ項目の削除
  $(document).on('click', '.remove-time-button', function () {
    const $container = $(this).closest('.time-message-container');
    $(this).closest('.time-message-group').remove();
    updateRemoveButtons($container);
  });

  $('#related-type').on('change', async function () {
    await loadRelatedOptions($(this).val(), '');
  });

  $('#related-id').on('change', setupRelatedDate);

  $('#clear-button').on('click', async () => {
    if (await utils.showDialog('入力をリセットしますか？'))
      restoreInitialState();
  });

  $('#save-button').on('click', async () => {
    if (!validateData()) return;
    if (!(await utils.showDialog('保存しますか？'))) return;

    utils.showSpinner();
    try {
      let currentNoticeId = utils.globalGetparams.get('noticeId');
      const currentMode = utils.globalGetParamMode || 'new';
      const isNew =
        currentMode === 'new' || currentMode === 'copy' || !currentNoticeId;
      const data = collectCustomData();

      if (!isNew) {
        await utils.updateDoc(
          utils.doc(utils.db, 'notices', currentNoticeId),
          data
        );
      } else {
        const docRef = await utils.addDoc(
          utils.collection(utils.db, 'notices'),
          data
        );
        currentNoticeId = docRef.id;
      }

      await utils.showDialog('保存しました', true);
      window.location.href = `../notice-custom-confirm/notice-custom-confirm.html?noticeId=${currentNoticeId}`;
    } catch (e) {
      utils.hideSpinner();
      await utils.showDialog('保存に失敗しました');
    }
  });

  $(document).on('click', '.back-link', () => {
    const currentMode = utils.globalGetParamMode || 'new';
    if (currentMode === 'new') {
      window.location.href = '../notice-list/notice-list.html';
    } else {
      window.location.href = `../notice-custom-confirm/notice-custom-confirm.html?noticeId=${noticeId}`;
    }
  });
}

function collectCustomData() {
  const relId = $('#related-id').val();
  const relTitle = $('#related-id option:selected').text();
  const schedules = [];

  const $dateSection = $('.date-section');
  const scheduledDateYMD = $dateSection.find('.schedule-date-input').val();

  const notifications = [];
  $dateSection.find('.time-message-group').each(function () {
    notifications.push({
      scheduledTime: $(this).find('.schedule-time-input').val(),
      message: $(this).find('.schedule-message-input').val(),
    });
  });

  let scheduledDateDot;
  if (scheduledDateYMD) {
    scheduledDateDot = utils.formatDateToYMDDot(scheduledDateYMD);
    schedules.push({
      scheduledDate: scheduledDateDot,
      notifications: notifications,
    });
  }

  return {
    relatedType: $('#related-type').val(),
    relatedId: relId || '',
    relatedTitle: relId ? relTitle : '',
    schedules: schedules,
    activeDate: scheduledDateDot,
    updatedAt: utils.serverTimestamp(),
    createdAt: utils.serverTimestamp(), // 新規保存時に本来は使い分けが必要
  };
}

function validateData() {
  utils.clearErrors();
  let isValid = true;
  const $dateInput = $('.schedule-date-input');
  if (!$dateInput.val()) {
    utils.markError($dateInput, '日付は必須です');
    isValid = false;
  }

  $('.time-message-group').each(function () {
    const $timeInput = $(this).find('.schedule-time-input');
    const $msgInput = $(this).find('.schedule-message-input');
    if (!$timeInput.val()) {
      utils.markError($timeInput, '時刻は必須');
      isValid = false;
    }
    if (!$msgInput.val()) {
      utils.markError($msgInput, 'メッセージは必須');
      isValid = false;
    }
  });

  return isValid;
}

function captureInitialState() {}
function restoreInitialState() {
  location.reload();
}
