import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    utils.renderBreadcrumb([{ title: '通知設定一覧' }]);
    await setUpPage();
  } catch (e) {
    await utils.writeLog({
      dataId: 'none',
      action: '通知設定一覧初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

async function setUpPage() {
  // 管理者チェック（通知設定は管理者のみとする場合）
  const isAdmin = utils.isAdmin('Notice');
  if (!isAdmin) {
    $('#custom-add-button').hide();
  }

  const $futureList = $('#custom-future-list').empty();
  const $closedList = $('#custom-closed-list').empty();

  // Firestoreからカスタム通知（notices）を取得
  // 💡 scheduledDateは、schedules内の日付を代表する最も早い日付が設定されていることを期待
  const noticesRef = utils.collection(utils.db, 'notices');
  const qNotice = utils.query(
    noticesRef,
    utils.orderBy('scheduledDate', 'asc')
  );
  const noticeSnap = await utils.getWrapDocs(qNotice);

  const futureItems = [];
  const closedItems = [];

  const now = new Date();
  const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const noticeDoc of noticeSnap.docs) {
    const data = noticeDoc.data();
    const noticeId = noticeDoc.id;
    // 💡 クエリ用の日付を使用。実際にはschedulesの全ての日付を見るのが理想だが、ここではソートキーとして利用
    const scheduledDate = data.scheduledDate;

    let isClosed = false;
    if (scheduledDate) {
      // 💡 scheduledDate (yyyy.MM.dd) が存在する場合、その日付が今日より前かどうかで判定
      const [year, month, day] = scheduledDate.split('.').map(Number);
      const dateObj = new Date(year, month - 1, day);
      if (dateObj < todayOnly) isClosed = true;
    }

    const item = makeNoticeItem(noticeId, data);

    if (isClosed) {
      closedItems.push(item);
    } else {
      futureItems.push(item);
    }
  }

  // リストの描画
  if (futureItems.length > 0) {
    futureItems.forEach((item) => $futureList.append(item));
  } else {
    showEmptyMessage($futureList);
  }

  if (closedItems.length > 0) {
    closedItems.reverse().forEach((item) => $closedList.append(item)); // 終了分は最新順
    $('#closed-container').show();
  } else {
    $('#closed-container').hide();
  }
}

function makeNoticeItem(noticeId, data) {
  // 💡 【修正】サブ情報 (notice-date): schedules内の日付をカンマ区切りで抽出
  let allDates = [];
  if (data.schedules && Array.isArray(data.schedules)) {
    allDates = data.schedules
      .map((s) => s.scheduledDate)
      .filter((date) => date); // 空の日付を除外
  }
  const dateDisplay = allDates.length > 0 ? allDates.join(', ') : '日付未設定';

  // 💡 【修正】タイトル (notice-title): 紐づけ対象名またはカスタム通知名
  let title;
  if (data.relatedId && data.relatedType !== 'none') {
    // 紐づけあり: 紐づけ対象のタイトルを表示
    title =
      data.relatedTitle || `[${data.relatedType}] 紐づけ対象が見つかりません`;
  } else {
    // 紐づけなし: カンマ区切りにした日付のカスタム通知
    title = `[${dateDisplay}] のカスタム通知`;
  }

  return $(`
    <li>
      <a href="../notice-custom-confirm/notice-custom-confirm.html?noticeId=${noticeId}" class="notice-link">
        <div class="notice-info">
          <span class="notice-date">${dateDisplay}</span>
          <span class="notice-title">${title}</span>
        </div>
        <i class="fa fa-chevron-right icon-arrow"></i>
      </a>
    </li>
  `);
}

function showEmptyMessage($list) {
  $list.append(`
    <li class="empty-message">
      <div class="notice-link empty">該当の通知設定はありません🍀</div>
    </li>
  `);
}
