import * as utils from '../common/functions.js';

let initialState = {};
let genresList = [];

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

  // ジャンル一覧をロード
  const genreSnap = await utils.getDocs(utils.collection(utils.db, 'genres'));
  const genreSelect = $('#score-genre');
  genreSnap.forEach((doc) => {
    const data = doc.data();
    genreSelect.append(`<option value="${doc.id}">${data.name}</option>`);
  });

  if (mode === 'new') {
    // 新規作成のときだけ初期プルダウンを1つ生成
    addGenreSelect();
  }

  if (['edit', 'copy'].includes(mode)) {
    await loadScoreData(utils.globalGetParamScoreId, mode);
  }
}

//===========================
// ジャンルセレクトを追加
//===========================
function addGenreSelect(selectedId = '') {
  const wrapper = $(`
    <div class="genre-select-wrapper">
      <select class="score-genre">
        <option value="">選択してください</option>
        ${genresList
          .map((g) => `<option value="${g.id}">${g.name}</option>`)
          .join('')}
      </select>
      <button type="button" class="remove-genre">×</button>
    </div>
  `);

  // 値をセット（編集時）
  wrapper.find('select').val(selectedId);

  // 最初の1つ目は削除ボタン非表示
  if ($('#genre-container .genre-select-wrapper').length === 0) {
    wrapper.find('.remove-genre').hide();
  }

  $('#genre-container').append(wrapper);
}

//===========================
// データ読み込み
//===========================
async function loadScoreData(docId, mode) {
  const docSnap = await utils.getDoc(utils.doc(utils.db, 'scores', docId));
  if (!docSnap.exists()) throw new Error('譜面が見つかりません');
  const data = docSnap.data();

  $('#score-title').val(data.title + (mode === 'copy' ? '（コピー）' : ''));
  $('#score-url').val(data.scoreUrl || '');
  $('#reference-track').val(data.referenceTrack || '');
  $('#score-note').val(data.note || '');
  $('#is-disp-top').prop('checked', data.isDispTop || false);

  // ジャンル（配列）をロード
  $('#genre-container').empty();
  if (Array.isArray(data.genres) && data.genres.length > 0) {
    data.genres.forEach((gid) => addGenreSelect(gid));
  } else {
    addGenreSelect();
  }
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
        window.location.href = `../score-confirm/score-confirm.html?scoreId=${docRef.id}`;
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
        window.location.href = `../score-confirm/score-confirm.html?scoreId=${utils.globalGetParamScoreId}`;
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

  // ジャンル追加
  $('#add-genre').on('click', () => addGenreSelect());

  // ジャンル削除
  $(document).on('click', '.remove-genre', function () {
    $(this).closest('.genre-select-wrapper').remove();
  });
}

//===========================
// データ収集
//===========================
function collectData(mode) {
  const genres = $('.score-genre')
    .map(function () {
      return $(this).val();
    })
    .get()
    .filter((v) => v); // 空を除外

  const data = {
    title: $('#score-title').val().trim(),
    scoreUrl: $('#score-url').val().trim(),
    referenceTrack: $('#reference-track').val().trim(),
    genres: genres, // ←配列で保存
    note: $('#score-note').val().trim(),
    isDispTop: $('#is-disp-top').prop('checked'),
    createdAt: utils.serverTimestamp(),
  };
  if (['new', 'copy'].includes(mode))
    data.createdBy = utils.getSession('displayName');
  return data;
}

// バリデーション修正（YouTube / Google Drive URLチェック追加）
function validateData() {
  let isValid = true;
  utils.clearErrors();

  const title = $('#score-title').val().trim();
  const scoreUrl = $('#score-url').val().trim();
  const referenceTrack = $('#reference-track').val().trim();
  const genre = $('#score-genre').val();

  // 必須チェック
  if (!title) {
    utils.markError($('#score-title'), '必須項目です');
    isValid = false;
  }
  if (!scoreUrl) {
    utils.markError($('#score-url'), '必須項目です');
    isValid = false;
  }
  if (!referenceTrack) {
    utils.markError($('#reference-track'), '必須項目です');
    isValid = false;
  }
  const genres = $('.score-genre')
    .map(function () {
      return $(this).val();
    })
    .get();

  if (genres.length === 0 || !genres[0]) {
    utils.markError($('#genre-container'), '最低1つは選択してください');
    isValid = false;
  }

  // URLチェック関数
  const isValidURL = (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // YouTube URLチェック
  if (referenceTrack) {
    if (!isValidURL(referenceTrack)) {
      utils.markError($('#reference-track'), '正しいURLを入力してください');
      isValid = false;
    } else if (
      !/^https:\/\/(www\.)?youtube\.com\/watch\?v=[\w\-]+/.test(
        referenceTrack
      ) &&
      !/^https:\/\/youtu\.be\/[\w\-]+/.test(referenceTrack)
    ) {
      utils.markError($('#reference-track'), 'YouTube動画URLではありません');
      isValid = false;
    }
  }

  // Google Drive URLチェック（ファイルまたはフォルダ対応）
  if (scoreUrl) {
    if (!isValidURL(scoreUrl)) {
      utils.markError($('#score-url'), '正しいURLを入力してください');
      isValid = false;
    } else if (
      !/^https:\/\/drive\.google\.com\/file\/d\/[\w\-]+\/view/.test(scoreUrl) &&
      !/^https:\/\/drive\.google\.com\/drive\/folders\/[\w\-]+/.test(scoreUrl)
    ) {
      utils.markError(
        $('#score-url'),
        'Google DriveのファイルまたはフォルダURLではありません'
      );
      isValid = false;
    }
  }

  return isValid;
}

// 初期状態保存／復元もジャンル・譜面・参考音源・備考を追加
function captureInitialState() {
  initialState = {
    title: $('#score-title').val(),
    scoreUrl: $('#score-url').val(),
    referenceTrack: $('#reference-track').val(),
    genre: $('#score-genre').val(),
    note: $('#score-note').val(),
    isDispTop: $('#is-disp-top').prop('checked'),
  };
}

function restoreInitialState() {
  $('#score-title').val(initialState.title);
  $('#score-url').val(initialState.scoreUrl);
  $('#reference-track').val(initialState.referenceTrack);
  $('#score-genre').val(initialState.genre);
  $('#score-note').val(initialState.note);
  $('#is-disp-top').prop('checked', initialState.isDispTop);
  utils.clearErrors();
}
