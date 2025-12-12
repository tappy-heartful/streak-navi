import * as utils from '../common/functions.js';

let initialState = {};

$(document).ready(async function () {
  try {
    const mode = utils.globalGetParamMode || 'new';
    const noticeId = utils.globalGetparams.get('noticeId');
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
        { title: 'カスタム通知編集' }
      );
    }
    utils.renderBreadcrumb(breadcrumb);

    await setupPage(mode, noticeId);
    captureInitialState(mode, noticeId);
    setupEventHandlers(mode, noticeId);
  } catch (e) {
    await utils.writeLog({
      dataId: 'custom',
      action: 'カスタム通知設定編集',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

async function setupPage(mode, noticeId) {
  $('#page-title').text(
    mode === 'new' ? 'カスタム通知新規作成' : 'カスタム通知編集'
  );

  if (noticeId) {
    await loadCustomNotice(noticeId);
  } else {
    addDateSection();
  }
}

// データ読み込み（カスタム通知）
async function loadCustomNotice(id) {
  const docSnap = await utils.getWrapDoc(utils.doc(utils.db, 'notices', id));
  if (docSnap.exists()) {
    const d = docSnap.data();

    // 紐づけ対象の復元
    if (d.relatedType) {
      // relatedTypeがセットされていれば、それがnoneであってもloadRelatedOptionsを呼ぶ
      await loadRelatedOptions(d.relatedType, d.relatedId);
    }
    $('#related-type').val(d.relatedType || 'none');

    // スケジュールの復元
    if (d.schedules && d.schedules.length > 0) {
      d.schedules.forEach((schedule) => {
        addDateSection(schedule);
      });
    } else {
      addDateSection();
    }
  } else {
    addDateSection();
  }
}

// 紐づけ対象のオプションをロードし、選択状態を復元する
async function loadRelatedOptions(type, selectedId) {
  const $typeSelect = $('#related-type');
  const $idSelect = $('#related-id');

  $typeSelect.val(type);

  if (type === 'none') {
    // 💡 【修正】紐づけなしの場合、DBアクセスをスキップし、プルダウンを空にして隠す
    $idSelect.addClass('hidden').empty();
    return;
  }

  utils.showSpinner();

  // typeが'events', 'votes', 'calls'のいずれかであることを期待
  const snap = await utils.getWrapDocs(utils.collection(utils.db, type));

  let docs = snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));

  // イベントの場合、日付で昇順ソート
  if (type === 'events') {
    docs.sort((a, b) => {
      const dateA = a.data.date || '9999/12/31';
      const dateB = b.data.date || '9999/12/31';
      return dateA.localeCompare(dateB);
    });
  }

  $idSelect.empty().append('<option value="">対象を選択してください</option>');

  docs.forEach((doc) => {
    const d = doc.data;
    let title = d.title || d.name || '名称未設定';

    // イベントの場合、日付をタイトルに追加
    if (type === 'events' && d.date) {
      title = `${d.date} ${title}`;
    }

    $idSelect.append(`<option value="${doc.id}">${title}</option>`);
  });

  $idSelect.val(selectedId).removeClass('hidden');
  utils.hideSpinner();
}

function addDateSection(
  schedule = {
    scheduledDate: '',
    notifications: [{ scheduledTime: '', message: '' }],
  }
) {
  const dateId = utils.generateUniqueId();
  const $container = $('#schedule-container');

  const $dateSection = $(`
    <div class="date-section" data-date-id="${dateId}">
      <div class="date-header">
        <h4>通知日 <span class="required">*</span></h4>
        <div class="date-control">
          <input type="date" class="schedule-date-input" value="${schedule.scheduledDate}" />
          <button type="button" class="remove-date-button remove-button" title="通知日を削除">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>
      <div class="time-message-container">
        </div>
      <button type="button" class="add-time-button add-button" data-date-id="${dateId}">
        + 時間/メッセージを追加
      </button>
    </div>
  `);

  $container.append($dateSection);
  const $timeContainer = $dateSection.find('.time-message-container');

  // 時間/メッセージ項目の追加
  schedule.notifications.forEach((notification) => {
    addTimeMessageGroup($timeContainer, notification);
  });

  if (schedule.notifications.length === 0) {
    addTimeMessageGroup($timeContainer);
  }
}

function addTimeMessageGroup(
  $container,
  notification = { scheduledTime: '09:00', message: '' }
) {
  const timeId = utils.generateUniqueId();
  const $group = $(`
    <div class="time-message-group" data-time-id="${timeId}">
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
          <textarea class="schedule-message-input" rows="3" placeholder="通知メッセージ...">${
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
  // 💡 【修正】 time-input-control 内の削除ボタンを操作
  $container.find('.remove-time-button').toggle(count > 1);
}

function setupEventHandlers(mode, noticeId) {
  // 日付セクションの追加
  $('#add-date-button').on('click', () => addDateSection());

  // 日付セクションの削除
  $(document).on('click', '.remove-date-button', function () {
    if ($('.date-section').length > 1) {
      $(this).closest('.date-section').remove();
    } else {
      utils.showDialog('通知スケジュールは最低1つ必要です。');
    }
  });

  // 時間/メッセージ項目の追加
  $(document).on('click', '.add-time-button', function () {
    const $container = $(this).siblings('.time-message-container');
    addTimeMessageGroup($container);
  });

  // 時間/メッセージ項目の削除
  $(document).on('click', '.remove-time-button', function () {
    const $container = $(this)
      .closest('.date-section')
      .find('.time-message-container');
    $(this).closest('.time-message-group').remove();
    updateRemoveButtons($container);
  });

  // 紐づけ対象の動的切り替え
  $('#related-type').on('change', async function () {
    const type = $(this).val();
    const selectedId = $('#related-id').val();
    await loadRelatedOptions(type, selectedId);
  });

  $('#clear-button').on('click', async () => {
    if (
      await utils.showDialog(
        mode === 'new' ? '入力内容をクリアしますか？' : '編集前に戻しますか？'
      )
    )
      restoreInitialState();
  });

  $('#save-button').on('click', async () => {
    if (!validateData()) return;
    const confirm = await utils.showDialog('設定を保存しますか？');
    if (!confirm) return;

    utils.showSpinner();
    try {
      let noticeId = utils.globalGetparams.get('noticeId');
      const data = collectCustomData();

      if (noticeId) {
        await utils.updateDoc(utils.doc(utils.db, 'notices', noticeId), data);
      } else {
        const docRef = await utils.addDoc(
          utils.collection(utils.db, 'notices'),
          data
        );
        noticeId = docRef.id;
      }

      await utils.showDialog('保存しました', true);
      window.location.href = `../notice-custom-confirm/notice-custom-confirm.html?noticeId=${noticeId}`;
    } catch (e) {
      utils.hideSpinner();
      await utils.showDialog('エラーが発生しました');
    }
  });

  $(document).on(
    'click',
    '.back-link',
    () =>
      (window.location.href =
        mode === 'new'
          ? '../notice-list/notice-list.html'
          : `../notice-custom-confirm/notice-custom-confirm.html?noticeId=${noticeId}`)
  );
}

function collectCustomData() {
  const relId = $('#related-id').val();
  const relTitle = $('#related-id option:selected').text();

  const schedules = [];

  $('.date-section').each(function () {
    const $dateSection = $(this);
    const scheduledDate = $dateSection.find('.schedule-date-input').val();

    const notifications = [];
    $dateSection.find('.time-message-group').each(function () {
      const $timeGroup = $(this);
      notifications.push({
        scheduledTime: $timeGroup.find('.schedule-time-input').val(),
        message: $timeGroup.find('.schedule-message-input').val(),
      });
    });

    if (scheduledDate && notifications.length > 0) {
      schedules.push({
        scheduledDate: utils.formatDateToYMDDot(scheduledDate),
        notifications: notifications,
      });
    }
  });

  return {
    relatedType: $('#related-type').val(),
    relatedId: relId || '',
    relatedTitle: relId ? relTitle : '',
    schedules: schedules,
    createdAt: utils.serverTimestamp(),
  };
}

function validateData() {
  utils.clearErrors();
  let isValid = true;
  let hasSchedule = false;

  $('.date-section').each(function () {
    const $dateInput = $(this).find('.schedule-date-input');
    const scheduledDate = $dateInput.val();

    if (!scheduledDate) {
      utils.markError($dateInput, '日付は必須');
      isValid = false;
    } else {
      hasSchedule = true;
    }

    let hasNotification = false;
    $(this)
      .find('.time-message-group')
      .each(function () {
        const $timeInput = $(this).find('.schedule-time-input');
        const $msgInput = $(this).find('.schedule-message-input');

        const scheduledTime = $timeInput.val();
        const message = $msgInput.val();

        if (!scheduledTime) {
          utils.markError($timeInput, '時刻は必須');
          isValid = false;
        }
        if (!message) {
          utils.markError($msgInput, 'メッセージは必須');
          isValid = false;
        }

        if (scheduledTime && message) {
          hasNotification = true;
        }
      });

    if (scheduledDate && !hasNotification) {
      utils.showDialog(
        '通知日には、少なくとも1つの時間とメッセージの設定が必要です。'
      );
      isValid = false;
    }
  });

  if (!hasSchedule) {
    utils.showDialog(
      '通知スケジュールは最低1つ、日付と時間/メッセージの設定が必要です。'
    );
    isValid = false;
  }

  return isValid;
}

function captureInitialState() {
  /* 復元ロジック（省略可、reloadで代用） */
}
function restoreInitialState() {
  location.reload();
}
