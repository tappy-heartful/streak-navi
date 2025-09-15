import * as utils from '../common/functions.js';

let initialState = {};

//===========================
// 初期化
//===========================
$(document).ready(async function () {
  try {
    await utils.initDisplay();
    await setupPage();
    captureInitialState();
    setupEventHandlers();
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
// ページ設定
//===========================
async function setupPage() {
  const month = utils.globalGetParamMonth; // "01" ~ "12"
  const year = 2024;
  const daysInMonth = new Date(year, month, 0).getDate();

  $('#page-title').text(`${month}月の楽曲編集`);

  const $container = $('#blue-note-container').empty();

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, '0');
    const dateId = `${month}${dayStr}`; // e.g. "0101"

    $container.append(`
    <div class="form-group blue-note-item" data-date="${dateId}">
      <label>${month}/${dayStr}</label>
      <input type="text" class="title-input" placeholder="曲名" />
      <input type="text" class="url-input" placeholder="YouTube URL" />
    </div>
  `);

    // Firestoreからデータ読み込み
    const docRef = utils.doc(utils.db, 'blueNotes', dateId);
    const docSnap = await utils.getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      $(`.blue-note-item[data-date="${dateId}"] .title-input`).val(
        data.title || ''
      );
      $(`.blue-note-item[data-date="${dateId}"] .url-input`).val(
        data.youtubeUrl || ''
      );
    }
  }
}

function setupEventHandlers() {
  $('#clear-button').on('click', async () => {
    if (await utils.showDialog('入力内容をクリアしますか？')) {
      restoreInitialState();
    }
  });

  $('#save-button').on('click', async () => {
    if (!(await utils.showDialog('保存しますか？'))) return;

    utils.showSpinner();
    try {
      const updates = [];

      $('.blue-note-item').each(function () {
        const dateId = $(this).data('date');
        const title = $(this).find('.title-input').val().trim();
        const youtubeUrl = $(this).find('.url-input').val().trim();

        updates.push(
          utils.setDoc(
            utils.doc(utils.db, 'blueNotes', dateId),
            {
              title,
              youtubeUrl,
              updatedAt: utils.serverTimestamp(),
            },
            { merge: true }
          )
        );
      });

      await Promise.all(updates);
      await utils.writeLog({
        dataId: utils.globalGetParamMonth,
        action: '保存',
      });
      utils.hideSpinner();
      await utils.showDialog('保存しました', true);
      window.location.reload();
    } catch (e) {
      await utils.writeLog({
        dataId: utils.globalGetParamMonth,
        action: '保存',
        status: 'error',
        errorDetail: { message: e.message, stack: e.stack },
      });
    } finally {
      utils.hideSpinner();
    }
  });

  $('.back-link').on('click', () => {
    window.location.href = '../blue-note-list/blue-note-list.html';
  });
}

function captureInitialState() {
  initialState = {};
  $('.blue-note-item').each(function () {
    const dateId = $(this).data('date');
    initialState[dateId] = {
      title: $(this).find('.title-input').val(),
      youtubeUrl: $(this).find('.url-input').val(),
    };
  });
}

function restoreInitialState() {
  for (const [dateId, values] of Object.entries(initialState)) {
    const $item = $(`.blue-note-item[data-date="${dateId}"]`);
    $item.find('.title-input').val(values.title);
    $item.find('.url-input').val(values.youtubeUrl);
  }
}
