import * as utils from '../common/functions.js';

let initialState = {};
let flyerData = { url: '', path: '' };

$(document).ready(async function () {
  try {
    const mode = utils.globalGetParamMode;
    const liveId = utils.globalGetParamLiveId;
    await utils.initDisplay();

    setupBreadcrumbs(mode, liveId);
    await setupPage(mode, liveId);

    captureInitialState();
    setupEventHandlers(mode, liveId);
  } catch (e) {
    console.error(e);
    utils.hideSpinner();
  } finally {
    utils.hideSpinner();
  }
});

function setupBreadcrumbs(mode, liveId) {
  let breadcrumb = [
    { title: 'ライブ一覧', url: '../live-list/live-list.html' },
  ];
  if (mode === 'new') {
    breadcrumb.push({ title: 'ライブ新規登録' });
  } else {
    breadcrumb.push(
      {
        title: 'ライブ確認',
        url: `../live-confirm/live-confirm.html?liveId=${liveId}`,
      },
      { title: mode === 'edit' ? 'ライブ編集' : 'ライブコピー登録' },
    );
  }
  utils.renderBreadcrumb(breadcrumb);
}

async function setupPage(mode, liveId) {
  if (mode === 'new') {
    $('#page-title, #title').text('ライブ新規登録');
    $('#save-button').text('登録する');
  } else {
    const label = mode === 'edit' ? 'ライブ編集' : 'ライブコピー登録';
    $('#page-title, #title').text(label);
    $('#save-button').text(mode === 'edit' ? '更新する' : '登録する');
    await loadLiveData(liveId, mode);
  }
}

async function loadLiveData(liveId, mode) {
  const docSnap = await utils.getWrapDoc(utils.doc(utils.db, 'lives', liveId));
  if (!docSnap.exists()) throw new Error('データが見つかりません');

  const data = docSnap.data();
  $('#live-title').val(data.title + (mode === 'copy' ? '（コピー）' : ''));
  $('#live-date').val(data.date ? data.date.replace(/\./g, '-') : '');

  // 予約設定
  const isAccept = !!data.isAcceptReserve;
  $('#live-isAcceptReserve').prop('checked', isAccept);
  if (isAccept) {
    $('#reserve-settings-area').show();
    $('#live-acceptStartDate').val(
      data.acceptStartDate ? data.acceptStartDate.replace(/\./g, '-') : '',
    );
    $('#live-acceptEndDate').val(
      data.acceptEndDate ? data.acceptEndDate.replace(/\./g, '-') : '',
    );
    $('#live-ticketStock').val(data.ticketStock || '');
    $('#live-maxCompanions').val(data.maxCompanions || '');
  }

  $('#live-open').val(data.open || '');
  $('#live-start').val(data.start || '');
  $('#live-venue').val(data.venue || '');
  $('#live-venueUrl').val(data.venueUrl || '');
  $('#live-venueGoogleMap').val(data.venueGoogleMap || '');
  $('#live-advance').val(data.advance || '');
  $('#live-door').val(data.door || '');
  $('#live-notes').val(data.notes || '');

  if (data.flyerUrl) {
    flyerData = { url: data.flyerUrl, path: data.flyerPath || '' };
    renderFlyerPreview();
  }
}

function setupEventHandlers(mode, liveId) {
  // 予約受付チェックボックスの切り替え
  $('#live-isAcceptReserve').on('change', function () {
    if ($(this).is(':checked')) {
      $('#reserve-settings-area').slideDown();
    } else {
      $('#reserve-settings-area').slideUp();
    }
  });

  $('#btn-file-select').on('click', () => $('#live-file-input').click());

  $('#live-file-input').on('change', async function (e) {
    const file = e.target.files[0];
    if (!file) return;

    utils.showSpinner();
    try {
      const fileName = file.name;
      const path = `lives/flyers/${Date.now()}_${fileName}`;
      const storageRef = utils.ref(utils.storage, path);
      await utils.uploadBytes(storageRef, file);
      const url = await utils.getDownloadURL(storageRef);
      flyerData = { url: url, path: path };
      renderFlyerPreview();
    } catch (err) {
      alert('アップロードに失敗しました');
    } finally {
      utils.hideSpinner();
      $(this).val('');
    }
  });

  $(document).on('click', '.btn-file-delete', function () {
    flyerData = { url: '', path: '' };
    $('#flyer-preview-area').empty();
  });

  $('#save-button').on('click', async () => {
    if (!validateData()) return;
    if (!(await utils.showDialog('保存しますか？'))) return;

    utils.showSpinner();
    try {
      const liveData = collectData(mode);
      let targetId;

      if (mode === 'edit') {
        await utils.updateDoc(utils.doc(utils.db, 'lives', liveId), liveData);
        targetId = liveId;
      } else {
        const docRef = await utils.addDoc(
          utils.collection(utils.db, 'lives'),
          liveData,
        );
        targetId = docRef.id;
      }

      await utils.showDialog('保存完了しました', true);
      window.location.href = `../live-confirm/live-confirm.html?liveId=${targetId}`;
    } catch (e) {
      console.error(e);
      utils.showDialog('保存に失敗しました');
    } finally {
      utils.hideSpinner();
    }
  });

  $('#clear-button').on('click', async () => {
    if (await utils.showDialog('入力を復元しますか？')) restoreInitialState();
  });

  $(document).on('click', '.back-link', () => {
    const url =
      mode === 'new'
        ? '../live-list/live-list.html'
        : `../live-confirm/live-confirm.html?liveId=${utils.globalGetParamLiveId}`;
    window.location.href = url;
  });
}

function validateData() {
  let isValid = true;
  utils.clearErrors();
  const mode = utils.globalGetParamMode;

  // 基本項目のチェック
  const fields = [
    { id: '#live-title', name: 'ライブ名' },
    { id: '#live-date', name: '開催日' },
    { id: '#live-open', name: '開場時間' },
    { id: '#live-start', name: '開演時間' },
    { id: '#live-venue', name: '会場名' },
    { id: '#live-venueUrl', name: '会場URL' },
    { id: '#live-venueGoogleMap', name: 'Google Map URL' },
    { id: '#live-advance', name: '前売料金' },
    { id: '#live-door', name: '当日料金' },
  ];

  fields.forEach((field) => {
    if (!$(field.id).val().trim()) {
      utils.markError($(field.id), '必須項目です');
      isValid = false;
    }
  });

  if (!flyerData.url) {
    utils.markError(
      $('#flyer-upload-group'),
      'フライヤー画像をアップロードしてください',
    );
    isValid = false;
  }

  // 予約受付を行う場合のみ必須チェックを行う
  if ($('#live-isAcceptReserve').is(':checked')) {
    const reserveFields = [
      { id: '#live-acceptStartDate', name: '受付開始日' },
      { id: '#live-acceptEndDate', name: '受付終了日' },
      { id: '#live-ticketStock', name: '販売総数' },
      { id: '#live-maxCompanions', name: '最大同伴人数' },
    ];

    reserveFields.forEach((field) => {
      if (!$(field.id).val().trim()) {
        utils.markError($(field.id), '必須項目です');
        isValid = false;
      }
    });

    const startDate = $('#live-acceptStartDate').val();
    const endDate = $('#live-acceptEndDate').val();

    if (startDate && endDate) {
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T23:59:59');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (
        (mode === 'new' || mode === 'copy') &&
        start.getTime() <= today.getTime()
      ) {
        utils.markError(
          $('#live-acceptStartDate'),
          '開始日は明日以降を指定してください',
        );
        isValid = false;
      }
      if (start.getTime() > end.getTime()) {
        utils.markError(
          $('#live-acceptEndDate'),
          '終了日は開始日以降にしてください',
        );
        isValid = false;
      }
    }
  }

  return isValid;
}

function renderFlyerPreview() {
  const $area = $('#flyer-preview-area').empty();
  if (!flyerData.url) return;
  $area.append(`
    <div class="file-item">
      <span>フライヤー画像設定済み</span>
      <button type="button" class="btn-file-delete"><i class="fas fa-times"></i> 削除</button>
    </div>
    <img src="${flyerData.url}" class="flyer-preview-img">
  `);
}

function collectData(mode) {
  const isAccept = $('#live-isAcceptReserve').is(':checked');

  const data = {
    title: $('#live-title').val().trim(),
    date: $('#live-date').val().replace(/-/g, '.'),
    open: $('#live-open').val().trim(),
    start: $('#live-start').val().trim(),
    venue: $('#live-venue').val().trim(),
    venueUrl: $('#live-venueUrl').val().trim(),
    venueGoogleMap: $('#live-venueGoogleMap').val().trim(),
    advance: $('#live-advance').val().trim(),
    door: $('#live-door').val().trim(),
    flyerUrl: flyerData.url,
    flyerPath: flyerData.path,
    isAcceptReserve: isAccept,
    notes: $('#live-notes').val().trim(),
    updatedAt: utils.serverTimestamp(),
  };

  // 予約受付を行う場合のみデータを追加、行わない場合はプロパティ自体を持たせない(または空にする)
  if (isAccept) {
    data.acceptStartDate = $('#live-acceptStartDate').val().replace(/-/g, '.');
    data.acceptEndDate = $('#live-acceptEndDate').val().replace(/-/g, '.');
    data.ticketStock = Number($('#live-ticketStock').val()) || 0;
    data.maxCompanions = Number($('#live-maxCompanions').val()) || 0;
  } else {
    data.acceptStartDate = '';
    data.acceptEndDate = '';
    data.ticketStock = 0;
    data.maxCompanions = 0;
  }

  if (mode === 'new' || mode === 'copy') {
    data.totalReserved = 0;
    data.createdAt = utils.serverTimestamp();
  }
  return data;
}

function captureInitialState() {
  initialState = collectData();
}

function restoreInitialState() {
  location.reload();
}
