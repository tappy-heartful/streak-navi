import * as utils from '../common/functions.js';

let initialState = {};
let flyerData = { url: '', path: '' }; // ライブは画像1枚なのでオブジェクト管理

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
  const backLink = $('.back-link');
  if (mode === 'new') {
    $('#page-title, #title').text('ライブ新規登録');
    $('#save-button').text('登録する');
    backLink.text('← ライブ一覧に戻る');
  } else {
    const label = mode === 'edit' ? 'ライブ編集' : 'ライブコピー登録';
    $('#page-title, #title').text(label);
    $('#save-button').text(mode === 'edit' ? '更新する' : '登録する');
    backLink.text('← ライブ確認に戻る');
    await loadLiveData(liveId, mode);
  }
}

async function loadLiveData(liveId, mode) {
  const docSnap = await utils.getWrapDoc(utils.doc(utils.db, 'lives', liveId));
  if (!docSnap.exists()) throw new Error('データが見つかりません');

  const data = docSnap.data();
  $('#live-title').val(data.title + (mode === 'copy' ? '（コピー）' : ''));

  // 日付を input type="date" 用のフォーマット (YYYY-MM-DD) に変換してセット
  $('#live-date').val(data.date ? data.date.replace(/\./g, '-') : '');
  $('#live-acceptStartDate').val(
    data.acceptStartDate ? data.acceptStartDate.replace(/\./g, '-') : '',
  );
  $('#live-acceptEndDate').val(
    data.acceptEndDate ? data.acceptEndDate.replace(/\./g, '-') : '',
  );

  $('#live-open').val(data.open || '');
  $('#live-start').val(data.start || '');
  $('#live-venue').val(data.venue || '');
  $('#live-venueUrl').val(data.venueUrl || '');
  $('#live-venueGoogleMap').val(data.venueGoogleMap || '');
  $('#live-advance').val(data.advance || '');
  $('#live-door').val(data.door || '');
  $('#live-isAcceptReserve').prop('checked', !!data.isAcceptReserve);
  $('#live-ticketStock').val(data.ticketStock || '');
  $('#live-maxCompanions').val(data.maxCompanions || '');
  $('#live-notes').val(data.notes || '');

  // フライヤーは表示（コピー時も画像は引き継ぐ）
  if (data.flyerUrl) {
    flyerData = { url: data.flyerUrl, path: data.flyerPath || '' };
    renderFlyerPreview();
  }
}

function setupEventHandlers(mode, liveId) {
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
      await utils.writeLog({
        dataId: liveId || 'new',
        action: 'ライブ更新',
        status: 'error',
        errorDetail: { message: e.message, stack: e.stack },
      });
      utils.showDialog('保存に失敗しました');
    } finally {
      utils.hideSpinner();
    }
  });

  $('#clear-button').on('click', async () => {
    if (await utils.showDialog('入力を復元しますか？')) restoreInitialState();
  });
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
  // 保存時はハイフンをドット (YYYY.MM.DD) に戻す
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
    isAcceptReserve: $('#live-isAcceptReserve').is(':checked'),
    acceptStartDate: $('#live-acceptStartDate').val().replace(/-/g, '.'),
    acceptEndDate: $('#live-acceptEndDate').val().replace(/-/g, '.'),
    ticketStock: Number($('#live-ticketStock').val()) || 0,
    maxCompanions: Number($('#live-maxCompanions').val()) || 0,
    notes: $('#live-notes').val().trim(),
    updatedAt: utils.serverTimestamp(),
  };

  if (mode === 'new' || mode === 'copy') {
    data.totalReserved = 0;
    data.createdAt = utils.serverTimestamp();
  }

  return data;
}

function validateData() {
  if (!$('#live-title').val().trim() || !$('#live-date').val()) {
    utils.showDialog('タイトルと日付は必須です');
    return false;
  }
  return true;
}

function captureInitialState() {
  initialState = collectData();
}

function restoreInitialState() {
  location.reload();
}
