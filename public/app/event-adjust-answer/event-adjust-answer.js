import * as utils from '../common/functions.js';

// ** 曜日を取得するヘルパー関数を追加 **
function getDayOfWeek(dateStr) {
  // dateStrは "YYYY.MM.DD" 形式を想定
  try {
    const parts = dateStr.split('.').map(Number);
    // 月は0から始まるため -1 する
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return days[date.getDay()];
  } catch (e) {
    return ''; // パースエラー時は空文字
  }
}

//==================================
// 初期化処理（ページ読込時）
//==================================
$(document).ready(async function () {
  try {
    const eventId = utils.globalGetParamEventId;
    const uid = utils.getSession('uid');

    await utils.initDisplay();

    // イベント情報取得
    const eventData = await fetchEventData(eventId);
    if (
      eventData.attendanceType !== 'schedule' ||
      !eventData.candidateDates ||
      eventData.candidateDates.length === 0
    ) {
      await utils.showDialog(
        'このイベントは日程調整を受け付けていません。',
        true
      );
      window.location.href = `../event-confirm/event-confirm.html?eventId=${eventId}`;
      return;
    }

    // 日程調整ステータス取得（eventAdjustStatus）
    const statuses = await fetchAdjustStatuses();

    // 既存回答データ取得
    let answerData = await fetchAnswerData(eventId, uid);
    let mode = answerData ? 'edit' : 'new';

    // 回答データがなければ空オブジェクト
    answerData = answerData || {};

    // パンくず
    utils.renderBreadcrumb([
      { title: 'イベント一覧', url: '../event-list/event-list.html' },
      {
        title: 'イベント確認',
        url: `../event-confirm/event-confirm.html?eventId=${eventId}`,
      },
      { title: mode === 'edit' ? '日程調整修正' : '日程調整回答' },
    ]);

    setupPageMode(mode);
    renderEvent(eventData, statuses, answerData);
    setupEventHandlers(mode, eventId, uid, eventData.candidateDates); // 候補日をハンドラに渡す

    // ** 【修正】選択状態のスタイルを切り替えるイベントリスナーを設定 **
    setupStyleSwitching();
  } catch (e) {
    await utils.writeLog({
      dataId: utils.globalGetParamEventId,
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

// -------------------------------------
// ページ表示モードの設定
// -------------------------------------
function setupPageMode(mode) {
  const title = mode === 'edit' ? '日程調整修正' : '日程調整回答';
  const buttonText = mode === 'edit' ? '回答を修正する' : '回答を登録する';
  $('#title').text(title);
  $('#page-title').text(title);
  $('#answer-submit').text(buttonText);
}

// -------------------------------------
// データ取得
// -------------------------------------
async function fetchEventData(eventId) {
  const docSnap = await utils.getDoc(utils.doc(utils.db, 'events', eventId));
  if (!docSnap.exists())
    throw new Error('イベントが見つかりません：' + eventId);
  return docSnap.data();
}

async function fetchAdjustStatuses() {
  // eventAdjustStatusコレクションからデータを取得
  const snapshot = await utils.getDocs(
    utils.collection(utils.db, 'eventAdjustStatus')
  );
  // statusNameでソート（〇→△→✕の順を期待）
  const statuses = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return statuses.sort((a, b) => {
    const order = { 〇: 1, '△': 2, '✕': 3 };
    return (order[a.name] || 99) - (order[b.name] || 99);
  });
}

async function fetchAnswerData(eventId, uid) {
  const ansDoc = await utils.getDoc(
    utils.doc(utils.db, 'eventAdjustAnswers', `${eventId}_${uid}`)
  );
  // 回答データは { eventId, uid, answers: { "2025.12.01": "statusId", ... } } 形式を想定
  if (ansDoc.exists()) {
    return ansDoc.data();
  }
  return null;
}

// -------------------------------------
// 画面描画
// -------------------------------------
function renderEvent(eventData, statuses, answerData) {
  $('#event-title').text(eventData.title || '');

  const container = $('#date-answer-container').empty();
  const $table = $('<div class="adjust-table"></div>');
  const candidateDates = eventData.candidateDates || [];
  const existingAnswers = answerData.answers || {};

  // ヘッダー行
  const $headerRow = $('<div class="adjust-row header-row"></div>');
  $headerRow.append('<div class="date-cell">日付<br>(曜日)</div>'); // 【修正】ヘッダーも変更
  statuses.forEach((status) => {
    $headerRow.append(`<div class="status-cell">${status.name}</div>`);
  });
  $table.append($headerRow);

  // データ行
  candidateDates.forEach((date) => {
    const dayOfWeek = getDayOfWeek(date); // 曜日を取得
    const dateParts = date.split('.');
    const monthDay = `${dateParts[1]}/${dateParts[2]}`; // 月/日 形式

    const $row = $('<div class="adjust-row"></div>');
    // 【修正】日付と曜日を結合して表示
    $row.append(
      `<div class="date-cell"><span class="date-part">${monthDay}</span><span class="day-part">(${dayOfWeek})</span></div>`
    );

    statuses.forEach((status) => {
      const radioId = `date-${date.replace(/\./g, '-')}-${status.id}`;
      // 候補日(yyyy.MM.dd)に対応する回答ステータスを取得
      const isChecked = existingAnswers[date] === status.id;
      const checked = isChecked ? 'checked' : '';

      // ** 【修正】ラベル内にステータス名を表示するspanタグを追加 **
      const $statusCell = $(`
        <div class="status-cell ${
          isChecked ? 'selected' : ''
        }" data-date="${date}"> 
          <label for="${radioId}">
            <input 
              type="radio" 
              name="answer-${date}" 
              id="${radioId}" 
              value="${status.id}" 
              ${checked}
              data-date="${date}"
            />
            <span class="status-name">${status.name}</span>
          </label>
        </div>
      `);
      $row.append($statusCell);
    });
    $table.append($row);
  });

  container.append($table);
}

// -------------------------------------
// スタイル切替イベントハンドラ
// -------------------------------------
function setupStyleSwitching() {
  // status-cell全体がクリックされたときの処理
  $('.adjust-table').on('click', '.status-cell', function (event) {
    const $cell = $(this);
    const date = $cell.data('date');
    const $radio = $cell.find('input[type="radio"]');

    // クリックした要素がラジオボタン本体やラベルでないことを確認
    if (
      !$(event.target).is('input[type="radio"]') &&
      !$(event.target).is('label')
    ) {
      // ラジオボタンをクリック
      $radio.prop('checked', true).trigger('change');
    }
  });

  // ラジオボタンの変更イベント（checked状態が変化したとき）
  $('.adjust-table').on('change', 'input[type="radio"]', function () {
    const $changedRadio = $(this);
    const date = $changedRadio.data('date');

    // 同じ行の全てのセルから 'selected' クラスを削除
    $(`.status-cell[data-date="${date}"]`).removeClass('selected');

    // 選択されたラジオボタンの親セルに 'selected' クラスを追加
    if ($changedRadio.is(':checked')) {
      $changedRadio.closest('.status-cell').addClass('selected');
    }
  });

  // 初回ロード時にもスタイルを適用
  $('input[type="radio"]:checked').each(function () {
    $(this).closest('.status-cell').addClass('selected');
  });
}

// -------------------------------------
// イベントハンドラ登録 (省略、変更なし)
// -------------------------------------
function setupEventHandlers(mode, eventId, uid, candidateDates) {
  // 回答送信
  $('#answer-submit').on('click', async function () {
    // 1. 回答データの収集
    const answers = {};
    let isAllAnswered = true;

    // 【修正】エラー行のクラスをリセット
    $('.adjust-row').removeClass('error-row');

    candidateDates.forEach((date) => {
      const selectedRadio = $(`input[name="answer-${date}"]:checked`);
      if (selectedRadio.length > 0) {
        answers[date] = selectedRadio.val();
      } else {
        isAllAnswered = false;
        // 未回答の候補日の日付行をエラー表示
        $(`.adjust-row:has(input[name="answer-${date}"])`).addClass(
          'error-row'
        );
      }
    });

    // 2. 入力チェック
    if (!isAllAnswered) {
      await utils.showDialog('すべての候補日に回答を選択してください。', true);
      return;
    }
    // エラーがない場合は解除済み

    const confirmed = await utils.showDialog(
      `回答を${mode === 'edit' ? '修正' : '登録'}しますか？`
    );
    if (!confirmed) return;

    try {
      utils.showSpinner();

      // 3. Firestoreへの保存
      await utils.setDoc(
        utils.doc(utils.db, 'eventAdjustAnswers', `${eventId}_${uid}`),
        {
          eventId,
          uid,
          answers: answers, // { "2025.12.01": "statusId", ... } 形式
          updatedAt: utils.serverTimestamp(),
        },
        { merge: true }
      );

      // ログ登録
      await utils.writeLog({
        dataId: eventId,
        action: mode === 'edit' ? '日程調整修正' : '日程調整回答登録',
      });

      utils.hideSpinner();
      await utils.showDialog(
        `回答を${mode === 'edit' ? '修正' : '登録'}しました`,
        true
      );
      window.location.href = `../event-confirm/event-confirm.html?eventId=${eventId}`;
    } catch (e) {
      // ログ登録
      await utils.writeLog({
        dataId: eventId,
        action: mode === 'edit' ? '日程調整修正' : '日程調整回答登録',
        status: 'error',
        errorDetail: { message: e.message, stack: e.stack },
      });
    } finally {
      // スピナー非表示
      utils.hideSpinner();
    }
  });

  // 戻るリンク
  $(document).on('click', '.back-link', function () {
    window.location.href = `../event-confirm/event-confirm.html?eventId=${eventId}`;
  });
}
