import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    // 画面ごとのパンくずをセット
    utils.renderBreadcrumb([{ title: '譜割り一覧' }]);
    await setUpPage();
  } catch (e) {
    // ログ登録
    await utils.writeLog({
      dataId: 'none',
      action: '譜割り一覧 初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    // スピナー非表示
    utils.hideSpinner();
  }
});

async function setUpPage() {
  // 譜割り一覧は新規作成ボタン不要のため、既存のボタンは非表示を維持
  // #schedule-add-button, #attendance-add-button は HTMLから削除済みを想定

  // 各リスト要素をクリア
  const $futureList = $('#future-list').empty(); // 今後のイベント
  const $scheduleList = $('#schedule-list').empty(); // 日程調整中のイベント
  const $closedList = $('#closed-list').empty(); // 終了したイベント

  const eventsRef = utils.collection(utils.db, 'events');
  // 💡 【修正点】譜割り対象イベント（allowAssign=true）のみを取得し、日付順でソート
  const qEvent = utils.query(
    eventsRef,
    utils.where('allowAssign', '==', true), // 譜割り対象のみ
    utils.orderBy('date', 'desc') // 日付降順で取得 (終了イベントの処理が容易になるため)
  );
  const eventSnap = await utils.getWrapDocs(qEvent);

  // ステータスごとに配列を分ける
  const futureItems = []; // 今後のイベント
  const scheduleItems = []; // 日程調整中のイベント
  const closedItems = []; // 終了したイベント

  for (const eventDoc of eventSnap.docs) {
    const eventData = eventDoc.data();
    const eventId = eventDoc.id;
    const eventDate = eventData.date; // 'yyyy.MM.dd' 形式
    const eventTitle = eventData.title_decoded; // デコードされたタイトルを使用
    const attendanceType = eventData.attendanceType || 'attendance';

    let isClosed = false;
    let displayDate = eventDate;
    let dateIcon = '📅';

    // 日付判定（終了判定）
    if (eventDate) {
      const now = new Date(); // 現在の日時
      const todayOnly = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      ); // 今日の0:00

      // eventDate は 'yyyy.MM.dd' 形式
      const [year, month, day] = eventDate.split('.').map(Number);
      const eventDateObj = new Date(year, month - 1, day); // JSの月は0始まり

      if (eventDateObj < todayOnly) {
        // 昨日以前
        isClosed = true;
      }
    }

    // ステータスとクラスをセット (今回は「終了」以外は空で、後から回答状況を実装する想定)
    let status = '';
    let statusClass = '';

    if (isClosed) {
      // 終了イベント
      status = '終了';
      statusClass = 'closed';

      closedItems.push(
        makeEventItem(
          eventId,
          displayDate,
          dateIcon,
          eventTitle,
          status,
          statusClass
        )
      );
    } else if (attendanceType === 'schedule') {
      // 日程調整中のイベント (日付未定の可能性あり)
      // 💡 「日程調整中」コンテナに分類
      scheduleItems.push(
        makeEventItem(
          eventId,
          displayDate,
          dateIcon,
          eventTitle,
          status,
          statusClass
        )
      );
    } else if (attendanceType === 'attendance') {
      // 今後のイベント (出欠確認)
      // 💡 「今後のイベント」コンテナに分類
      futureItems.push(
        makeEventItem(
          eventId,
          displayDate,
          dateIcon,
          eventTitle,
          status,
          statusClass
        )
      );
    }
  }

  // 1. 今後のイベント: 日付昇順（早い順）に並び替えて表示
  // ※ Firestoreのクエリは降順だが、今後のイベントは日付が早い順に見たいので反転させる
  futureItems.reverse().forEach((item) => $futureList.append(item));
  if (futureItems.length === 0) {
    showEmptyMessage($futureList);
  }

  // 2. 日程調整中のイベント: Firestoreの降順のまま追加 (日程未定のものはソートされない)
  scheduleItems.forEach((item) => $scheduleList.append(item));
  if (scheduleItems.length === 0) {
    showEmptyMessage($scheduleList);
  }

  // 3. 終了したイベント: 日付降順（新しい順）のまま表示
  if (closedItems.length > 0) {
    closedItems.forEach((item) => $closedList.append(item));
    $('#closed-container').show();
    // 終了イベントを初期状態で折りたたむ
    $('#closed-body').hide();

    // アコーディオンのイベントリスナーをセット
    $('.toggle-header')
      .off('click')
      .on('click', function () {
        const targetId = $(this).data('target');
        $(`#${targetId}`).slideToggle(300);
      });
  } else {
    // 0件の場合、コンテナごと非表示
    $('#closed-container').hide();
  }
}

/**
 * イベントアイテムのHTML要素を生成する関数
 * @param {string} eventId - イベントID
 * @param {string} date - イベント日付
 * @param {string} dateIcon - 日付アイコン
 * @param {string} title - イベントタイトル
 * @param {string} status - 回答ステータス ('終了'など)
 * @param {string} statusClass - ステータスに応じたCSSクラス
 * @returns {JQuery} 生成されたjQuery要素
 */
function makeEventItem(eventId, date, dateIcon, title, status, statusClass) {
  const statusHtml = status
    ? `<span class="answer-status ${statusClass}">${status}</span>`
    : ''; // ステータスが空ならラベル自体を非表示

  // 💡 【修正点】リンク先を譜割り編集画面に変更
  return $(`
    <li>
      <a href="../assign-confirm/assign-confirm.html?eventId=${eventId}" class="event-link">
        <div class="event-info">
        ${
          date
            ? `<span class='event-date'>
              ${dateIcon}${utils.getDayOfWeek(date)}
            </span>`
            : ''
        }
          <span class="event-title">${title}</span>
        </div>
        ${statusHtml}
      </a>
    </li>
  `);
}

/**
 * リストが空の場合のメッセージを表示する関数
 * @param {JQuery} $list - イベントリストのul要素
 */
function showEmptyMessage($list) {
  $list.append(`
    <li class="empty-message">
      <div class="event-link empty">
        該当のイベントはありません🍀
      </div>
    </li>
  `);
}
