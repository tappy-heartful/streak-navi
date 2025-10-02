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
    $('#event-attendance').prop('checked', true);
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
  $('#event-attendance').prop('checked', !!data.attendance);
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
    attendance: $('#event-attendance').prop('checked'),
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
  $('#event-attendance').prop('checked', initialStateHtml.attendance);

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
// イベントデータ収集
//==================================
async function collectEventData(mode) {
  const rawDate = $('#event-date').val();

  const eventData = {
    title: $('#event-title').val().trim(),
    date: formatDateForSave(rawDate), // ← 保存用に変換
    placeName: $('#event-place-name').val().trim(),
    placeUrl: $('#event-place-url').val().trim(),
    access: $('#event-access').val().trim(),
    parking: $('#event-parking').val().trim(),
    schedule: $('#event-schedule').val().trim(),
    songs: $('#event-songs').val().trim(),
    dress: $('#event-dress').val().trim(),
    other: $('#event-other').val().trim(),
    attendance: $('#event-attendance').prop('checked'),
    createdAt: utils.serverTimestamp(),
  };

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

  // --- 日付必須 ---
  const date = $('#event-date').val().trim();
  if (!date) {
    utils.markError($('#event-date'), '必須項目です');
    isValid = false;
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
