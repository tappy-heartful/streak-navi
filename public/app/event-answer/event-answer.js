import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    const eventId = utils.globalGetParamEventId;
    const uid = utils.getSession('uid');

    await utils.initDisplay();

    // 回答データがあるか確認
    let answerData = await fetchAnswerData(eventId, uid);
    let mode = answerData ? 'edit' : 'new';

    setupPageMode(mode);

    // イベント情報取得
    const eventData = await fetchEventData(eventId);

    // 出欠ステータス取得
    const statuses = await fetchAttendanceStatuses();

    // 回答データがなければ空オブジェクト
    answerData = answerData || {};

    renderEvent(eventData, statuses, answerData);

    setupEventHandlers(mode, eventId, uid);
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
  // パンくず
  utils.renderBreadcrumb([
    { title: 'イベント一覧', url: '../event-list/event-list.html' },
    {
      title: 'イベント確認',
      url: `../event-confirm/event-confirm.html?eventId=${eventId}`,
    },
    { title: mode === 'edit' ? '回答修正' : '回答登録' },
  ]);

  const title = mode === 'edit' ? '回答修正' : '回答登録';
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

async function fetchAttendanceStatuses() {
  const snapshot = await utils.getDocs(
    utils.collection(utils.db, 'attendanceStatuses')
  );
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function fetchAnswerData(eventId, uid) {
  const ansDoc = await utils.getDoc(
    utils.doc(utils.db, 'eventAnswers', `${eventId}_${uid}`)
  );
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
  $('#event-date').text(eventData.date || '');

  const container = $('#event-items-container').empty();

  statuses.forEach((status) => {
    const radioId = `status-${status.id}`;
    const checked = answerData.status === status.id ? 'checked' : '';

    const itemHtml = `
      <div class="status-choice">
        <label for="${radioId}">
          <input type="radio" name="attendance-status" id="${radioId}" value="${status.id}" ${checked}/>
          ${status.name}
        </label>
      </div>
    `;
    container.append(itemHtml);
  });
}

// -------------------------------------
// イベントハンドラ登録
// -------------------------------------
function setupEventHandlers(mode, eventId, uid) {
  // 回答送信
  $('#answer-submit').on('click', async function () {
    const selected = $('input[name="attendance-status"]:checked').val();

    // 入力チェック
    if (!selected) {
      await utils.showDialog('出欠を選択してください。', true);
      return;
    }

    const confirmed = await utils.showDialog(
      `回答を${mode === 'edit' ? '修正' : '登録'}しますか？`
    );
    if (!confirmed) return;

    try {
      utils.showSpinner();

      await utils.setDoc(
        utils.doc(utils.db, 'eventAnswers', `${eventId}_${uid}`),
        {
          eventId,
          uid,
          status: selected,
          updatedAt: utils.serverTimestamp(),
        },
        { merge: true }
      );

      // ログ登録
      await utils.writeLog({
        dataId: eventId,
        action: mode === 'edit' ? '修正' : '登録',
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
        action: mode === 'edit' ? '修正' : '登録',
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
