import * as utils from '../common/functions.js';

// グローバルデータキャッシュ
let globalEventData = {}; // イベントデータ (instrumentConfig, setlistを含む)
let scoresCache = {}; // scoresデータ (曲名取得用)
let sectionsCache = {}; // sectionsデータ (セクション名取得用)
let usersCache = {}; // usersデータ (プルダウンの選択肢用)
let currentAssigns = {}; // 現在の割り当てデータ ({ songId: { partName: assignValue, ... }, ... })
let initialAssigns = {}; // 初期状態を保存 (クリア/復元用)

// ユーザーの演奏可能楽器IDリスト
let userInstrumentIds = [];
// パート情報 ({ sectionName: [{ partName: '...', instrumentId: '...' }, ...], ...})
let sectionGroups = {};

//===========================
// 初期化
//===========================
$(document).ready(async function () {
  const eventId = utils.globalGetParamEventId;
  if (!eventId) {
    // eventIdがない場合は一覧へ戻すなど
    window.location.href = '../assign-list/assign-list.html';
    return;
  }

  try {
    await utils.initDisplay();

    // ユーザーの演奏可能楽器IDを取得
    const sessionInstrumentIds = utils.getSession('instrumentIds');
    if (Array.isArray(sessionInstrumentIds)) {
      userInstrumentIds = sessionInstrumentIds;
    } else if (sessionInstrumentIds) {
      // カンマ区切り文字列の場合の互換性維持
      userInstrumentIds = sessionInstrumentIds
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id);
    }

    // 画面ごとのパンくずをセット
    utils.renderBreadcrumb([
      { title: '譜割り一覧', url: '../assign-list/assign-list.html' },
      {
        title: '譜割り確認',
        url: `../assign-confirm/assign-confirm.html?eventId=${eventId}`,
      },
      { title: '譜割り編集' },
    ]);

    await setupPage(eventId);
    setupEventHandlers(eventId);
  } catch (e) {
    // ログ登録
    await utils.writeLog({
      dataId: eventId,
      action: '譜割り編集 初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
    $('#assign-table-wrapper').html(
      '<p class="error-message">データの読み込み中にエラーが発生しました。</p>'
    );
  } finally {
    utils.hideSpinner();
  }
});

//===========================
// ページ設定とデータ取得
//===========================
async function setupPage(eventId) {
  // const pageTitle = $('#page-title'); // 削除
  // const title = $('#title'); // 削除

  // pageTitle.text('譜割り編集'); // 削除
  // title.text('譜割り編集'); // 削除

  // 全データのプリフェッチ
  await prefetchAllData(eventId);

  // 自分のパートのみが表示されるため、空の場合のエラーメッセージを調整
  if (Object.keys(sectionGroups).length === 0) {
    $('#no-assign-message')
      .removeClass('hidden')
      .text('このイベントには、あなたの担当楽器のパートが設定されていません。');
    return;
  }

  // イベント基本情報の表示
  $('#event-date').text(
    utils.getDayOfWeek(globalEventData.date_decoded) || '日付未定'
  );
  $('#event-title').text(globalEventData.title_decoded || 'タイトル未定');

  // テーブルの描画
  renderAssignTable();

  // 初期状態を保存
  initialAssigns = JSON.parse(JSON.stringify(currentAssigns));
}

//===========================
// データの事前取得
//===========================
async function prefetchAllData(eventId) {
  const eventRef = utils.doc(utils.db, 'events', eventId);
  const eventSnap = await utils.getWrapDoc(eventRef);
  if (!eventSnap.exists())
    throw new Error('イベントが見つかりません: ' + eventId);
  globalEventData = eventSnap.data();

  const scoreIdsToFetch = new Set();
  const sectionIdsToFetch = new Set();

  // 1. setlist内のscoreIdとevent.instrumentConfig内のsectionIdを収集
  globalEventData.setlist.forEach((group) => {
    group.songIds.forEach((id) => scoreIdsToFetch.add(id));
  });

  if (globalEventData.instrumentConfig) {
    Object.keys(globalEventData.instrumentConfig).forEach((sectionId) => {
      sectionIdsToFetch.add(sectionId);
    });
  }

  // 2. scores, sections データを並列取得
  const promises = [
    ...Array.from(scoreIdsToFetch).map((id) =>
      utils.getWrapDoc(utils.doc(utils.db, 'scores', id)).then((snap) => {
        if (snap.exists()) scoresCache[id] = snap.data();
      })
    ),
    ...Array.from(sectionIdsToFetch).map((id) =>
      utils.getWrapDoc(utils.doc(utils.db, 'sections', id)).then((snap) => {
        if (snap.exists()) sectionsCache[id] = snap.data();
      })
    ),
  ];

  await Promise.all(promises);

  // 3. usersデータを取得 (全員)
  const usersSnap = await utils.getWrapDocs(
    utils.collection(utils.db, 'users')
  );
  usersSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    // abbreviation_decodedも取得し、プルダウンの表示名として使用
    usersCache[docSnap.id] = {
      name: data.displayName_decoded, // valueとして使用 (保存時のキー)
      abbreviation: data.abbreviation_decoded || data.displayName_decoded, // プルダウン表示名として使用
      instrumentIds: Array.isArray(data.instrumentIds)
        ? data.instrumentIds
        : [],
    };
  });

  // 4. assignsデータを取得 (このイベントの全譜割り)
  const assignsSnap = await utils.getWrapDocs(
    utils.query(
      utils.collection(utils.db, 'assigns'),
      utils.where('eventId', '==', eventId)
    )
  );
  assignsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    if (!currentAssigns[data.songId]) {
      currentAssigns[data.songId] = {};
    }
    // assignsのIDは保存しない (新規登録/更新時に再構築するため)
    currentAssigns[data.songId][data.partName_decoded] =
      data.assignValue_decoded || '';
  });

  // 5. sectionGroupsを構築
  buildSectionGroups(globalEventData.instrumentConfig);
}

//===========================
// セクショングループの構築
//===========================
function buildSectionGroups(instrumentConfig) {
  if (!instrumentConfig) return;

  Object.keys(instrumentConfig).forEach((sectionId) => {
    const sectionData = sectionsCache[sectionId];
    if (!sectionData) return;

    const sectionName = sectionData.name_decoded;

    // 自分のパート（担当楽器）のみをフィルタリングして格納する
    const filteredParts = instrumentConfig[sectionId]
      .filter((config) => {
        // ユーザーの演奏可能楽器ID (userInstrumentIds) に、このパートの楽器ID (config.instrumentId) が含まれているかチェック
        return userInstrumentIds.includes(config.instrumentId);
      })
      .map((config) => ({
        partName: config.partName_decoded,
        instrumentId: config.instrumentId,
      }));

    if (filteredParts.length > 0) {
      // 該当するパートがあればセクションとして追加
      if (!sectionGroups[sectionName]) {
        sectionGroups[sectionName] = [];
      }
      // パート設定の配列。配列の順番を維持して情報（partNameとinstrumentId）を格納
      sectionGroups[sectionName] = filteredParts;
    }
  });
}

//===========================
// テーブル描画
//===========================
function renderAssignTable() {
  const $wrapper = $('#assign-table-wrapper').empty();
  const $table = $(
    `<table class="assign-edit-table"><thead><tr></tr></thead><tbody></tbody></table>`
  );
  const $thead = $table.find('thead'); // thead全体を取得

  // 1. ヘッダー (セクション名, パート名) の描画
  const sectionNames = Object.keys(sectionGroups);
  const totalParts = sectionNames.reduce(
    (sum, name) => sum + sectionGroups[name].length,
    0
  );

  if (totalParts === 0) return;

  // 1-1. 列ラベル1行目: 曲名 + セクション名
  const $firstRow = $('<tr></tr>');

  // 曲名ヘッダーは2行をまたぐ (rowspan="2")
  $firstRow.append('<th rowspan="2" class="song-header">曲名</th>');

  sectionNames.forEach((name) => {
    const partCount = sectionGroups[name].length;
    if (partCount > 0) {
      // セクション名ヘッダーは1行のみ (colspanで複数のパートを束ねる)
      $firstRow.append(
        `<th colspan="${partCount}" class="section-name-header">${name}</th>`
      );
    }
  });
  $thead.append($firstRow); // 1行目をtheadに追加

  // 1-2. 列ラベル2行目: パート名
  const $secondRow = $('<tr></tr>');
  // 曲名ヘッダーのスペーサーは不要。代わりにパート名セルのみを配置。
  // ここにセルを追加すると、曲名ヘッダーの横にセルが並び始めるため、
  // 必要なのはパート名ヘッダーのみです。
  sectionNames.forEach((name) => {
    sectionGroups[name].forEach((part) => {
      $secondRow.append(`<th class="part-header-cell">${part.partName}</th>`);
    });
  });
  $thead.append($secondRow); // 2行目をtheadに追加

  const $tbody = $table.find('tbody');

  // 2. ボディ (曲、プルダウン) の描画
  globalEventData.setlist.forEach((group) => {
    const groupTitle = group.title_decoded || 'No Group Title';
    const colspan = totalParts + 1; // 曲名列 + パート列

    // グループタイトル行
    $tbody.append(`
            <tr class="group-title-row">
                <td colspan="${colspan}">${groupTitle}</td>
            </tr>
        `);

    // 曲の行
    group.songIds.forEach((songId) => {
      const score = scoresCache[songId];
      if (!score) return;

      const songAbbreviation =
        score.abbreviation_decoded || score.title_decoded || '曲名不明';
      // song-cellはCSSで左寄せに設定済み
      let rowHtml = `<tr data-song-id="${songId}">
                <td class="song-cell">${songAbbreviation}</td>`; // 曲名は左寄せ

      // 各パートのセル (プルダウン)
      sectionNames.forEach((sectionName) => {
        // sectionGroupsには既に自分の担当パートのみ含まれている
        sectionGroups[sectionName].forEach((part) => {
          const assignValue = currentAssigns[songId]
            ? currentAssigns[songId][part.partName]
            : '';

          // 自分のパートのみが表示されているため、常に編集可能なプルダウンを生成
          const selectHtml = buildUserSelect(part, assignValue);
          rowHtml += `<td class="assign-cell editable" data-part-name="${part.partName}" data-instrument-id="${part.instrumentId}">${selectHtml}</td>`;
        });
      });

      rowHtml += `</tr>`;
      $tbody.append(rowHtml);
    });
  });

  $wrapper.append($table);
}

/**
 * ユーザー選択用のプルダウンHTMLを生成する
 * @param {Object} part - パート情報 ({ partName, instrumentId })
 * @param {string} selectedValue - 現在選択されているユーザー名 (assignValue)
 * @returns {string} selectタグのHTML
 */
function buildUserSelect(part, selectedValue) {
  // 修正: 未割り当て → 未割
  let optionsHtml = '<option value="">未割</option>';

  // 該当楽器を演奏できるユーザーをフィルタリング
  const filteredUsers = Object.values(usersCache).filter((user) =>
    // user.instrumentIdsは配列であることを前提
    user.instrumentIds.includes(part.instrumentId)
  );

  // ソートはdisplayName (user.name) で行う
  filteredUsers.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  filteredUsers.forEach((user) => {
    const isSelected = user.name === selectedValue ? 'selected' : '';
    // オプションの表示名にはabbreviationを使用
    optionsHtml += `<option value="${user.name}" ${isSelected}>${user.abbreviation}</option>`;
  });

  return `<select class="assign-select">${optionsHtml}</select>`;
}

//===========================
// イベント登録
//===========================
function setupEventHandlers(eventId) {
  // 1. プルダウン変更時の処理
  $('#assign-table-wrapper').on('change', '.assign-select', function () {
    const $select = $(this);
    const songId = $select.closest('tr').data('song-id');
    const partName = $select.closest('td').data('part-name');
    const newValue = $select.val();

    if (!currentAssigns[songId]) {
      currentAssigns[songId] = {};
    }
    currentAssigns[songId][partName] = newValue;
  });

  // 2. 初期値に戻すボタン
  $('#clear-button').on('click', async () => {
    if (
      await utils.showDialog(
        '編集内容を初期値（データベースの値）に戻しますか？'
      )
    ) {
      restoreInitialState();
    }
  });

  // 3. 更新ボタン
  $('#save-button').on('click', async () => {
    if (!validateData()) {
      // ここでは必須チェックなどはないため、主に権限チェックなどを行う
      utils.showDialog('保存処理中に問題が発生しました。', true);
      return;
    }

    if (!(await utils.showDialog('譜割り内容を更新しますか？'))) return;

    utils.showSpinner();
    try {
      await saveAssigns(eventId);

      utils.hideSpinner();
      await utils.showDialog('譜割りを更新しました', true);
      // 確認画面へ遷移
      window.location.href = `../assign-confirm/assign-confirm.html?eventId=${eventId}`;
    } catch (e) {
      await utils.writeLog({
        dataId: eventId,
        action: '譜割り更新',
        status: 'error',
        errorDetail: { message: e.message, stack: e.stack },
      });
    } finally {
      utils.hideSpinner();
    }
  });

  // 4. 戻るリンク
  $(document).on(
    'click',
    '.back-link',
    () =>
      (window.location.href = `../assign-confirm/assign-confirm.html?eventId=${eventId}`)
  );
}

//===========================
// データ登録 (assignsコレクションの更新・新規追加)
//===========================
async function saveAssigns(eventId) {
  // 1. 全ての更新/新規登録/削除が必要なassignsドキュメントを収集
  const assignmentsToProcess = [];

  for (const songId in currentAssigns) {
    for (const partName in currentAssigns[songId]) {
      const newValue = currentAssigns[songId][partName];
      const initialValue = initialAssigns[songId]
        ? initialAssigns[songId][partName]
        : '';

      // 値が変更された、または新規に割り当てられた場合のみ処理対象とする
      if (newValue !== initialValue) {
        // 新しい割り当て値が空欄（未割り当て）の場合、ドキュメントを削除する必要がある
        if (newValue === '') {
          // 削除対象
          assignmentsToProcess.push({
            type: 'delete',
            eventId,
            songId,
            partName,
          });
        } else {
          // 更新または新規作成対象
          assignmentsToProcess.push({
            type: 'set', // setDoc (merge) を使用して、あれば更新、なければ新規作成
            data: {
              eventId,
              songId,
              partName,
              assignValue: newValue, // 割り当てられたユーザー名
              createdAt: utils.serverTimestamp(),
              // 更新の場合、updatedAtも追加可能だが、ここではシンプルにcreatedAtのみで対応
            },
          });
        }
      }
    }
  }

  if (assignmentsToProcess.length === 0) {
    console.log('更新すべき譜割りはありませんでした。');
    return;
  }

  // 2. 処理を実行
  let successCount = 0;

  // assignsドキュメントIDを生成
  const generateAssignId = (eventId, songId, partName) =>
    `${eventId}_${songId}_${partName.replace(/[^a-zA-Z0-9]/g, '')}`;

  for (const item of assignmentsToProcess) {
    const assignId = generateAssignId(item.eventId, item.songId, item.partName);
    const assignRef = utils.doc(utils.db, 'assigns', assignId);

    try {
      if (item.type === 'set') {
        // setDocで上書きまたは新規作成
        await utils.setDoc(assignRef, item.data, { merge: true });
      } else if (item.type === 'delete') {
        // deleteDocで削除
        await utils.deleteDoc(assignRef);
      }
      successCount++;
    } catch (e) {
      console.error(`譜割り処理失敗: ID=${assignId}, Type=${item.type}`, e);
      await utils.writeLog({
        dataId: assignId,
        action: item.type === 'set' ? '譜割り登録/更新' : '譜割り削除',
        status: 'error',
        errorDetail: { message: e.message, stack: e.stack },
      });
      throw new Error(
        '譜割り更新中にエラーが発生しました。詳細はログを確認してください。'
      );
    }
  }

  console.log(`譜割り更新処理完了: ${successCount}件成功`);
}

//===========================
// 入力チェック (今回は簡易版)
//===========================
function validateData() {
  // 譜割り編集画面では、主に権限チェックやデータが読み込まれているかの確認
  if (Object.keys(globalEventData).length === 0) {
    return false;
  }
  return true;
}

//===========================
// 初期状態復元
//===========================
function restoreInitialState() {
  // currentAssignsを初期状態に戻す
  currentAssigns = JSON.parse(JSON.stringify(initialAssigns));

  // テーブルを再描画してプルダウンの値をリセット
  renderAssignTable();

  utils.clearErrors();
}
