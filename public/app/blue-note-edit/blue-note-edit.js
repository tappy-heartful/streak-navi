import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    // 画面ごとのパンくずをセット
    await utils.initDisplay();
    utils.renderBreadcrumb([{ title: '今日の一曲' }]);
    await setupPage();
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
// ページ設定（タブ対応）
//===========================
async function setupPage() {
  // タブを作成
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

  const $tabsContainer = $('#month-tabs');

  const currentMonth =
    utils.globalGetParamMonth || String(new Date().getMonth() + 1);

  months.forEach((name, index) => {
    const month = String(index + 1);
    const $li = $(`<li>${name}</li>`);

    if (month === currentMonth) $li.addClass('active');

    $li.on('click', async () => {
      utils.showSpinner();
      $('#month-tabs li').removeClass('active');
      $li.addClass('active');
      await loadBlueNotes(month);
      utils.hideSpinner();
    });

    $tabsContainer.safeAppend($li);
  });

  // 初期表示
  await loadBlueNotes(Number(currentMonth));
}

//===========================
// 選択月の今日の一曲読み込み（改善版）
//===========================
let currentLoadId = 0;

async function loadBlueNotes(month) {
  // プレイリストリンク
  const watchIds = await getOrderedYouTubeIds(
    String(month).padStart(2, '0') + '01'
  );

  $('#playlist-link-blue-note')
    .attr(
      'href',
      `https://www.youtube.com/watch_videos?video_ids=${watchIds.join(',')}`
    )
    .safeHTML(`<i class="fa-brands fa-youtube"></i> ${month}月のプレイリスト`);

  const loadId = ++currentLoadId;
  const year = 2024;
  const daysInMonth = new Date(year, Number(month), 0).getDate();

  $('#month').text(month + '月');

  const $container = $('#blue-note-container').empty();

  // 🔽 blueNotes を一括取得
  const notesSnap = await utils.getDocs(
    utils.collection(utils.db, 'blueNotes')
  );
  const notesMap = {};
  notesSnap.docs.forEach((doc) => {
    notesMap[doc.id] = doc.data();
  });

  // 🔽 user の displayName をキャッシュする辞書
  const userCache = {};

  for (let day = 1; day <= daysInMonth; day++) {
    if (loadId !== currentLoadId) return; // 中断チェック

    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(month).padStart(2, '0');
    const dateId = `${monthStr}${dayStr}`;
    const displayDay = String(day);

    const data = notesMap[dateId];

    if (data) {
      // 削除ボタン表示判定
      const showDelete =
        data.createdBy === utils.getSession('uid') ||
        utils.getSession('isBlueNoteAdmin') === utils.globalStrTrue;

      const videoUrl = data.youtubeId
        ? `https://youtu.be/${data.youtubeId}`
        : '';

      // 🔽 displayName をキャッシュ取得
      let displayName = '';
      if (data.createdBy) {
        if (userCache[data.createdBy] === undefined) {
          try {
            const userDoc = await utils.getDoc(
              utils.doc(utils.db, 'users', data.createdBy)
            );
            userCache[data.createdBy] = userDoc.exists()
              ? userDoc.data().displayName || ''
              : '';
          } catch (e) {
            console.warn('ユーザー名取得に失敗:', e);
            userCache[data.createdBy] = '';
          }
        }
        displayName = userCache[data.createdBy];
      }

      $container.safeAppend(`
        <div class="form-group blue-note-item" data-date="${dateId}">
          <label class="day-label">${displayDay}日</label>
          <span class="label-value title-value">
            ${
              data.youtubeId
                ? `<a href="${videoUrl}" class="youtube-link" 
                      data-video-url="${videoUrl}" 
                      data-video-title="${data.title}" 
                      data-created-by="${displayName}">
                    <i class="fa-brands fa-youtube"></i>${data.title}</a>`
                : data.title || ''
            }
          </span>
          <button class="delete-button" style="display: ${
            showDelete ? 'inline-block' : 'none'
          };">削除</button>
        </div>
      `);
    } else {
      $container.safeAppend(`
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

    const videoUrl = data.youtubeId ? `https://youtu.be/${data.youtubeId}` : '';

    const $newItem = $(`
      <div class="form-group blue-note-item" data-date="${dateId}">
        <label class="day-label">${displayDay}日</label>
        <span class="label-value title-value">
          ${
            data.youtubeId
              ? `<a href="${videoUrl}" class="youtube-link" data-video-url="${videoUrl}" data-video-title="${data.title}">
                <i class="fa-brands fa-youtube"></i>${data.title}</a>`
              : data.title || ''
          }
        </span>
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
    const dateId = $item.attr('data-date');
    const $titleField = $item.find('.title-input');
    const $urlField = $item.find('.url-input');
    const title = $titleField.val().trim();
    const youtubeUrl = $urlField.val().trim();

    // 🔹 エラー表示用領域を作る（itemの直下）
    let $errorContainer = $item.find('.error-container');
    if ($errorContainer.length === 0) {
      $errorContainer = $('<div class="error-container"></div>');
      $item.safeAppend($errorContainer);
    }
    $errorContainer.empty();

    let hasError = false;
    if (!title) {
      $errorContainer.safeAppend(
        '<div class="error-message">タイトルを入力してください</div>'
      );
      hasError = true;
    }
    if (!youtubeUrl) {
      $errorContainer.safeAppend(
        '<div class="error-message">URLを入力してください</div>'
      );
      hasError = true;
    }
    if (hasError) return;

    const videoId = utils.extractYouTubeId(youtubeUrl);
    if (!videoId) {
      $errorContainer.safeAppend(
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
        $errorContainer.safeAppend(
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
          title: title,
          youtubeId: videoId,
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
    const dateId = $item.attr('data-date');

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

  // youtubeリンク
  $(document).on('click', '.youtube-link', async function (e) {
    e.preventDefault();
    utils.showSpinner();

    const title = $(this).attr('data-video-title') || '参考音源';
    const currentDateId = $(this).closest('.blue-note-item').attr('data-date');

    // 並び替えたYouTubeIDリストを取得
    const youtubeIds = await getOrderedYouTubeIds(currentDateId);

    // HTML生成
    const html = utils.buildYouTubeHtml(youtubeIds);

    utils.hideSpinner();
    await utils.showModal(title, html);
  });

  // ホームに戻る
  $('.back-link').on('click', () => {
    window.location.href = '../home/home.html';
  });
}

// 今表示中の動画IDを先頭にして、日付順に後続を並べ、最後に最初に戻る形で配列を作る
async function getOrderedYouTubeIds(currentDateId) {
  const blueNotesSnap = await utils.getDocs(
    utils.collection(utils.db, 'blueNotes')
  );

  // 日付順に並べる
  const sortedNotes = blueNotesSnap.docs
    .map((doc) => ({ dateId: doc.id, data: doc.data() }))
    .sort((a, b) => a.dateId.localeCompare(b.dateId));

  const ids = sortedNotes.map((note) => note.data.youtubeId).filter(Boolean);

  if (ids.length === 0) return [];

  // 最短の未来 (currentDateId 以上) を探す
  let pivotIndex = sortedNotes.findIndex((n) => n.dateId >= currentDateId);

  // なければ最初に戻す
  if (pivotIndex === -1) pivotIndex = 0;

  // youtubeId の位置に合わせる
  // (dateId はあるけど youtubeId が空の可能性を考慮)
  while (
    pivotIndex < sortedNotes.length &&
    !sortedNotes[pivotIndex].data.youtubeId
  ) {
    pivotIndex++;
  }
  if (pivotIndex >= sortedNotes.length) pivotIndex = 0;

  // youtubeId の配列を回転
  const rotated = ids.slice(pivotIndex).concat(ids.slice(0, pivotIndex));

  return rotated;
}
