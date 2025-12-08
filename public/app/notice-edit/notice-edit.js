import * as utils from '../common/functions.js';

let scoresCache = [];

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    const mode = utils.globalGetParamMode;
    utils.renderBreadcrumb([
      { title: '通知一覧', url: '../notice-list/notice-list.html' },
      { title: '通知編集' },
    ]);
    await setUpPage(mode);
  } catch (e) {
    utils.hideSpinner();
  }
});

async function setUpPage(mode) {
  const noticeId = utils.globalGetparams.get('noticeId');

  if (mode === 'base') {
    $('#base-edit-section').removeClass('hidden');
    await loadBaseConfig();
  } else {
    $('#custom-edit-section').removeClass('hidden');
    setupCustomHandlers();
    if (noticeId) await loadCustomNotice(noticeId);
  }

  $('#save-button').on('click', () => saveNotice(mode, noticeId));
  $('#clear-button').on('click', () => location.reload());
}

// カスタム設定時の動的プルダウン
function setupCustomHandlers() {
  $('#related-type').on('change', async function () {
    const type = $(this).val();
    const $target = $('#related-id');

    if (type === 'none') {
      $target.addClass('hidden').empty();
      return;
    }

    utils.showSpinner();
    const snap = await utils.getWrapDocs(utils.collection(utils.db, type));
    $target.empty().append('<option value="">対象を選択してください</option>');

    snap.docs.forEach((doc) => {
      const d = doc.data();
      $target.append(`<option value="${doc.id}">${d.title || d.name}</option>`);
    });

    $target.removeClass('hidden');
    utils.hideSpinner();
  });
}

async function loadBaseConfig() {
  const docSnap = await utils.getWrapDoc(
    utils.doc(utils.db, 'configs', 'noticeBase')
  );
  if (docSnap.exists()) {
    const d = docSnap.data();
    $('#event-notify').prop('checked', d.eventNotify);
    $('#event-days').val(d.eventDaysBefore);
    $('#event-msg').val(d.eventMessage);
    // 投票・募集も同様に反映...
  }
}

async function saveNotice(mode, noticeId) {
  utils.showSpinner();
  const data = {};

  if (mode === 'base') {
    // 基本設定の保存
    const baseData = {
      eventNotify: $('#event-notify').prop('checked'),
      eventDaysBefore: parseInt($('#event-days').val()),
      eventMessage: $('#event-msg').val(),
      // 投票・募集...
    };
    await utils.setDoc(utils.doc(utils.db, 'configs', 'noticeBase'), baseData);
  } else {
    // カスタム通知の保存
    const customData = {
      title: $('#custom-title').val(),
      scheduledDate: $('#custom-date').val().replace(/-/g, '.'),
      scheduledTime: $('#custom-time').val(),
      relatedType: $('#related-type').val(),
      relatedId: $('#related-id').val(),
      message: $('#custom-message').val(),
      createdAt: utils.serverTimestamp(),
    };

    if (noticeId) {
      await utils.updateDoc(
        utils.doc(utils.db, 'notices', noticeId),
        customData
      );
    } else {
      await utils.addDoc(utils.collection(utils.db, 'notices'), customData);
    }
  }

  await utils.showDialog('保存しました', true);
  window.location.href = '../notice-list/notice-list.html';
}
