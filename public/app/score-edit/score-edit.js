import * as utils from '../common/functions.js';

let initialState = {};

//===========================
// 初期化
//===========================
$(document).ready(async function () {
  try {
    const mode = utils.globalGetParamMode; // new / edit / copy
    // 画面ごとのパンくずをセット
    let breadcrumb = [
      { title: '譜面一覧', url: '../score-list/score-list.html' },
    ];
    if (['new'].includes(mode)) {
      breadcrumb.push({ title: '譜面新規作成' });
    } else if (['edit', 'copy'].includes(mode)) {
      breadcrumb.push(
        {
          title: '譜面確認',
          url:
            '../score-confirm/score-confirm.html?scoreId=' +
            utils.globalGetParamScoreId,
        },
        {
          title: mode === 'edit' ? '譜面編集' : '譜面新規作成(コピー)',
        }
      );
    }
    utils.setBreadcrumb(breadcrumb);

    await utils.initDisplay();

    await setupPage(mode);
    captureInitialState();
    setupEventHandlers(mode);
  } catch (e) {
    // ログ登録
    await utils.writeLog({
      dataId: utils.globalGetParamScoreId,
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
    pageTitle.text('譜面新規作成');
    title.text('譜面新規作成');
    submitButton.text('登録');
    backLink.text('← 譜面一覧に戻る');
    $('#is-disp-top').prop('checked', true); // 新規作成時はホームに表示をデフォルトON
  } else if (mode === 'edit' || mode === 'copy') {
    pageTitle.text(mode === 'edit' ? '譜面編集' : '譜面新規作成(コピー)');
    title.text(mode === 'edit' ? '譜面編集' : '譜面新規作成(コピー)');
    submitButton.text(mode === 'edit' ? '更新' : '登録');
    backLink.text('← 譜面確認に戻る');
    await loadScoreData(utils.globalGetParamScoreId, mode);
  } else {
    throw new Error('モード不正です');
  }
}

//===========================
// データ読み込み
//===========================
async function loadScoreData(docId, mode) {
  const docSnap = await utils.getDoc(utils.doc(utils.db, 'scores', docId));
  if (!docSnap.exists()) throw new Error('譜面が見つかりません');

  const data = docSnap.data();

  $('#score-date').val(utils.formatDateToYMDHyphen(data.date));
  $('#score-title').val(data.title + (mode === 'copy' ? '（コピー）' : ''));
  $('#instagram-url').val(data.instagramUrl || '');
  $('#youtube-url').val(data.youtubeUrl || '');
  $('#drive-url').val(data.driveUrl || '');
  $('#is-disp-top').prop('checked', data.isDispTop || false);
}

//===========================
// イベント登録
//===========================
function setupEventHandlers(mode) {
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
      const scoreData = collectData(mode);

      if (['new', 'copy'].includes(mode)) {
        const docRef = await utils.addDoc(
          utils.collection(utils.db, 'scores'),
          scoreData
        );
        await utils.writeLog({ dataId: docRef.id, action: '登録' });
        utils.hideSpinner();
        await utils.showDialog('登録しました', true);
        window.location.href = `../score-list/score-list.html`;
      } else {
        const scoreRef = utils.doc(
          utils.db,
          'scores',
          utils.globalGetParamScoreId
        );
        scoreData.updatedAt = utils.serverTimestamp();
        await utils.updateDoc(scoreRef, scoreData);
        await utils.writeLog({
          dataId: utils.globalGetParamScoreId,
          action: '更新',
        });
        utils.hideSpinner();
        await utils.showDialog('更新しました', true);
        window.location.href = `../score-list/score-list.html`;
      }
    } catch (e) {
      await utils.writeLog({
        dataId: utils.globalGetParamScoreId,
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
        ? `../score-confirm/score-confirm.html?scoreId=${utils.globalGetParamScoreId}`
        : '../score-list/score-list.html')
  );
}

//===========================
// データ収集
//===========================
function collectData(mode) {
  const rawDate = $('#score-date').val().trim();
  const data = {
    date: utils.formatDateToYMDDot(rawDate), // yyyy.MM.dd 形式で保存
    title: $('#score-title').val().trim(),
    instagramUrl: $('#instagram-url').val().trim(),
    youtubeUrl: $('#youtube-url').val().trim(),
    driveUrl: $('#drive-url').val().trim(),
    isDispTop: $('#is-disp-top').prop('checked'),
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

  const date = $('#score-date').val().trim();
  const title = $('#score-title').val().trim();
  const instagramUrl = $('#instagram-url').val().trim();
  const youtubeUrl = $('#youtube-url').val().trim();
  const driveUrl = $('#drive-url').val().trim();

  // 必須チェック
  if (!date) {
    utils.markError($('#score-date'), '必須項目です');
    isValid = false;
  }
  if (!title) {
    utils.markError($('#score-title'), '必須項目です');
    isValid = false;
  }

  // URL チェック用関数
  const isValidURL = (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Instagram URL チェック
  if (instagramUrl) {
    if (!isValidURL(instagramUrl)) {
      utils.markError($('#instagram-url'), '正しいURLを入力してください');
      isValid = false;
    } else if (
      !/^https:\/\/www\.instagram\.com\/p\/[A-Za-z0-9_\-]+/.test(instagramUrl)
    ) {
      utils.markError($('#instagram-url'), 'Instagramの投稿URLではありません');
      isValid = false;
    }
  }

  // YouTube URL チェック
  if (youtubeUrl) {
    if (!isValidURL(youtubeUrl)) {
      utils.markError($('#youtube-url'), '正しいURLを入力してください');
      isValid = false;
    } else if (
      !/^https:\/\/(www\.)?youtube\.com\/watch\?v=[\w\-]+/.test(youtubeUrl) &&
      !/^https:\/\/youtu\.be\/[\w\-]+/.test(youtubeUrl)
    ) {
      utils.markError($('#youtube-url'), 'YouTube動画URLではありません');
      isValid = false;
    }
  }

  // Google Drive URL チェック
  if (driveUrl) {
    if (!isValidURL(driveUrl)) {
      utils.markError($('#drive-url'), '正しいURLを入力してください');
      isValid = false;
    } else if (
      !/^https:\/\/drive\.google\.com\/file\/d\/[\w\-]+\/view/.test(driveUrl)
    ) {
      utils.markError($('#drive-url'), 'Google DriveファイルURLではありません');
      isValid = false;
    }
  }

  return isValid;
}

//===========================
// 初期状態保存／復元
//===========================
function captureInitialState() {
  initialState = {
    date: $('#score-date').val(),
    title: $('#score-title').val(),
    instagramUrl: $('#instagram-url').val(),
    youtubeUrl: $('#youtube-url').val(),
    driveUrl: $('#drive-url').val(),
    isDispTop: $('#is-disp-top').prop('checked'),
  };
}

function restoreInitialState() {
  $('#score-date').val(initialState.date);
  $('#score-title').val(initialState.title);
  $('#instagram-url').val(initialState.instagramUrl);
  $('#youtube-url').val(initialState.youtubeUrl);
  $('#drive-url').val(initialState.driveUrl);
  $('#is-disp-top').prop('checked', initialState.isDispTop);
  utils.clearErrors();
}
