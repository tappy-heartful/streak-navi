import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    const callId = utils.globalGetParamCallId;
    const uid = utils.getSession('uid');

    await utils.initDisplay();

    // 回答データがあるか確認
    let mode = 'new';
    let answerData = await fetchAnswerData(callId, uid);
    if (answerData) mode = 'edit';

    setupPageMode(mode);

    // 募集データ取得
    const callData = await fetchCallData(callId);

    // 回答データがなければ空
    answerData = answerData || {};

    renderCall(callData, answerData);

    setupEventHandlers(mode, callId, uid, callData);
  } catch (e) {
    await utils.writeLog({
      dataId: utils.globalGetParamCallId,
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

function setupPageMode(mode) {
  const title = mode === 'edit' ? '回答修正' : '回答登録';
  const buttonText = mode === 'edit' ? '回答を修正する' : '回答を登録する';
  $('#title').text(title);
  $('#page-title').text(title);
  $('#answer-submit').text(buttonText);
}

async function fetchCallData(callId) {
  const docRef = utils.doc(utils.db, 'calls', callId);
  const callDoc = await utils.getDoc(docRef);
  if (!callDoc.exists()) throw new Error('募集が見つかりません：' + callId);
  return callDoc.data();
}

async function fetchAnswerData(callId, uid) {
  const ansDoc = await utils.getDoc(
    utils.doc(utils.db, 'callAnswers', `${callId}_${uid}`)
  );
  if (ansDoc.exists()) {
    return ansDoc.data().answers;
  }
  return null;
}

function renderCall(callData, answerData = {}) {
  $('#call-title').text(callData.title);
  $('#call-description').text(callData.description);

  const container = $('#call-items-container').empty();

  (callData.items || []).forEach((genre) => {
    const genreId = utils.generateId();

    const songsHtml = (answerData[genre] || [])
      .map((song, idx) => buildSongForm(genreId, song, idx))
      .join('');

    const genreHtml = `
      <div class="genre-card" data-genre="${genre}" id="${genreId}">
        <div class="genre-title">🎵 ${genre}</div>
        <div class="songs-container">${songsHtml}</div>
        <button class="add-song" data-genre-id="${genreId}">＋ 曲を追加</button>
      </div>
    `;
    container.append(genreHtml);
  });
}

function buildSongForm(genreId, song = {}, idx = 0) {
  return `
    <div class="song-item">
      <input type="text" placeholder="曲名 *" class="song-title" value="${
        song.title || ''
      }">
      <input type="text" placeholder="参考音源URL" class="song-url" value="${
        song.url || ''
      }">
      <select class="song-scorestatus"></select>
      <input type="text" placeholder="購入先リンク" class="song-purchase" value="${
        song.purchase || ''
      }">
      <text placeholder="備考" class="song-note">${song.note || ''}</text>
      <button class="remove-song">× 曲を取下</button>
    </div>
  `;
}

function setupEventHandlers(mode, callId, uid, callData) {
  // 曲追加
  $(document).on('click', '.add-song', function () {
    const genreId = $(this).data('genre-id');
    $(`#${genreId} .songs-container`).append(buildSongForm(genreId));
  });

  // 曲削除
  $(document).on('click', '.remove-song', function () {
    $(this).closest('.song-item').remove();
  });

  // 保存
  $('#answer-submit').on('click', async function () {
    const answers = {};
    let hasError = false;

    $('.genre-card').each(function () {
      const genre = $(this).data('genre');
      const songs = [];

      $(this)
        .find('.song-item')
        .each(function () {
          const title = $(this).find('.song-title').val().trim();
          const url = $(this).find('.song-url').val().trim();
          const scorestatus = $(this).find('.song-scorestatus').val();
          const purchase = $(this).find('.song-purchase').val().trim();
          const note = $(this).find('.song-note').val().trim();

          if (!title) {
            hasError = true;
            $(this)
              .find('.song-title')
              .after(`<div class="error-message">曲名は必須です。</div>`);
          }

          songs.push({ title, url, scorestatus, purchase, note });
        });

      answers[genre] = songs;
    });

    if (hasError) {
      await utils.showDialog(`曲名を入力してください。`, true);
      return;
    }

    const confirmed = await utils.showDialog(
      `回答を${mode === 'edit' ? '修正' : '登録'}しますか？`
    );
    if (!confirmed) return;

    try {
      utils.showSpinner();
      await utils.setDoc(
        utils.doc(utils.db, 'callAnswers', `${callId}_${uid}`),
        {
          callId,
          uid,
          answers,
          updatedAt: utils.serverTimestamp(),
        },
        { merge: true }
      );

      await utils.writeLog({
        dataId: utils.globalGetParamCallId,
        action: mode === 'edit' ? '修正' : '登録',
      });

      utils.hideSpinner();
      await utils.showDialog(
        `回答を${mode === 'edit' ? '修正' : '登録'}しました`,
        true
      );
      window.location.href =
        '../call-confirm/call-confirm.html?callId=' + callId;
    } catch (e) {
      await utils.writeLog({
        dataId: utils.globalGetParamCallId,
        action: mode === 'edit' ? '修正' : '登録',
        status: 'error',
        errorDetail: { message: e.message, stack: e.stack },
      });
    } finally {
      utils.hideSpinner();
    }
  });

  // 戻るリンク
  $(document).on('click', '.back-link', function () {
    window.location.href = '../call-confirm/call-confirm.html?callId=' + callId;
  });
}
//===========================
// Firestore から scorestatus をロードして <select> に反映
//===========================
async function loadScoreStatusOptions(selectEl) {
  try {
    const snapshot = await db.collection('scorestatus').get();
    selectEl.empty(); // 既存の選択肢をクリア

    // 初期値
    selectEl.append(`<option value="">選択してください</option>`);

    snapshot.forEach((doc) => {
      const data = doc.data();
      // 例: { name: "完成済み", value: "completed" }
      const option = `<option value="${doc.id}">${data.name}</option>`;
      selectEl.append(option);
    });
  } catch (err) {
    console.error('scorestatus のロードに失敗しました:', err);
  }
}
