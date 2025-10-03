import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    const callId = utils.globalGetParamCallId;
    const uid = utils.getSession('uid');

    await utils.initDisplay();

    // 画面ごとのパンくずをセット
    utils.renderBreadcrumb([
      { title: '曲募集一覧', url: '../call-list/call-list.html' },
      {
        title: '曲募集確認',
        url:
          '../call-confirm/call-confirm.html?callId=' +
          utils.globalGetParamCallId,
      },
      { title: '回答登録/修正' },
    ]);

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

async function renderCall(callData, answerData = {}) {
  $('#call-title').text(callData.title);
  $('#call-description').text(callData.description);

  const container = $('#call-items-container').empty();

  for (const genre of callData.items || []) {
    const genreId = utils.generateId();

    // 各ジャンルの曲フォームを生成
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

    // 生成された select を初期化
    const $selects = $(`#${genreId} .song-scorestatus`);
    (answerData[genre] || []).forEach(async (song, idx) => {
      await populateScoreStatusSelect($selects.eq(idx), song.scorestatus);
    });
    // 新規の場合でも1件目があれば初期化
    if ((answerData[genre] || []).length === 0) {
      await populateScoreStatusSelect($selects.eq(0));
    }
  }
}

function buildSongForm(genreId, song = {}, idx = 0) {
  return `
    <div class="song-item">
      <input type="text" placeholder="曲名(必須)" class="song-title" value="${
        song.title || ''
      }">
      <input type="text" placeholder="参考音源URL(任意)" class="song-url" value="${
        song.url || ''
      }">
      <select class="song-scorestatus"></select>
      <input type="text" placeholder="購入先リンク(任意)" class="song-purchase" value="${
        song.purchase || ''
      }">
      <input type="text" placeholder="備考(任意)" class="song-note" value="${
        song.note || ''
      }">
      <button class="remove-song">× 削除</button>
    </div>
  `;
}

function setupEventHandlers(mode, callId, uid, callData) {
  // 曲追加
  $(document).on('click', '.add-song', async function () {
    const genreId = $(this).data('genre-id');
    const $container = $(`#${genreId} .songs-container`);
    const $newForm = $(buildSongForm(genreId));
    $container.append($newForm);

    // 追加した select を初期化
    const $select = $newForm.find('.song-scorestatus');
    await populateScoreStatusSelect($select);
  });

  // 曲削除
  $(document).on('click', '.remove-song', function () {
    $(this).closest('.song-item').remove();
  });

  // 保存
  $('#answer-submit').on('click', async function () {
    utils.clearErrors();
    const answers = {};
    let hasError = false;

    $('.genre-card').each(function () {
      const genre = $(this).data('genre');
      const songs = [];

      $(this)
        .find('.song-item')
        .each(function () {
          const $item = $(this);
          const title = $item.find('.song-title').val().trim();
          const url = $item.find('.song-url').val().trim();
          const scorestatus = $item.find('.song-scorestatus').val();
          const purchase = $item.find('.song-purchase').val().trim();
          const note = $item.find('.song-note').val().trim();

          // 曲名チェック
          if (!title) {
            hasError = true;
            utils.markError($item.find('.song-title'), '曲名は必須です。');
          }

          // 譜面状況チェック（value=0ならエラー）
          if (scorestatus === '0') {
            hasError = true;
            utils.markError(
              $item.find('.song-scorestatus'),
              '譜面状況を選択してください。'
            );
          }

          songs.push({ title, url, scorestatus, purchase, note });
        });

      answers[genre] = songs;
    });

    if (hasError) {
      await utils.showDialog(`入力内容を確認してください。`, true);
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
        { callId, uid, answers, updatedAt: utils.serverTimestamp() },
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
// プルダウン初期化ユーティリティ
//===========================
async function fetchScoreStatus() {
  const snap = await utils.getDocs(utils.collection(utils.db, 'scoreStatus'));
  if (snap.empty) {
    throw new Error('譜面ステータスが設定されていません');
  }
  // 並び順 = ドキュメントID昇順
  return snap.docs
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((doc) => ({
      id: doc.id, // 保存用
      name: doc.data().name, // 表示用
    }));
}

async function populateScoreStatusSelect($select, selectedValue = '') {
  const statusList = await fetchScoreStatus();
  $select.empty();

  // 🔽 最初に固定のダミー項目を追加（新規時はこれが選択されたまま）
  const defaultOption = $('<option>')
    .val(0)
    .text('譜面状況(必須)')
    .prop('selected', true);
  $select.append(defaultOption);

  statusList.forEach((status) => {
    const option = $('<option>')
      .val(status.id) // DB保存用の値
      .text(status.name); // UIに表示するラベル
    // 編集時：既存データに一致するものを選択
    if (selectedValue && selectedValue === status.id) {
      option.prop('selected', true);
    }
    $select.append(option);
  });
}
