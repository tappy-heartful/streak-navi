import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    await setupPage();
    setupEventHandlers();
    utils.hideSpinner();
  } catch (e) {
    await utils.writeLog({
      dataId: utils.globalGetParamMonth,
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

//===========================
// ページ設定（タブ対応）
//===========================
async function setupPage() {
  const months = [
    '1月',
    '2月',
    '3月',
    '4月',
    '5月',
    '6月',
    '7月',
    '8月',
    '9月',
    '10月',
    '11月',
    '12月',
  ];

  // タブを作成
  const $tabsContainer = $('#month-tabs');

  const currentMonth = utils.globalGetParamMonth || '01';

  months.forEach((name, index) => {
    const month = String(index + 1).padStart(2, '0');
    const $li = $(`<li>${name}</li>`);

    if (month === currentMonth) $li.addClass('active');

    $li.on('click', () => {
      $('#month-tabs li').removeClass('active');
      $li.addClass('active');
      loadBlueNotes(month);
    });

    $tabsContainer.append($li);
  });

  // 初期表示
  await loadBlueNotes(currentMonth);
}

//===========================
// 選択月のBlue Note読み込み
//===========================
async function loadBlueNotes(month) {
  utils.showSpinner();
  const year = 2024; // 必要に応じて動的に
  const daysInMonth = new Date(year, month, 0).getDate();

  $('#page-title').text(`Blue Note編集`);
  $('#month').text(Number(month) + '月');

  const $container = $('#blue-note-container').empty();

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, '0');
    const dateId = `${month}${dayStr}`;
    const displayDay = String(day);

    const docRef = utils.doc(utils.db, 'blueNotes', dateId);
    const docSnap = await utils.getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      $container.append(`
          <div class="form-group blue-note-item" data-date="${dateId}">
            <label class="day-label">${displayDay}日</label>
            <input type="text" class="title-input" value="${
              data.title || ''
            }" disabled />
            <input type="text" class="url-input" value="${
              data.youtubeUrl || ''
            }" disabled />
            <button class="delete-button">削除</button>
          </div>
        `);
    } else {
      $container.append(`
          <div class="form-group blue-note-item" data-date="${dateId}">
            <label class="day-label">${displayDay}日</label>
            <input type="text" class="title-input" placeholder="曲名" />
            <input type="text" class="url-input" placeholder="YouTube URL" />
            <button class="save-button">保存</button>
          </div>
        `);
    }
  }
  utils.hideSpinner();
}

//===========================
// イベント設定
//===========================
function setupEventHandlers() {
  // 保存
  $(document).on('click', '.save-button', async function () {
    const $item = $(this).closest('.blue-note-item');
    const dateId = $item.data('date');
    const title = $item.find('.title-input').val().trim();
    const youtubeUrl = $item.find('.url-input').val().trim();

    if (!title || !youtubeUrl) {
      await utils.showDialog('タイトルとURLを両方入力してください', true);
      return;
    }

    const videoId = extractYouTubeId(youtubeUrl);
    if (!videoId) {
      await utils.showDialog('YouTubeのURLを正しく入力してください', true);
      return;
    }

    if (!(await utils.showDialog('保存しますか？'))) return;

    utils.showSpinner();
    try {
      await utils.setDoc(
        utils.doc(utils.db, 'blueNotes', dateId),
        {
          title,
          youtubeUrl,
          updatedAt: utils.serverTimestamp(),
        },
        { merge: true }
      );

      await utils.writeLog({ dataId: dateId, action: '保存' });
      utils.hideSpinner();

      await utils.showDialog('保存しました', true);
      window.location.reload();
    } catch (e) {
      await utils.writeLog({
        dataId: dateId,
        action: '保存',
        status: 'error',
        errorDetail: { message: e.message, stack: e.stack },
      });
    } finally {
      utils.hideSpinner();
    }
  });

  // 削除
  $(document).on('click', '.delete-button', async function () {
    const $item = $(this).closest('.blue-note-item');
    const dateId = $item.data('date');

    if (!(await utils.showDialog('削除しますか？'))) return;

    utils.showSpinner();
    try {
      await utils.deleteDoc(utils.doc(utils.db, 'blueNotes', dateId));
      await utils.writeLog({ dataId: dateId, action: '削除' });
      window.location.reload();
    } catch (e) {
      await utils.writeLog({
        dataId: dateId,
        action: '削除',
        status: 'error',
        errorDetail: { message: e.message, stack: e.stack },
      });
    } finally {
      utils.hideSpinner();
    }
  });

  // TOPに戻る
  $('.back-link').on('click', () => {
    window.location.href = '../top/top.html';
  });
}

//===========================
// YouTube動画ID抽出
//===========================
function extractYouTubeId(url) {
  const reg =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w\-]+)/;
  const match = url.match(reg);
  return match ? match[1] : null;
}
