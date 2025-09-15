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
  const month = utils.globalGetParamMonth;
  const year = 2024; // うるう年
  const daysInMonth = new Date(year, month, 0).getDate();

  $('#page-title').text(`Blue Note編集`);
  $('#month').text(String(Number(month)) + '月');

  const $container = $('#blue-note-container').empty();

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, '0'); // 内部用
    const dateId = `${month}${dayStr}`;
    const displayDay = String(day);

    $container.append(`
      <div class="form-group blue-note-item" data-date="${dateId}">
        <label>${displayDay}日</label>
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

//===========================
// イベント設定
//===========================
function setupEventHandlers() {
  $('#clear-button').on('click', async () => {
    if (await utils.showDialog('編集前に戻しますか？')) {
      restoreInitialState();
    }
  });

  $('#save-button').on('click', async () => {
    utils.showSpinner();

    if (!(await validateData())) {
      utils.hideSpinner();
      await utils.showDialog('入力内容を確認してください', true);
      return;
    }

    utils.hideSpinner();
    if (!(await utils.showDialog('保存しますか？'))) return;

    utils.showSpinner();
    try {
      const updates = [];

      $('.blue-note-item').each(function () {
        const dateId = $(this).data('date');
        const title = $(this).find('.title-input').val().trim();
        const youtubeUrl = $(this).find('.url-input').val().trim();

        if (title !== '' && youtubeUrl !== '') {
          updates.push(
            utils.setDoc(
              utils.doc(utils.db, 'blueNotes', dateId),
              {
                title: title,
                youtubeUrl: youtubeUrl,
                updatedAt: utils.serverTimestamp(),
              },
              { merge: true }
            )
          );
        }
      });

      if (updates.length > 0) {
        await Promise.all(updates);
      }

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

//===========================
// 初期状態管理
//===========================
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

//===========================
// 入力チェック
//===========================
async function validateData() {
  utils.clearErrors();
  let isValid = true;
  const errors = [];

  // Firestore既存データ取得
  const snapshot = await utils.getDocs(utils.collection(utils.db, 'blueNotes'));
  const existingTitles = new Set();
  const existingVideoIds = new Set();

  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.title) existingTitles.add(data.title.toLowerCase());
    if (data.youtubeUrl) {
      const vid = extractYouTubeId(data.youtubeUrl);
      if (vid) existingVideoIds.add(vid);
    }
  });

  $('.blue-note-item').each(function () {
    const $item = $(this);
    const title = $item.find('.title-input').val().trim();
    const url = $item.find('.url-input').val().trim();

    if (title === '' && url === '') return;

    if ((title === '' && url !== '') || (title !== '' && url === '')) {
      isValid = false;
      errors.push([$item, 'タイトルとURLは両方入力してください']);
      return;
    }

    const videoId = extractYouTubeId(url);
    if (!videoId) {
      isValid = false;
      errors.push([$item, 'YouTube動画のURLを入力してください']);
      return;
    }

    if (existingTitles.has(title.toLowerCase())) {
      isValid = false;
      errors.push([$item, 'このタイトルは既に登録されています']);
      return;
    }

    if (existingVideoIds.has(videoId)) {
      isValid = false;
      errors.push([$item, 'このYouTube動画は既に登録されています']);
      return;
    }
  });

  // エラー表示
  errors.forEach(([item, message]) => {
    utils.markError($(item), message);
  });

  return isValid;
}

//===========================
// YouTube動画ID抽出
//===========================
function extractYouTubeId(url) {
  const reg =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(reg);
  return match ? match[1] : null;
}
