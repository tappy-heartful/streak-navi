import * as utils from '../common/functions.js'; // 共通関数群読み込み

//==================================
// グローバル変数
//==================================
let initialStateHtml; // 初期表示状態の保存用

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
  const pageTitle = $('#page-title');
  const title = $('#title');
  const submitButton = $('#save-button');
  const backLink = $('.back-link');

  if (mode === 'new') {
    pageTitle.text('イベント新規作成');
    title.text('イベント新規作成');
    submitButton.text('登録');
    backLink.text('← イベント一覧に戻る');

    // 初期値セット
    $('#event-date').val('');
    $('#event-title').val('');
    $('#event-place-name').val('');
    $('#event-place-url').val('');
    $('#event-access').val('');
    $('#event-parking').val('');
    $('#event-schedule').val('');
    $('#event-songs').val('');
    $('#event-dress').val('');
    $('#event-other').val('');

    // 【新規追加】日程調整/出欠確認の初期値
    $('input[name="attendance-type"]').val(['schedule']); // デフォルトを「日程調整からする」に
    renderCandidateDates(['']); // 候補日を1つ初期表示
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

//==================================
// イベントデータ取得＆画面反映
//==================================
async function loadEventData(eventId, mode) {
  const docSnap = await utils.getDoc(utils.doc(utils.db, 'events', eventId));
  if (!docSnap.exists()) {
    throw new Error('イベントが見つかりません：' + eventId);
  }
  const data = docSnap.data();

  $('#event-title').val(data.title + (mode === 'copy' ? '（コピー）' : ''));
  $('#event-date').val(formatDateForInput(data.date) || ''); // ← 変換してセット
  $('#event-place-name').val(data.placeName || '');
  $('#event-place-url').val(data.placeUrl || '');
  $('#event-access').val(data.access || '');
  $('#event-parking').val(data.parking || '');
  $('#event-schedule').val(data.schedule || '');
  $('#event-songs').val(data.songs || '');
  $('#event-dress').val(data.dress || '');
  $('#event-other').val(data.other || '');

  // 【修正】既存の attendance は削除
  // $('#event-attendance').prop('checked', !!data.attendance);

  // 【新規追加】日程調整/出欠確認の種別
  const attendanceType = data.attendanceType || 'attendance'; // 過去データ互換のためデフォルトを'attendance'に
  $('input[name="attendance-type"]').val([attendanceType]);

  // 【新規追加】候補日
  const candidateDates = (data.candidateDates || []).map(formatDateForInput);
  renderCandidateDates(candidateDates.length > 0 ? candidateDates : ['']); // 候補日を画面に表示
}

//==================================
// 初期状態の保存
//==================================
function captureInitialState() {
  initialStateHtml = {
    title: $('#event-title').val(),
    date: $('#event-date').val(), // ← inputのyyyy-MM-ddをそのまま保存
    placeName: $('#event-place-name').val(),
    placeUrl: $('#event-place-url').val(),
    access: $('#event-access').val(),
    parking: $('#event-parking').val(),
    schedule: $('#event-schedule').val(),
    songs: $('#event-songs').val(),
    dress: $('#event-dress').val(),
    other: $('#event-other').val(),
    // attendance: $('#event-attendance').prop('checked'), // 【修正】削除
    // 【新規追加】日程調整/出欠確認の種別
    attendanceType: $('input[name="attendance-type"]:checked').val(),
    // 【新規追加】候補日
    candidateDates: getCandidateDatesFromInputs(),
  };
}
function restoreInitialState() {
  $('#event-title').val(initialStateHtml.title);
  $('#event-date').val(initialStateHtml.date || ''); // ← yyyy-MM-dd形式
  $('#event-place-name').val(initialStateHtml.placeName || '');
  $('#event-place-url').val(initialStateHtml.placeUrl || '');
  $('#event-access').val(initialStateHtml.access || '');
  $('#event-parking').val(initialStateHtml.parking || '');
  $('#event-schedule').val(initialStateHtml.schedule || '');
  $('#event-songs').val(initialStateHtml.songs || '');
  $('#event-dress').val(initialStateHtml.dress || '');
  $('#event-other').val(initialStateHtml.other || '');
  // $('#event-attendance').prop('checked', initialStateHtml.attendance); // 【修正】削除

  // 【新規追加】日程調整/出欠確認の種別と候補日の復元
  $('input[name="attendance-type"]').val([initialStateHtml.attendanceType]);
  renderCandidateDates(initialStateHtml.candidateDates);
  toggleDateFields(); // フィールドの表示切り替え

  utils.clearErrors();
}

//==================================
// イベントハンドラ登録
//==================================
function setupEventHandlers(mode) {
  // 【クリアボタン】初期状態に戻す
  $('#clear-button').on('click', async () => {
    if (
      await utils.showDialog(
        mode === 'new' ? '入力内容をクリアしますか？' : '編集前に戻しますか？'
      )
    )
      restoreInitialState();
  });

  // 【新規追加】日程調整/出欠確認のラジオボタン変更時
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
        const docSnap = await utils.getDoc(eventRef);
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

//==================================
// 【新規追加】日付フィールドの表示制御
//==================================
function toggleDateFields() {
  const selectedType = $('input[name="attendance-type"]:checked').val();

  if (selectedType === 'schedule') {
    // 日程調整からする: 候補日入力表示、通常の日付入力非表示
    $('#date-candidates-group').show();
    $('#date-single-group').hide();
  } else {
    // 出欠確認からする / どちらも受け付けない: 通常の日付入力表示、候補日入力非表示
    $('#date-candidates-group').hide();
    $('#date-single-group').show();
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
      <button type="button" class="remove-candidate-date-button clear-button" ${
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

  // 日程調整からする 選択時のみ候補日を取得
  let candidateDates = [];
  if (attendanceType === 'schedule') {
    candidateDates = getCandidateDatesFromInputs()
      .filter((date) => date.trim() !== '') // 空文字列を削除
      .map(formatDateForSave); // 保存用に変換
  }

  const eventData = {
    title: $('#event-title').val().trim(),
    placeName: $('#event-place-name').val().trim(),
    placeUrl: $('#event-place-url').val().trim(),
    access: $('#event-access').val().trim(),
    parking: $('#event-parking').val().trim(),
    schedule: $('#event-schedule').val().trim(),
    songs: $('#event-songs').val().trim(),
    dress: $('#event-dress').val().trim(),
    other: $('#event-other').val().trim(),

    // 【修正・新規追加】日程/出欠関連のデータ
    attendanceType: attendanceType,
    date: attendanceType !== 'schedule' ? formatDateForSave(rawDate) : '', // 'schedule'でなければ通常の日付を保存
    candidateDates: candidateDates, // 'schedule'であれば候補日配列を保存
    // 過去データ互換のため 'attendance' キーは残す場合もあるが、今回は削除されたものとして扱わない

    createdAt: utils.serverTimestamp(),
  };

  // 更新時に updatedAt を追加するロジックは setupEventHandlers内のsave-button処理にあるためここでは省略

  return eventData;
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
    // 【新規追加】日程調整からする: 候補日が1つ以上必須
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
  } else {
    // 【修正】出欠確認からする / どちらも受け付けない: 単一の日付必須
    const date = $('#event-date').val().trim();
    if (!date) {
      utils.markError($('#event-date'), '必須項目です');
      isValid = false;
    }
  }

  return isValid;
}
// yyyy-MM-dd → yyyy.MM.dd
function formatDateForSave(dateStr) {
  return dateStr ? dateStr.replace(/-/g, '.') : '';
}

// yyyy.MM.dd → yyyy-MM-dd
function formatDateForInput(dateStr) {
  return dateStr ? dateStr.replace(/\./g, '-') : '';
}
