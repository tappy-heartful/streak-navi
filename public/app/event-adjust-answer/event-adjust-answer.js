import * as utils from '../common/functions.js';

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
  // 日付表示欄は削除されたため、ここでの処理は不要

  const container = $('#date-answer-container').empty();
  const $table = $('<div class="adjust-table"></div>');
  const candidateDates = eventData.candidateDates || [];
  const existingAnswers = answerData.answers || {};

  // ヘッダー行
  const $headerRow = $('<div class="adjust-row header-row"></div>');
  $headerRow.append('<div class="date-cell">日付</div>');
  statuses.forEach((status) => {
    $headerRow.append(`<div class="status-cell">${status.name}</div>`);
  });
  $table.append($headerRow);

  // データ行
  candidateDates.forEach((date) => {
    const $row = $('<div class="adjust-row"></div>');
    $row.append(`<div class="date-cell">${date}</div>`);

    statuses.forEach((status) => {
      const radioId = `date-${date.replace(/\./g, '-')}-${status.id}`;
      // 候補日(yyyy.MM.dd)に対応する回答ステータスを取得
      const checked = existingAnswers[date] === status.id ? 'checked' : '';

      const $statusCell = $(`
        <div class="status-cell">
          <label for="${radioId}">
            <input 
              type="radio" 
              name="answer-${date}" 
              id="${radioId}" 
              value="${status.id}" 
              ${checked}
              data-date="${date}"
              data-status-name="${status.name}"
            />
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
// イベントハンドラ登録
// -------------------------------------
function setupEventHandlers(mode, eventId, uid, candidateDates) {
  // 回答送信
  $('#answer-submit').on('click', async function () {
    // 1. 回答データの収集
    const answers = {};
    let isAllAnswered = true;

    candidateDates.forEach((date) => {
      const selectedRadio = $(`input[name="answer-${date}"]:checked`);
      if (selectedRadio.length > 0) {
        answers[date] = selectedRadio.val();
      } else {
        isAllAnswered = false;
        // 未回答の候補日の日付セルをエラー表示
        $(`.adjust-row:contains('${date}')`).addClass('error-row');
      }
    });

    // 2. 入力チェック
    if (!isAllAnswered) {
      await utils.showDialog('すべての候補日に回答を選択してください。', true);
      $('.adjust-row').removeClass('error-row'); // 一度すべて解除してから
      // 未回答の行を再度エラー表示
      candidateDates.forEach((date) => {
        if (!$(`input[name="answer-${date}"]:checked`).length) {
          $(`.adjust-row:contains('${date}')`).addClass('error-row');
        }
      });
      return;
    }
    $('.adjust-row').removeClass('error-row'); // エラーがない場合は解除

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
