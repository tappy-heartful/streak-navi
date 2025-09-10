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
    // ログ登録
    await utils.writeLog({
      dataId: utils.globalGetParamMediaId,
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    // スピナー非表示
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
    pageTitle.text('メディア新規作成');
    title.text('メディア新規作成');
    submitButton.text('登録');
    backLink.text('← メディア一覧に戻る');
  } else if (mode === 'edit' || mode === 'copy') {
    pageTitle.text(mode === 'edit' ? 'メディア編集' : 'メディア新規作成');
    title.text(mode === 'edit' ? 'メディア編集' : 'メディア新規作成');
    submitButton.text(mode === 'edit' ? '更新' : '登録');
    backLink.text('← メディア一覧に戻る');
    await loadMediaData(utils.globalGetParamMediaId, mode);
  } else {
    throw new Error('モード不正です');
  }
}

//===========================
// データ読み込み
//===========================
async function loadMediaData(docId, mode) {
  const docSnap = await utils.getDoc(utils.doc(utils.db, 'medias', docId));
  if (!docSnap.exists()) throw new Error('メディアが見つかりません');

  const data = docSnap.data();

  $('#media-date').val(data.date);
  $('#media-title').val(data.title + (mode === 'copy' ? '（コピー）' : ''));
  $('#instagram-url').val(data.instagramUrl || '');
  $('#youtube-url').val(data.youtubeUrl || '');
  $('#drive-url').val(data.driveUrl || '');
}

//===========================
// イベント登録
//===========================
function setupEventHandlers(mode) {
  $('#clear-button').on('click', async () => {
    if (await utils.showDialog('入力内容をクリアしますか？'))
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
      const mediaData = collectData(mode);

      if (['new', 'copy'].includes(mode)) {
        const docRef = await utils.addDoc(
          utils.collection(utils.db, 'medias'),
          mediaData
        );
        await utils.writeLog({ dataId: docRef.id, action: '登録' });
        utils.hideSpinner();
        await utils.showDialog('登録しました', true);
        window.location.href = `../media-list/media-list.html`;
      } else {
        const mediaRef = utils.doc(
          utils.db,
          'medias',
          utils.globalGetParamMediaId
        );
        mediaData.updatedAt = utils.serverTimestamp();
        await utils.updateDoc(mediaRef, mediaData);
        await utils.writeLog({
          dataId: utils.globalGetParamMediaId,
          action: '更新',
        });
        utils.hideSpinner();
        await utils.showDialog('更新しました', true);
        window.location.href = `../media-list/media-list.html`;
      }
    } catch (e) {
      await utils.writeLog({
        dataId: utils.globalGetParamMediaId,
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
        ? `../media-confirm/media-confirm.html?mediaId=${utils.globalGetParamMediaId}`
        : '../media-list/media-list.html')
  );
}

//===========================
// データ収集
//===========================
function collectData(mode) {
  const data = {
    date: $('#media-date').val().trim(),
    title: $('#media-title').val().trim(),
    instagramUrl: $('#instagram-url').val().trim(),
    youtubeUrl: $('#youtube-url').val().trim(),
    driveUrl: $('#drive-url').val().trim(),
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

  if (!$('#media-date').val().trim()) {
    markError($('#media-date'), '必須項目です');
    isValid = false;
  }
  if (!$('#media-title').val().trim()) {
    markError($('#media-title'), '必須項目です');
    isValid = false;
  }

  return isValid;
}

//===========================
// 初期状態保存／復元
//===========================
function captureInitialState() {
  initialState = {
    date: $('#media-date').val(),
    title: $('#media-title').val(),
    instagramUrl: $('#instagram-url').val(),
    youtubeUrl: $('#youtube-url').val(),
    driveUrl: $('#drive-url').val(),
  };
}

function restoreInitialState() {
  $('#media-date').val(initialState.date);
  $('#media-title').val(initialState.title);
  $('#instagram-url').val(initialState.instagramUrl);
  $('#youtube-url').val(initialState.youtubeUrl);
  $('#drive-url').val(initialState.driveUrl);
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
