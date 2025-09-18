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

  const currentMonth =
    utils.globalGetParamMonth || String(new Date().getMonth() + 1);

  months.forEach((name, index) => {
    const month = String(index + 1);
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
  await loadBlueNotes(Number(currentMonth));
}

//===========================
// 選択月のBlue Note読み込み（修正版）
//===========================
let currentLoadId = 0; // グローバルに管理

async function loadBlueNotes(month) {
  const loadId = ++currentLoadId; // 呼び出しごとにIDを更新
  const year = 2024;
  const daysInMonth = new Date(year, Number(month), 0).getDate();

  $('#page-title').text(`Blue Note編集`);
  $('#month').text(month + '月');

  const $container = $('#blue-note-container').empty();

  for (let day = 1; day <= daysInMonth; day++) {
    // 途中で別の月の読み込みが始まったら中断
    if (loadId !== currentLoadId) return;

    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(month).padStart(2, '0'); // ← Firestore IDはゼロ埋めで統一
    const dateId = `${monthStr}${dayStr}`;
    const displayDay = String(day);

    const docRef = utils.doc(utils.db, 'blueNotes', dateId);
    const docSnap = await utils.getDoc(docRef);

    // 再度チェック（await 後に別の月に切り替わった場合）
    if (loadId !== currentLoadId) return;

    if (docSnap.exists()) {
      const data = docSnap.data();

      // 削除ボタン表示判定
      const showDelete =
        data.createdBy === utils.getSession('uid') ||
        utils.getSession('isBlueNoteAdmin') === utils.globalStrTrue;

      $container.append(`
        <div class="form-group blue-note-item" data-date="${dateId}">
          <label class="day-label">${displayDay}日</label>
          <span class="label-value title-value">${data.title || ''}</span>
          <span class="label-value url-value">${
            data.youtubeId ? `https://youtu.be/${data.youtubeId}` : ''
          }</span>
          <button class="delete-button" style="display: ${
            showDelete ? 'inline-block' : 'none'
          };">削除</button>
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
}
// ===========================
// 特定の日付だけUIを更新する関数
// ===========================
async function refreshBlueNoteItem(dateId) {
  const monthStr = dateId.slice(0, 2);
  const dayStr = dateId.slice(2);
  const displayDay = Number(dayStr);

  const docRef = utils.doc(utils.db, 'blueNotes', dateId);
  const docSnap = await utils.getDoc(docRef);

  const $container = $(`.blue-note-item[data-date="${dateId}"]`).parent();
  const $oldItem = $(`.blue-note-item[data-date="${dateId}"]`);

  if (docSnap.exists()) {
    const data = docSnap.data();
    const showDelete =
      data.createdBy === utils.getSession('uid') ||
      utils.getSession('isBlueNoteAdmin') === utils.globalStrTrue;

    const $newItem = $(`
      <div class="form-group blue-note-item" data-date="${dateId}">
        <label class="day-label">${displayDay}日</label>
        <span class="label-value title-value">${data.title || ''}</span>
        <span class="label-value url-value">${
          data.youtubeId ? `https://youtu.be/${data.youtubeId}` : ''
        }</span>
        <button class="delete-button" style="display: ${
          showDelete ? 'inline-block' : 'none'
        };">削除</button>
      </div>
    `);

    $oldItem.replaceWith($newItem);
  } else {
    const $newItem = $(`
      <div class="form-group blue-note-item" data-date="${dateId}">
        <label class="day-label">${displayDay}日</label>
        <input type="text" class="title-input" placeholder="曲名" />
        <input type="text" class="url-input" placeholder="YouTube URL" />
        <button class="save-button">保存</button>
      </div>
    `);

    $oldItem.replaceWith($newItem);
  }
}

//===========================
// イベント設定
//===========================
function setupEventHandlers() {
  // 保存
  $(document).on('click', '.save-button', async function () {
    utils.clearErrors(); // 既存エラーをクリア

    const $item = $(this).closest('.blue-note-item');
    const dateId = $item.data('date');
    const $titleField = $item.find('.title-input');
    const $urlField = $item.find('.url-input');
    const title = $titleField.val().trim();
    const youtubeUrl = $urlField.val().trim();

    // 🔹 エラー表示用領域を作る（itemの直下）
    let $errorContainer = $item.find('.error-container');
    if ($errorContainer.length === 0) {
      $errorContainer = $('<div class="error-container"></div>');
      $item.append($errorContainer);
    }
    $errorContainer.empty();

    let hasError = false;
    if (!title) {
      $errorContainer.append(
        '<div class="error-message">タイトルを入力してください</div>'
      );
      hasError = true;
    }
    if (!youtubeUrl) {
      $errorContainer.append(
        '<div class="error-message">URLを入力してください</div>'
      );
      hasError = true;
    }
    if (hasError) return;

    const videoId = extractYouTubeId(youtubeUrl);
    if (!videoId) {
      $errorContainer.append(
        '<div class="error-message">YouTubeのURLを正しく入力してください</div>'
      );
      return;
    }

    // 🔽 重複チェック（動画ID単位で判定）
    const allDocsSnap = await utils.getDocs(
      utils.collection(utils.db, 'blueNotes')
    );
    let duplicateFound = false;

    allDocsSnap.forEach((doc) => {
      const data = doc.data();
      const existingId = data.youtubeId || '';
      if (existingId && existingId === videoId) {
        $errorContainer.append(
          `<div class="error-message">この動画は既に登録されています：${parseInt(
            doc.id.slice(0, 2),
            10
          )}月${parseInt(doc.id.slice(2), 10)}日</div>`
        );
        duplicateFound = true;
      }
    });

    if (duplicateFound) return;

    if (!(await utils.showDialog('保存しますか？'))) return;

    utils.showSpinner();
    try {
      await utils.setDoc(
        utils.doc(utils.db, 'blueNotes', dateId),
        {
          title,
          youtubeId: videoId, // ← ここだけ保存
          updatedAt: utils.serverTimestamp(),
          createdBy: utils.getSession('uid'),
        },
        { merge: true }
      );

      await utils.writeLog({ dataId: dateId, action: '保存' });
      utils.hideSpinner();

      await utils.showDialog('保存しました', true);
      await refreshBlueNoteItem(dateId);
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
      utils.hideSpinner();

      await utils.showDialog('削除しました', true);
      await refreshBlueNoteItem(dateId);
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

  // ホームに戻る
  $('.back-link').on('click', () => {
    window.location.href = '../home/home.html';
  });
}

//===========================
// YouTube動画ID抽出
//===========================
function extractYouTubeId(input) {
  if (!input) return null;
  const str = String(input).trim();
  if (!str) return null;

  const reg =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)?([\w\-]{11})/;
  const match = str.match(reg);
  return match ? match[1] : null;
}
