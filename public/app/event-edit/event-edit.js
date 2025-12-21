import * as utils from '../common/functions.js'; // 共通関数群読み込み

//==================================
// グローバル変数
//==================================
let initialState; // 初期表示状態の保存用
let allSections = [];
let allInstruments = [];

//==================================
// 初期化処理（ページ読込時）
//==================================
$(document).ready(async function () {
  try {
    await utils.initDisplay(); // 共通初期化
    const mode = utils.globalGetParamMode; // URLパラメータからモード取得

    // パンくずリスト
    let breadcrumb = [];
    if (mode === 'new') {
      breadcrumb.push(
        { title: 'イベント一覧', url: '../event-list/event-list.html' },
        { title: 'イベント新規作成' }
      );
    } else if (['edit', 'copy'].includes(mode)) {
      breadcrumb.push(
        { title: 'イベント一覧', url: '../event-list/event-list.html' },
        {
          title: 'イベント確認',
          url:
            '../event-confirm/event-confirm.html?eventId=' +
            utils.globalGetParamEventId,
        },
        {
          title: mode === 'edit' ? 'イベント編集' : 'イベント新規作成(コピー)',
        }
      );
    }
    utils.renderBreadcrumb(breadcrumb);

    // データ取得や初期表示の完了を待つ
    await setupPage(mode);

    // データ反映後に初期状態を保存
    captureInitialState();

    // イベントハンドラ登録（後続処理）
    setupEventHandlers(mode);

    // 【新規追加】日付フィールドの表示を初期状態に応じて切り替え
    toggleDateFields();
  } catch (e) {
    // ログ登録
    await utils.writeLog({
      dataId: utils.globalGetParamEventId,
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    // スピナー非表示
    utils.hideSpinner();
  }
});

//==================================
// ページ初期設定
//==================================
async function setupPage(mode) {
  await fetchScores(); // scoresコレクションから曲データを取得
  const pageTitle = $('#page-title');
  const title = $('#title');
  const submitButton = $('#save-button');
  const backLink = $('.back-link');

  // 🔽 【新規追加】セクションと楽器の一覧をロード
  await fetchSectionsAndInstruments();

  if (mode === 'new') {
    pageTitle.text('イベント新規作成');
    title.text('イベント新規作成');
    submitButton.text('登録');
    backLink.text('← イベント一覧に戻る');

    // 初期値セット
    $('#event-date').val('');
    $('#event-title').val('');
    $('#event-place-name').val('');
    $('#event-website').val('');
    $('#event-access').val('');
    $('#event-google-map').val('');
    $('#event-schedule').val('');
    $('#event-dress').val('');
    $('#event-bring').val('');
    $('#event-rent').val('');
    $('#event-other').val('');

    // 【修正】日程調整/出欠確認の初期値
    const type = utils.globalGetParamType; // URLパラメータからタイプ取得
    // URLパラメータで type=none が来た場合は、attendance に倒す (none は廃止)
    const initialType =
      type === 'schedule' || type === 'attendance' ? type : 'attendance';
    $('input[name="attendance-type"]').val([initialType]);
    // 【新規追加】回答の受付の初期値は 'on'
    $('input[name="attendance-status"]').val(['on']);

    // 譜割の登録の初期値は 'off'
    $('input[name="allow-assign"]').val(['off']);

    if (initialType === 'schedule') renderCandidateDates(['']); // 候補日を1つ初期表示
    renderSetlistGroups(null); // 空のグループを1つ表示
    renderInstrumentConfig(null); // 🔽 【新規追加】楽器構成を初期描画
  } else {
    pageTitle.text(
      mode === 'edit' ? 'イベント編集' : 'イベント新規作成(コピー)'
    );
    title.text(mode === 'edit' ? 'イベント編集' : 'イベント新規作成(コピー)');
    submitButton.text(mode === 'edit' ? '更新' : '登録');
    backLink.text('← イベント確認に戻る');
    // 編集 or コピー
    await loadEventData(utils.globalGetParamEventId, mode);
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

//==================================
// イベントデータ取得＆画面反映
//==================================
async function loadEventData(eventId, mode) {
  const docSnap = await utils.getWrapDoc(
    utils.doc(utils.db, 'events', eventId)
  );
  if (!docSnap.exists()) {
    throw new Error('イベントが見つかりません：' + eventId);
  }
  const data = docSnap.data();

  $('#event-title').val(data.title + (mode === 'copy' ? '（コピー）' : ''));
  $('#event-date').val(formatDateForInput(data.date) || ''); // ← 変換してセット

  $('#accept-start-date').val(
    data.acceptStartDate
      ? utils.formatDateToYMDHyphen(data.acceptStartDate)
      : ''
  );
  $('#accept-end-date').val(
    data.acceptEndDate ? utils.formatDateToYMDHyphen(data.acceptEndDate) : ''
  );
  $('#event-place-name').val(data.placeName || '');
  $('#event-website').val(data.website || '');
  $('#event-access').val(data.access || '');
  $('#event-google-map').val(data.googleMap || '');
  $('#event-schedule').val(data.schedule || '');
  $('#event-dress').val(data.dress || '');
  $('#event-bring').val(data.bring || '');
  $('#event-rent').val(data.rent || '');
  $('#event-other').val(data.other || '');

  $('input[name="attendance-type"]').val([data.attendanceType]);
  $('input[name="attendance-status"]').val([
    data.isAcceptingResponses === true ? 'on' : 'off',
  ]);
  $('input[name="allow-assign"]').val([
    data.allowAssign === true ? 'on' : 'off',
  ]);

  // 【新規追加】候補日
  const candidateDates = (data.candidateDates || []).map(formatDateForInput);
  renderCandidateDates(candidateDates.length > 0 ? candidateDates : ['']); // 候補日を画面に表示

  renderSetlistGroups(data.setlist); // setlistデータを描画

  // 🔽 【新規追加】楽器構成をロード
  renderInstrumentConfig(data.instrumentConfig);
}

//==================================
// 初期状態の保存
//==================================
function captureInitialState() {
  initialState = {
    title: $('#event-title').val(),
    date: $('#event-date').val(), // ← inputのyyyy-MM-ddをそのまま保存
    placeName: $('#event-place-name').val(),
    website: $('#event-website').val(),
    googleMap: $('#event-google-map').val(),
    access: $('#event-access').val(),
    schedule: $('#event-schedule').val(),
    setlist: getSetlistDataFromInputs(), // 【修正】セットリストを保存
    dress: $('#event-dress').val(),
    bring: $('#event-bring').val(),
    rent: $('#event-rent').val(),
    other: $('#event-other').val(),
    // 【修正】日程調整/出欠確認の種別
    attendanceType: $('input[name="attendance-type"]:checked').val(),
    // 【新規追加】回答の受付
    attendanceStatus: $('input[name="attendance-status"]:checked').val(),
    allowAssign: $('input[name="allow-assign"]:checked').val(),
    // 【新規追加】候補日
    candidateDates: getCandidateDatesFromInputs(),
    acceptStartDate: $('#accept-start-date').val(),
    acceptEndDate: $('#accept-end-date').val(),
    // 🔽 【新規追加】楽器構成
    instrumentConfig: getInstrumentConfigFromInputs(),
  };
}
function restoreInitialState() {
  $('#event-title').val(initialState.title);
  $('#event-date').val(initialState.date || ''); // ← yyyy-MM-dd形式
  $('#event-place-name').val(initialState.placeName || '');
  $('#event-website').val(initialState.website || '');
  $('#event-access').val(initialState.access || '');
  $('#event-google-map').val(initialState.googleMap || '');
  $('#event-schedule').val(initialState.schedule || '');
  renderSetlistGroups(initialState.setlist); // 【修正】セットリストを復元
  $('#event-dress').val(initialState.dress || '');
  $('#event-bring').val(initialState.bring || '');
  $('#event-rent').val(initialState.rent || '');
  $('#event-other').val(initialState.other || '');

  // 【修正】日程調整/出欠確認の種別と回答受付状態の復元
  $('input[name="attendance-type"]').val([initialState.attendanceType]);
  $('input[name="attendance-status"]').val([initialState.attendanceStatus]);
  $('input[name="allow-assign"]').val([initialState.allowAssign]);
  renderCandidateDates(initialState.candidateDates);
  $('#accept-start-date').val(initialStateHtml.acceptStartDate || ''); // ← yyyy-MM-dd形式
  $('#accept-end-date').val(initialStateHtml.acceptEndDate || ''); // ← yyyy-MM-dd形式
  toggleDateFields(); // フィールドの表示切り替え

  // 🔽 【新規追加】楽器構成を復元
  renderInstrumentConfig(initialState.instrumentConfig);
  utils.clearErrors();
}

//==================================
// イベントハンドラ登録
//==================================
function setupEventHandlers(mode) {
  // 💡 【新規追加】allow-assign ラジオボタンの変更時イベント
  $('input[name="allow-assign"]').on('change', toggleInstrumentConfig);

  // 起動時に一度実行して初期状態を反映
  toggleInstrumentConfig();

  // 【新規追加】グループ追加ボタン
  $('#add-group-button').on('click', () => {
    addSetlistGroup($('#setlist-groups-container'));
  });

  // 【新規追加】グループ削除ボタン（動的要素）
  $(document).on('click', '.remove-group-button', function () {
    $(this).closest('.setlist-group').remove();
    // グループが0になったら1つ追加する
    if ($('#setlist-groups-container .setlist-group').length === 0) {
      addSetlistGroup($('#setlist-groups-container'));
    }
  });

  // 【新規追加】曲追加ボタン（動的要素）
  $(document).on('click', '.add-song-button', function () {
    const $container = $(this).siblings('.song-list-container');
    addSongSelectInput($container);
  });

  // 【新規追加】曲削除ボタン（動的要素）
  $(document).on('click', '.remove-song-button', function () {
    $(this).closest('.song-select-item').remove();
  });
  // 【クリアボタン】初期状態に戻す
  $('#clear-button').on('click', async () => {
    if (
      await utils.showDialog(
        mode === 'new' ? '入力内容をクリアしますか？' : '編集前に戻しますか？'
      )
    )
      restoreInitialState();
  });

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

  // 🔽 【新規追加】曲の並び替え機能の有効化
  // グループの追加/復元後に常に呼び出す
  enableSortable();

  // 【修正】日程調整/出欠確認のラジオボタン変更時
  $('input[name="attendance-type"]').on('change', toggleDateFields);

  // 【新規追加】候補日追加ボタン
  $('#add-candidate-date-button').on('click', () => {
    addCandidateDateInput('');
  });

  // 【新規追加】候補日削除ボタン（動的要素）
  $(document).on('click', '.remove-candidate-date-button', function () {
    $(this).closest('.candidate-date-item').remove();
    // 候補日が0になったら1つ追加する（最低1つは表示）
    if ($('#candidate-dates-container .candidate-date-item').length === 0) {
      addCandidateDateInput('');
    }
  });

  // 【登録/更新ボタン】
  $('#save-button').on('click', async () => {
    // 入力チェック
    if (!validateEventData()) {
      utils.showDialog('入力内容を確認してください', true);
      return;
    }

    // 確認ダイアログ
    if (
      !(await utils.showDialog(
        (['new', 'copy', 'createFromCall'].includes(mode) ? '登録' : '更新') +
          'しますか？'
      ))
    )
      return;

    utils.showSpinner(); // スピナー表示

    try {
      const eventData = await collectEventData(mode); // イベント本文を取得。コピーの時は一致した場合のリンクも引き継ぎ

      if (['new', 'copy', 'createFromCall'].includes(mode)) {
        // --- 新規作成・コピー ---
        const docRef = await utils.addDoc(
          utils.collection(utils.db, 'events'),
          eventData
        );

        // ログ登録
        await utils.writeLog({ dataId: docRef.id, action: '登録' });
        utils.hideSpinner();
        await utils.showDialog('登録しました', true);
        // 確認画面へ
        window.location.href = `../event-confirm/event-confirm.html?eventId=${docRef.id}`;
      } else {
        // --- 編集 ---
        const eventId = utils.globalGetParamEventId;
        const eventRef = utils.doc(utils.db, 'events', eventId);

        // 既存データ取得
        const docSnap = await utils.getWrapDoc(eventRef);
        if (!docSnap.exists)
          throw new Error('イベントが見つかりません：' + eventId);

        eventData.updatedAt = utils.serverTimestamp();

        // --- Firestore 更新 ---
        await utils.updateDoc(eventRef, eventData);

        // ログ登録
        await utils.writeLog({ dataId: eventId, action: '更新' });
        utils.hideSpinner();
        await utils.showDialog('更新しました', true);

        // 確認画面へ
        window.location.href = `../event-confirm/event-confirm.html?eventId=${eventId}`;
      }
    } catch (e) {
      // ログ登録
      await utils.writeLog({
        dataId: utils.globalGetParamEventId,
        action: ['new', 'copy', 'createFromCall'].includes(mode)
          ? '登録'
          : '更新',
        status: 'error',
        errorDetail: { message: e.message, stack: e.stack },
      });
    } finally {
      // スピナー非表示
      utils.hideSpinner();
    }
  });

  // 確認/一覧画面に戻る
  $(document).on('click', '.back-link', function (e) {
    window.location.href = ['edit', 'copy'].includes(mode)
      ? `../event-confirm/event-confirm.html?eventId=${utils.globalGetParamEventId}`
      : '../event-list/event-list.html';
  });
}

// ==================================
// 💡 新規追加：パート設定表示切替メソッド
// ==================================
function toggleInstrumentConfig() {
  // name="allow-assign" の中で value="on" がチェックされているか確認
  const isAssignAllowed =
    $('input[name="allow-assign"]:checked').val() === 'on';

  const $container = $('#instrument-config-container');

  if (isAssignAllowed) {
    $container.slideDown(); // 表示
  } else {
    $container.slideUp(); // 非表示
  }
}

//==================================
// 【修正】日付フィールドの表示制御
//==================================
function toggleDateFields() {
  const selectedType = $('input[name="attendance-type"]:checked').val();

  if (selectedType === 'schedule') {
    // 日程調整からする: 候補日入力表示、通常の日付入力非表示
    $('#date-candidates-group').show();
    $('#date-single-group').hide();
    $('#accept-date-group').show();
  } else {
    // 出欠確認からする: 通常の日付入力表示、候補日入力非表示
    $('#date-candidates-group').hide();
    $('#date-single-group').show();
    $('#accept-date-group').hide();
  }
}

//==================================
// 【新規追加】候補日関連
//==================================

// 候補日の入力フィールドをレンダリング
function renderCandidateDates(dates) {
  const container = $('#candidate-dates-container').empty();
  if (dates.length === 0) dates = ['']; // 最低1つは表示

  dates.forEach((date) => {
    addCandidateDateInput(date, container);
  });
}

// 候補日の入力フィールドを追加
function addCandidateDateInput(
  dateValue,
  container = $('#candidate-dates-container')
) {
  const isInitial = container.children().length === 0 && dateValue === '';
  const itemHtml = `
    <div class="candidate-date-item" style="display: flex; gap: 5px; margin-bottom: 5px;">
      <input type="date" class="candidate-date-input" value="${dateValue}" style="flex-grow: 1;" />
      <button type="button" class="remove-candidate-date-button" ${
        isInitial ? 'style="display: none;"' : ''
      }>
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `;
  container.append(itemHtml);

  // 1つ目のフィールドが空で追加された場合、削除ボタンを非表示にする
  if (isInitial) {
    container
      .find('.candidate-date-item:first .remove-candidate-date-button')
      .hide();
  } else {
    container
      .find('.candidate-date-item:last .remove-candidate-date-button')
      .show();
  }
}

// 入力フィールドから候補日配列を取得
function getCandidateDatesFromInputs() {
  return $('#candidate-dates-container .candidate-date-input')
    .map(function () {
      // 空の入力値は除外しない（バリデーションでチェックするため）
      return $(this).val();
    })
    .get();
}

//==================================
// イベントデータ収集
//==================================
async function collectEventData(mode) {
  const rawDate = $('#event-date').val();
  const attendanceType = $('input[name="attendance-type"]:checked').val();
  const attendanceStatus = $('input[name="attendance-status"]:checked').val(); // 【新規追加】回答受付状態

  // 日程調整からする 選択時のみ候補日を取得
  let candidateDates = [];
  if (attendanceType === 'schedule') {
    candidateDates = getCandidateDatesFromInputs()
      .filter((date) => date.trim() !== '') // 空文字列を削除
      .map(formatDateForSave); // 保存用に変換

    // ★★★ 【修正】候補日を昇順でソートする ★★★
    candidateDates.sort();
  }

  const eventData = {
    title: $('#event-title').val().trim(),
    placeName: $('#event-place-name').val().trim(),
    website: $('#event-website').val().trim(),
    access: $('#event-access').val().trim(),
    googleMap: $('#event-google-map').val().trim(),
    schedule: $('#event-schedule').val().trim(),
    setlist: getSetlistDataFromInputs(), // 【修正】セットリストを保存
    allowAssign: $('input[name="allow-assign"]:checked').val() === 'on',
    dress: $('#event-dress').val().trim(),
    bring: $('#event-bring').val().trim(),
    rent: $('#event-rent').val().trim(),
    instrumentConfig: getInstrumentConfigFromInputs(),
    other: $('#event-other').val().trim(),

    // 【修正・新規追加】日程/出欠関連のデータ
    attendanceType: attendanceType,
    // 【新規追加】回答を受け付けるかどうかのフラグ
    isAcceptingResponses: attendanceStatus === 'on',
    // 'schedule'でなければ通常の日付を保存
    date: attendanceType !== 'schedule' ? formatDateForSave(rawDate) : '',

    // 'schedule'であれば候補日配列と期限を保存
    candidateDates: candidateDates,
    acceptStartDate:
      attendanceType === 'schedule'
        ? utils.formatDateToYMDDot($('#accept-start-date').val())
        : '',
    acceptEndDate:
      attendanceType === 'schedule'
        ? utils.formatDateToYMDDot($('#accept-end-date').val())
        : '',

    createdAt: utils.serverTimestamp(),
  };

  // 更新時に updatedAt を追加するロジックは setupEventHandlers内のsave-button処理にあるためここでは省略

  return eventData;
}

//==================================
// スコアデータ取得
//==================================
let allScores = []; // グローバル変数としてスコアデータを保持

async function fetchScores() {
  // scoresコレクションから全ドキュメントを取得
  const querySnapshot = await utils.getWrapDocs(
    utils.collection(utils.db, 'scores')
  );

  allScores = querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // titleでソート（任意）
  allScores.sort((a, b) => (a.title > b.title ? 1 : -1));
}
//==================================
// セットリストグループ・曲の描画関連
//==================================

/**
 * 選択可能な曲の<option>タグHTMLを生成
 * @param {string} selectedScoreId - 選択されている曲のID
 * @returns {string} - optionタグのHTML文字列
 */
function getScoreOptionsHtml(selectedScoreId = '') {
  let options = '<option value="">--- 曲を選択 ---</option>';
  allScores.forEach((score) => {
    const selected = score.id === selectedScoreId ? 'selected' : '';
    options += `<option value="${score.id}" ${selected}>${score.title}</option>`;
  });
  return options;
}

/**
 * 曲選択ドロップダウンフィールドを生成しコンテナに追加
 * @param {jQuery} $container - 曲リストを格納するコンテナ
 * @param {string} scoreId - 選択する曲のID
 */
function addSongSelectInput($container, scoreId = '') {
  const optionsHtml = getScoreOptionsHtml(scoreId); // 🔽 【修正】ドラッグ用ハンドル (.drag-handle) を追加
  const $item = $(`
    <div class="song-select-item" style="display: flex; gap: 5px; margin-bottom: 5px; align-items: center;">
    <i class="fa-solid fa-bars drag-handle" title="ドラッグして順番を入れ替える"></i>
    <select class="song-select" style="flex-grow: 1;">${optionsHtml}</select>
    <button type="button" class="remove-song-button" title="この曲を削除">
      <i class="fas fa-trash-alt"></i>
    </button>
    </div>
  `);
  $container.append($item);
}

/**
 * セットリストグループを生成しコンテナに追加
 * @param {Array<string>} songIds - グループに含める曲のIDの配列
 * @param {string} groupTitle - グループのタイトル (例: 1st Stage)
 * @param {jQuery} $container - グループを格納するコンテナ
 */
function addSetlistGroup($container, songIds = [''], groupTitle = '') {
  const groupId = utils.generateUniqueId(); // グループ識別用の一意なIDを生成

  const $group = $(`
    <div class="setlist-group" data-group-id="${groupId}">
      <div class="group-header" style="display: flex; align-items: center; margin-bottom: 5px; gap: 10px;">
        <input type="text" class="group-title-input" placeholder="例: 1st Stage" value="${groupTitle}" style="flex-grow: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
        <button type="button" class="remove-group-button" title="このグループを削除">
          <i class="fas fa-times"></i> グループを削除
        </button>
      </div>
      <div class="song-list-container">
        </div>
      <button type="button" class="add-song-button" style="margin-top: 5px;">
        <i class="fas fa-plus"></i> 曲を追加
      </button>
      <hr style="margin: 15px 0;">
    </div>
  `);

  const $songContainer = $group.find('.song-list-container');

  // 曲リストを初期描画
  if (songIds.length === 0 || (songIds.length === 1 && songIds[0] === '')) {
    addSongSelectInput($songContainer, ''); // 空の選択フィールドを1つ追加
  } else {
    songIds.forEach((id) => addSongSelectInput($songContainer, id));
  }

  $container.append($group);

  // 🔽 【新規追加】新しいグループの描画後、並び替えを有効化
  enableSortable();
}

/**
 * 画面上の入力からセットリストデータを取得
 * @returns {Array<Object>} セットリストグループの配列
 */
function getSetlistDataFromInputs() {
  const setlist = [];
  $('#setlist-groups-container .setlist-group').each(function () {
    const $group = $(this);
    const title = $group.find('.group-title-input').val().trim();

    // 選択された曲IDを収集（未選択や重複はそのまま保持）
    const songIds = $group
      .find('.song-select')
      .map(function () {
        return $(this).val();
      })
      .get()
      .filter((id) => id !== ''); // 未選択（value=""）は除外

    if (songIds.length > 0 || title !== '') {
      setlist.push({
        title: title,
        songIds: songIds,
      });
    }
  });
  return setlist;
}

/**
 * Firestoreから読み込んだデータに基づいてセットリストを画面に描画
 * @param {Array<Object>} setlistData - Firestoreから読み込んだセットリストの配列
 */
function renderSetlistGroups(setlistData) {
  const $container = $('#setlist-groups-container').empty();

  if (!setlistData || setlistData.length === 0) {
    addSetlistGroup($container);
    return;
  }

  setlistData.forEach((group) => {
    addSetlistGroup($container, group.songIds || [''], group.title || '');
  });

  // 🔽 【新規追加】すべてのグループの描画後、並び替えを有効化
  enableSortable();
}

//==================================
// 【新規追加】ドラッグ＆ドロップ機能
//==================================

/**
 * .song-list-container に Sortable 機能を有効化する
 * 曲の順番入れ替えを可能にする
 */
function enableSortable() {
  $('.song-list-container')
    .sortable({
      // ドラッグ対象のアイテム（曲選択の行）
      items: '.song-select-item',
      // ドラッグを開始できるハンドル
      handle: '.drag-handle',
      // プレースホルダ（移動先の点線）のクラス
      placeholder: 'ui-sortable-placeholder',
      // ドラッグ中、元の場所にコピーを残さない
      helper: 'clone',
      // ドラッグ中に他のアイテムをスクロールで移動
      scroll: true,
      // 移動が確定した際のイベント
      update: function (event, ui) {
        console.log('曲の順番が変更されました');
        // ここでデータの再保存処理などは不要 (getSetlistDataFromInputs() がDOMから最新の順序で取得するため)
      },
    })
    .disableSelection(); // テキスト選択を無効化
}

//==================================
// 入力チェック
//==================================
function validateEventData() {
  let isValid = true;
  utils.clearErrors();

  // --- タイトル必須 ---
  const title = $('#event-title').val().trim();
  if (!title) {
    utils.markError($('#event-title'), '必須項目です');
    isValid = false;
  }

  const attendanceType = $('input[name="attendance-type"]:checked').val();

  // --- 日付関連の必須チェック ---
  if (attendanceType === 'schedule') {
    // 【修正】日程調整からする: 候補日が1つ以上必須
    const candidateDates = getCandidateDatesFromInputs().filter(
      (date) => date.trim() !== ''
    );
    if (candidateDates.length === 0) {
      utils.markError(
        $('#add-candidate-date-button').parent().find('label'),
        '候補日を1つ以上設定してください'
      );
      isValid = false;
    } else {
      // 候補日が入力されている場合は、個々の入力値のチェックは省略 (type="date"であるため形式チェックはブラウザに任せる)
    }

    const acceptStartDate = $('#accept-start-date').val().trim();
    const acceptEndDate = $('#accept-end-date').val().trim();
    // 開始日付必須
    if (!acceptStartDate) {
      utils.markError($('#accept-date'), '必須項目です');
      isValid = false;
    }
    // 終了日付必須
    else if (!acceptEndDate) {
      utils.markError($('#accept-date'), '必須項目です');
      isValid = false;
    }
    // ✅ 開始日 > 終了日のチェック（両方入力されている場合に判定）
    if (acceptStartDate && acceptEndDate) {
      const start = new Date(acceptStartDate + 'T00:00:00');
      const end = new Date(acceptEndDate + 'T23:59:59');

      if (start.getTime() > end.getTime()) {
        utils.markError($('#accept-date'), '終了日は開始日以降にしてください');
        isValid = false;
      }
    }
  } else {
    // 【修正】出欠確認からする: 単一の日付必須
    const date = $('#event-date').val().trim();
    if (!date) {
      utils.markError($('#event-date'), '必須項目です');
      isValid = false;
    }
  }

  // website URL チェック
  const website = $('#event-website').val().trim();
  if (website && !utils.isValidURL(website)) {
    utils.markError($('#event-website'), '正しいURLを入力してください');
    isValid = false;
  }

  // googleMap URL チェック
  const googleMap = $('#event-google-map').val().trim();
  if (googleMap && !utils.isValidURL(googleMap)) {
    utils.markError($('#event-google-map'), '正しいURLを入力してください');
    isValid = false;
  }
  // TODO:googlemapのURLがGoogle Mapの形式かどうかもチェック

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
  if (
    totalParts === 0 &&
    $('input[name="allow-assign"]:checked').val() === 'on'
  ) {
    utils.markError($configGroup, '楽器構成を最低1つ登録してください');
    isValid = false;
  }

  return isValid;
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

// yyyy-MM-dd → yyyy.MM.dd
function formatDateForSave(dateStr) {
  return dateStr ? dateStr.replace(/-/g, '.') : '';
}

// yyyy.MM.dd → yyyy-MM-dd
function formatDateForInput(dateStr) {
  return dateStr ? dateStr.replace(/\./g, '-') : '';
}
