import * as utils from '../common/functions.js';

let initialState;

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    const mode = utils.globalGetParamMode; // 'new' or 'edit'
    const studioId = new URLSearchParams(window.location.search).get(
      'studioId'
    );

    // 1. 都道府県プルダウンの準備
    await setupPrefectureSelect();

    // 2. 画面モードに応じた初期化
    await setupPage(mode, studioId);

    // 3. イベントハンドラ登録
    setupEventHandlers(mode, studioId);
  } catch (e) {
    console.error(e);
    utils.hideSpinner();
  } finally {
    utils.hideSpinner();
  }
});

/**
 * 都道府県プルダウン作成
 */
async function setupPrefectureSelect() {
  const prefRef = utils.collection(utils.db, 'prefectures');
  const q = utils.query(prefRef, utils.orderBy('order', 'asc'));
  const snap = await utils.getWrapDocs(q);

  const $select = $('#studio-prefecture');
  snap.docs.forEach((doc) => {
    $select.append(`<option value="${doc.id}">${doc.data().name}</option>`);
  });
}

/**
 * モード別表示設定
 */
async function setupPage(mode, studioId) {
  if (mode === 'edit' && studioId) {
    $('#page-title, #title').text('スタジオ編集');
    $('#save-button').text('更新');
    await loadStudioData(studioId);
  } else {
    $('#page-title, #title').text('スタジオ新規作成');
    $('#save-button').text('登録');
    renderRooms(['']); // 空の入力欄を1つ表示
  }
  // 描画が完了した時点の状態を保存
  captureInitialState();
}

/**
 * 既存データの読み込み
 */
async function loadStudioData(studioId) {
  const docSnap = await utils.getWrapDoc(
    utils.doc(utils.db, 'studios', studioId)
  );
  if (!docSnap.exists()) return;

  const data = docSnap.data();
  $('#studio-prefecture').val(data.prefecture || '');
  $('#studio-name').val(data.name || '');
  $('#studio-hp').val(data.hp || '');
  $('#studio-map').val(data.map || '');
  $('#studio-availability').val(data.availabilityInfo || '');
  $('#studio-fee').val(data.fee || '');
  $('#studio-rooms-url').val(data.roomsUrl || '');
  $('#studio-tel').val(data.tel || '');
  $('#studio-reserve').val(data.reserve || '');
  $('#studio-note').val(data.note || '');

  renderRooms(data.rooms || ['']);
}

/**
 * 部屋一覧のレンダリング
 */
function renderRooms(rooms) {
  const $container = $('#rooms-container').empty();
  // 編集モードで配列が空の場合や、新規モードのために最低1つは表示
  const displayRooms = rooms && rooms.length > 0 ? rooms : [''];
  displayRooms.forEach((room) => addRoomInput(room));
}

function addRoomInput(value = '') {
  const $item = $(`
    <div class="room-item">
      <input type="text" class="room-input" value="${value}" placeholder="部屋名（例：Lスタジオ）" />
      <button type="button" class="remove-room-button"><i class="fas fa-trash"></i></button>
    </div>
  `);
  $('#rooms-container').append($item);
}

/**
 * 初期状態の保存（クリア用）
 */
function captureInitialState() {
  initialState = collectFormData();
}

/**
 * 保存した初期状態を画面に復元
 */
function restoreInitialState() {
  if (!initialState) return;

  $('#studio-prefecture').val(initialState.prefecture || '');
  $('#studio-name').val(initialState.name || '');
  $('#studio-hp').val(initialState.hp || '');
  $('#studio-map').val(initialState.map || '');
  $('#studio-availability').val(initialState.availabilityInfo || '');
  $('#studio-fee').val(initialState.fee || '');
  $('#studio-rooms-url').val(initialState.roomsUrl || '');
  $('#studio-tel').val(initialState.tel || '');
  $('#studio-reserve').val(initialState.reserve || '');
  $('#studio-note').val(initialState.note || '');

  // 部屋一覧の再描画
  renderRooms(initialState.rooms);

  // バリデーションエラー表示などがあればクリア
  utils.clearErrors?.();
}

/**
 * フォームデータの収集
 */
function collectFormData() {
  const rooms = [];
  $('.room-input').each(function () {
    const val = $(this).val().trim();
    if (val) rooms.push(val);
  });

  return {
    prefecture: $('#studio-prefecture').val(),
    name: $('#studio-name').val().trim(),
    hp: $('#studio-hp').val().trim(),
    map: $('#studio-map').val().trim(),
    availabilityInfo: $('#studio-availability').val().trim(),
    fee: $('#studio-fee').val().trim(),
    rooms: rooms,
    roomsUrl: $('#studio-rooms-url').val().trim(),
    tel: $('#studio-tel').val().trim(),
    reserve: $('#studio-reserve').val().trim(),
    note: $('#studio-note').val().trim(),
  };
}

/**
 * イベントハンドラ
 */
function setupEventHandlers(mode, studioId) {
  // 部屋追加
  $('#add-room-button').on('click', () => addRoomInput());

  // 部屋削除
  $(document).on('click', '.remove-room-button', function () {
    $(this).closest('.room-item').remove();
    if ($('.room-item').length === 0) addRoomInput();
  });

  // クリアボタン：保存された初期状態を復元
  $('#clear-button').on('click', async () => {
    const message =
      mode === 'edit' ? '編集前に戻しますか？' : '入力内容をクリアしますか？';
    if (await utils.showDialog(message)) {
      restoreInitialState();
    }
  });

  // 保存ボタン
  $('#save-button').on('click', async () => {
    const data = collectFormData();

    // バリデーション
    utils.clearErrors();

    if (!data.prefecture) {
      utils.markError($('#studio-prefecture'), '都道府県は必須です');
      utils.showDialog('入力内容をご確認ください', true);
      return;
    }
    if (!data.name) {
      utils.markError($('#studio-name'), '場所名は必須です');
      utils.showDialog('入力内容をご確認ください', true);
      return;
    }

    if (!(await utils.showDialog('保存しますか？'))) return;

    utils.showSpinner();
    try {
      if (mode === 'edit') {
        await utils.updateDoc(utils.doc(utils.db, 'studios', studioId), {
          ...data,
          updatedAt: utils.serverTimestamp(),
        });
      } else {
        await utils.addDoc(utils.collection(utils.db, 'studios'), {
          ...data,
          createdAt: utils.serverTimestamp(),
          updatedAt: utils.serverTimestamp(),
        });
      }
      await utils.showDialog('保存しました', true);
      window.location.href = '../studio-list/studio-list.html';
    } catch (e) {
      console.error(e);
      utils.showDialog('エラーが発生しました', true);
    } finally {
      utils.hideSpinner();
    }
  });
}
