import * as utils from '../common/functions.js';

let initialState = {};
let genresList = [];
let allSections = [];
let allInstruments = [];

//===========================
// 初期化
//===========================
$(document).ready(async function () {
  try {
    const mode = utils.globalGetParamMode; // new / edit / copy
    await utils.initDisplay();
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
    utils.renderBreadcrumb(breadcrumb);

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

  // 🔽 【新規追加】セクションと楽器の一覧をロード
  await fetchSectionsAndInstruments();

  if (mode === 'new') {
    pageTitle.text('譜面新規作成');
    title.text('譜面新規作成');
    submitButton.text('登録');
    backLink.text('← 譜面一覧に戻る');
    $('#is-disp-top').prop('checked', true); // 新規作成時はホームに表示をデフォルトON
    renderInstrumentConfig(null); // 🔽 【新規追加】楽器構成を初期描画
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
  const genreSnap = await utils.getWrapDocs(
    utils.collection(utils.db, 'genres')
  );
  genresList = genreSnap.docs.map((doc) => ({
    id: doc.id,
    name: doc.data().name,
  }));

  if (mode === 'new') {
    // 新規作成のときだけ初期プルダウンを1つ生成
    addGenreSelect();
  }

  if (['edit', 'copy'].includes(mode)) {
    await loadScoreData(utils.globalGetParamScoreId, mode);
  }
}

// 🔽 【新規追加】セクションと楽器のデータを取得
async function fetchSectionsAndInstruments() {
  // 1. sectionsコレクションから全てのデータを取得
  const sectionSnap = await utils.getWrapDocs(
    utils.collection(utils.db, 'sections') // where句を削除
  );

  // 2. クライアント側（JavaScript）でdoc.idが '99' のものを除外
  allSections = sectionSnap.docs
    .filter((doc) => doc.id !== '99') // IDが'99'のドキュメントを除外
    .map((doc) => ({
      id: doc.id,
      name: doc.data().name,
    }));

  allSections.sort((a, b) => a.id - b.id);

  // 2. instrumentsコレクションから全データを取得
  const instrumentSnap = await utils.getWrapDocs(
    utils.collection(utils.db, 'instruments')
  );
  allInstruments = instrumentSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  allInstruments.sort((a, b) => (a.id > b.id ? 1 : -1));
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
  const docSnap = await utils.getWrapDoc(utils.doc(utils.db, 'scores', docId));
  if (!docSnap.exists()) throw new Error('譜面が見つかりません');
  const data = docSnap.data();

  $('#score-title').val(
    data.title_decoded + (mode === 'copy' ? '（コピー）' : '')
  );
  $('#score-url').val(data.scoreUrl_decoded || '');
  $('#reference-track').val(data.referenceTrack_decoded || '');
  $('#abbreviation').val(data.abbreviation_decoded || '');
  $('#score-note').val(data.note_decoded || '');
  $('#is-disp-top').prop('checked', data.isDispTop || false);

  // ジャンル（配列）をロード
  $('#genre-container').empty();
  if (Array.isArray(data.genres) && data.genres.length > 0) {
    data.genres.forEach((gid) => addGenreSelect(gid));
  } else {
    addGenreSelect();
  }

  // 🔽 【新規追加】楽器構成をロード
  renderInstrumentConfig(data.instrumentConfig);
}

//===========================
// イベント登録
//===========================
function setupEventHandlers(mode) {
  // 🔽 【新規追加】パート追加ボタン（動的要素）
  $(document).on('click', '.add-part-button', function () {
    const sectionId = $(this).closest('.instrument-section').data('section-id');
    const $container = $(this).siblings('.part-list-container');
    addPartInput($container, sectionId);
  });

  // 🔽 【新規追加】パート削除ボタン（動的要素）
  $(document).on('click', '.remove-part-button', function () {
    $(this).closest('.part-item').remove();
    // 削除後にエラーを再チェック
    utils.clearErrors();
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
    abbreviation: $('#abbreviation').val().trim(),
    instrumentConfig: getInstrumentConfigFromInputs(),
    note: $('#score-note').val().trim(),
    isDispTop: $('#is-disp-top').prop('checked'),
  };

  // 新規作成時のみ
  if (['new', 'copy'].includes(mode)) {
    data.createdAt = utils.serverTimestamp();
    data.createdBy = utils.getSession('displayName');
  }
  return data;
}

// バリデーション修正（YouTube / Google Drive URLチェック追加）
function validateData() {
  let isValid = true;
  utils.clearErrors();

  const title = $('#score-title').val().trim();
  const scoreUrl = $('#score-url').val().trim();
  const referenceTrack = $('#reference-track').val().trim();
  const abbreviation = $('#abbreviation').val();

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
  if (!abbreviation) {
    utils.markError($('#abbreviation'), '必須項目です');
    isValid = false;
  } else if (abbreviation.length > 8) {
    utils.markError($('#abbreviation'), '略称は8文字で以下で入力してください');
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
  // 🔽 【新規追加】楽器構成のチェック
  const config = getInstrumentConfigFromInputs();
  const $configGroup = $('#instrument-config-group');

  let totalParts = 0;
  let configHasError = false;

  $('#instrument-config-group .instrument-section').each(function () {
    const $section = $(this);
    const sectionName = $section.find('h3').text();

    $section.find('.part-item').each(function () {
      const $partInput = $(this).find('.part-name-input');
      const $instSelect = $(this).find('.instrument-select');
      const partName = $partInput.val().trim();
      const instrumentId = $instSelect.val();

      // パート名が4文字を超えていないかチェック
      if (partName.length > 4) {
        utils.markError($partInput, '4文字以下で入力してください');
        isValid = false;
        configHasError = true;
        return false; // eachループを抜ける
      }

      // パート名と楽器IDが両方入力されているかチェック
      if (partName || instrumentId) {
        totalParts++; // 有効なパートとしてカウント

        if (!partName) {
          utils.markError($partInput, 'パート名は必須です');
          isValid = false;
          configHasError = true;
        }

        if (!instrumentId) {
          utils.markError($instSelect, '楽器を選択してください');
          isValid = false;
          configHasError = true;
        }
      }
    });
    if (configHasError) return false; // 外側のeachループも抜ける
  });

  // 全セクションで有効なパートが1つも登録されていない場合はエラー
  if (totalParts === 0) {
    utils.markError($configGroup, '楽器構成を最低1つ登録してください');
    isValid = false;
  }
  // YouTube URLチェック
  if (referenceTrack) {
    if (!utils.isValidURL(referenceTrack)) {
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
    if (!utils.isValidURL(scoreUrl)) {
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
// score-edit.js

// 初期状態保存／復元もジャンル・譜面・参考音源・備考を追加 (修正)
function captureInitialState() {
  initialState = {
    title: $('#score-title').val(),
    scoreUrl: $('#score-url').val(),
    referenceTrack: $('#reference-track').val(),
    // 🔽 【修正】ジャンルをDOMから取得し直す
    genres: $('.score-genre')
      .map(function () {
        return $(this).val();
      })
      .get(),
    abbreviation: $('#abbreviation').val(),
    note: $('#score-note').val(),
    isDispTop: $('#is-disp-top').prop('checked'),
    // 🔽 【新規追加】楽器構成
    instrumentConfig: getInstrumentConfigFromInputs(),
  };
}

function restoreInitialState() {
  $('#score-title').val(initialState.title);
  $('#score-url').val(initialState.scoreUrl);
  $('#reference-track').val(initialState.referenceTrack);
  $('#abbreviation').val(initialState.abbreviation);
  $('#score-note').val(initialState.note);
  $('#is-disp-top').prop('checked', initialState.isDispTop);

  // 🔽 【修正】ジャンルを復元
  $('#genre-container').empty();
  if (Array.isArray(initialState.genres) && initialState.genres.length > 0) {
    initialState.genres.forEach((gid) => addGenreSelect(gid));
  } else {
    addGenreSelect();
  }

  // 🔽 【新規追加】楽器構成を復元
  renderInstrumentConfig(initialState.instrumentConfig);

  utils.clearErrors();
}

//===========================
// 楽器構成描画関連 (修正)
//===========================

/**
 * 楽器構成の選択肢HTMLを生成
 * @param {string} sectionId - 所属するセクションのID
 * @param {string} selectedId - 選択されている楽器のID
 * @returns {string} - optionタグのHTML文字列
 */
function getInstrumentOptionsHtml(sectionId, selectedId = '') {
  // 🔽 sectionIdを追加
  let options = '<option value="">楽器を選択</option>';

  // 🔽 1. sectionIdでinstrumentsをフィルタリング
  const filteredInstruments = allInstruments.filter(
    (inst) => inst.sectionId === String(sectionId)
  );

  // 🔽 2. instruments.nameを表示名として使用
  filteredInstruments.forEach((inst) => {
    const selected = inst.id === selectedId ? 'selected' : '';
    // inst.abbreviation ではなく inst.name を表示
    options += `<option value="${inst.id}" ${selected}>${inst.name}</option>`;
  });
  return options;
}

/**
 * パート入力フィールドを生成しコンテナに追加
 * @param {jQuery} $container - パートリストを格納するコンテナ
 * @param {string} sectionId - 所属するセクションID
 * @param {string} partName - パート名
 * @param {string} instrumentId - 選択する楽器ID
 */
function addPartInput($container, sectionId, partName = '', instrumentId = '') {
  // 🔽 getInstrumentOptionsHtmlに関数にsectionIdを渡すように修正
  const optionsHtml = getInstrumentOptionsHtml(sectionId, instrumentId);

  const $item = $(`
        <div class="part-item" data-section-id="${sectionId}">
            <input type="text" class="part-name-input" value="${partName}" placeholder="パート名" maxlength="4" />
            <select class="instrument-select" style="flex-grow: 1;">${optionsHtml}</select>
            <button type="button" class="remove-part-button" title="このパートを削除">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `);
  $container.append($item);
}

/**
 * 楽器構成全体を描画
 * @param {Object} configData - Firestoreから読み込んだ楽器構成データ
 */
function renderInstrumentConfig(configData) {
  const $container = $('#instrument-config-group').empty();

  // configDataが存在しない場合は空のパートを1つ持つセクションを全てもとに描画
  if (!configData) {
    configData = {};
    allSections.forEach((section) => {
      // 初期表示は空のパートを持つ（登録時にバリデーションで弾く）
      configData[section.id] = [{ partName: '', instrumentId: '' }];
    });
  }

  allSections.forEach((section) => {
    const sectionId = section.id;
    const sectionName = section.name;
    const parts = configData[sectionId] || [];

    const $section = $(`
            <div class="instrument-section" data-section-id="${sectionId}">
                <h3>${sectionName}</h3>
                <div class="part-list-container">
                    </div>
                <button type="button" class="add-part-button">＋ パートを追加</button>
            </div>
        `);

    const $partContainer = $section.find('.part-list-container');

    if (parts.length === 0) {
      // データがない場合でも、パート追加ボタンのみ表示するために空の配列をセット
      // addPartInput($partContainer, sectionId);
    } else {
      // データが存在する場合
      parts.forEach((part) => {
        addPartInput(
          $partContainer,
          sectionId,
          part.partName,
          part.instrumentId
        );
      });
    }
    $container.append($section);
  });
}

/**
 * 画面上の入力から楽器構成データを取得
 * @returns {Object} 楽器構成データ (セクションID: [パート情報])
 */
function getInstrumentConfigFromInputs() {
  const config = {};
  $('#instrument-config-group .instrument-section').each(function () {
    const sectionId = $(this).data('section-id');
    const parts = [];

    $(this)
      .find('.part-item')
      .each(function () {
        const partName = $(this).find('.part-name-input').val().trim();
        const instrumentId = $(this).find('.instrument-select').val();

        // パート名、または楽器IDのどちらかが入力されていれば保存対象
        if (partName || instrumentId) {
          parts.push({
            partName: partName,
            instrumentId: instrumentId,
          });
        }
      });

    // パートが1つ以上あればセクションに追加
    if (parts.length > 0) {
      config[sectionId] = parts;
    }
  });
  return config;
}
