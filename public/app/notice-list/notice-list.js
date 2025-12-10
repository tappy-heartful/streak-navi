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
    const scheduledDate = data.scheduledDate; // yyyy.MM.dd形式を想定

    let isClosed = false;
    if (scheduledDate) {
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
  // 紐づいているイベント等の情報を表示（events.date または 受付期間）
  const subInfo = data.relatedPeriod
    ? `(${data.relatedPeriod})`
    : data.scheduledDate || '';

  return $(`
    <li>
      <a href="../notice-confirm/notice-confirm.html?noticeId=${noticeId}" class="notice-link">
        <div class="notice-info">
          <span class="notice-date">${subInfo}</span>
          <span class="notice-title">${data.title}</span>
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
