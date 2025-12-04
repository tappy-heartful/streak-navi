import * as utils from '../common/functions.js';

// 譜面（scores）とセクション（sections）のキャッシュ
let scoresCache = {};
let sectionsCache = {};
// allPartNames はタブ表示のため廃止し、sectionGroupsに集約
let sectionGroups = {}; // { sectionName: { sectionIds: [id1, id2, ...], partNames: ['part1', 'part2', ...] } }

// グローバル変数として譜割りデータを保持
let globalAssignsData = {};
let globalEventData = {};

$(document).ready(async function () {
  try {
    await utils.initDisplay(); // 画面ごとのパンくずをセット
    utils.renderBreadcrumb([
      { title: '譜割り一覧', url: '../assign-list/assign-list.html' },
      { title: '譜割り確認' },
    ]);
    await renderAssignConfirm();
  } catch (e) {
    // ログ登録
    await utils.writeLog({
      dataId: utils.globalGetParamEventId,
      action: '譜割り確認 初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    }); // エラーメッセージを表示してスピナーを非表示
    $('#assign-table-wrapper').html(
      '<p class="error-message">データの読み込み中にエラーが発生しました。</p>'
    );
  } finally {
    // スピナー非表示
    utils.hideSpinner();
  }
});

//////////////////////////////////
// 1. データの事前取得とキャッシュ
//////////////////////////////////

/**
 * イベントの全曲に必要なscoresとsectionsのデータを事前にキャッシュし、sectionGroupsを構築する
 * @param {Object} eventData - イベントデータ
 * @returns {Promise<void>}
 */
async function prefetchData(eventData) {
  const scoreIdsToFetch = new Set();
  const sectionIdsToFetch = new Set(); // 譜面IDを抽出

  eventData.setlist.forEach((group) => {
    group.songIds.forEach((id) => scoreIdsToFetch.add(id));
  });

  if (scoreIdsToFetch.size === 0) return; // scoresデータを取得し、instrumentConfigからsectionIdを抽出

  const scorePromises = Array.from(scoreIdsToFetch).map(async (scoreId) => {
    const docRef = utils.doc(utils.db, 'scores', scoreId);
    const snap = await utils.getWrapDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      scoresCache[scoreId] = data; // 横軸ラベルに必要なsectionIdを抽出

      if (data.instrumentConfig) {
        Object.keys(data.instrumentConfig).forEach((sectionId) => {
          sectionIdsToFetch.add(sectionId);
        });
      }
    }
  });

  await Promise.all(scorePromises); // sectionsデータを取得

  const sectionPromises = Array.from(sectionIdsToFetch).map(
    async (sectionId) => {
      const docRef = utils.doc(utils.db, 'sections', sectionId);
      const snap = await utils.getWrapDoc(docRef);
      if (snap.exists()) {
        sectionsCache[sectionId] = snap.data();
      }
    }
  );

  await Promise.all(sectionPromises); // sectionGroupsを作成: { sectionName: { partNames: ['part1', ...], sectionIds: [...] } }

  Object.keys(sectionsCache).forEach((sectionId) => {
    const sectionName = sectionsCache[sectionId].name_decoded;
    if (!sectionGroups[sectionName]) {
      sectionGroups[sectionName] = {
        partNames: [],
        sectionIds: [],
      };
    }
    sectionGroups[sectionName].sectionIds.push(sectionId); // 該当セクションに属する全てのパート名を集約

    Object.values(scoresCache).forEach((score) => {
      if (score.instrumentConfig && score.instrumentConfig[sectionId]) {
        score.instrumentConfig[sectionId].forEach((config) => {
          const partName = config.partName_decoded;
          if (!sectionGroups[sectionName].partNames.includes(partName)) {
            sectionGroups[sectionName].partNames.push(partName);
          }
        });
      }
    });
  });

  // パート名はアルファベット順などでソートしておくと見やすい
  Object.keys(sectionGroups).forEach((name) => {
    sectionGroups[name].partNames.sort();
  });
}

//////////////////////////////////
// 2. メインレンダリング処理
//////////////////////////////////

async function renderAssignConfirm() {
  const eventId = utils.globalGetParamEventId;
  if (!eventId) {
    throw new Error('eventIdが指定されていません。');
  } // 1. イベントデータの取得

  const eventSnap = await utils.getWrapDoc(
    utils.doc(utils.db, 'events', eventId)
  );
  if (!eventSnap.exists()) {
    throw new Error('イベントが見つかりません：' + eventId);
  }
  globalEventData = eventSnap.data(); // 2. 基本情報の表示

  $('#event-date').text(
    utils.getDayOfWeek(globalEventData.date_decoded) || '日付未定'
  );
  $('#event-title').text(globalEventData.title_decoded || ''); // 3. 譜割り編集ボタンのリンク設定

  $('#assign-edit-button').on('click', () => {
    window.location.href = `../assign-edit/assign-edit.html?eventId=${eventId}`;
  });

  if (!globalEventData.setlist || globalEventData.setlist.length === 0) {
    $('#no-assign-message')
      .removeClass('hidden')
      .text('セットリストが設定されていません。');
    return;
  } // 4. 譜面・セクション・パート情報の事前取得とキャッシュ

  await prefetchData(globalEventData);

  if (Object.keys(sectionGroups).length === 0) {
    $('#no-assign-message')
      .removeClass('hidden')
      .text('セットリスト内の曲に楽器パートが設定されていません。');
    return;
  } // 5. 譜割りデータの一括取得

  const assignsSnap = await utils.getWrapDocs(
    utils.query(
      utils.collection(utils.db, 'assigns'),
      utils.where('eventId', '==', eventId)
    )
  );
  const assignsData = {}; // { songId: { partName: assignValue } }

  assignsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const partName = data.partName_decoded;
    const songId = data.songId;
    const assignValue = data.assignValue_decoded || 'ー'; // 割り当てがない場合はハイフン等

    if (!assignsData[songId]) {
      assignsData[songId] = {};
    }
    assignsData[songId][partName] = assignValue;
  });
  globalAssignsData = assignsData; // 6. タブとコンテンツの生成

  renderTabsAndContent();
}

//////////////////////////////////
// 3. テーブル描画ヘルパー (タブ対応)
//////////////////////////////////

/**
 * タブとタブコンテンツのコンテナを生成し、最初のタブを選択する
 */
function renderTabsAndContent() {
  const $wrapper = $('#assign-table-wrapper').empty();
  const $tabButtons = $('<div id="assign-tabs" class="tab-buttons"></div>');
  const $tabContents = $('<div id="tab-contents" class="tab-contents"></div>');

  let isFirst = true;

  Object.keys(sectionGroups).forEach((sectionName, index) => {
    const tabId = `tab-${index}`;
    const isActive = isFirst ? 'active' : '';

    // タブボタン
    $tabButtons.append(`
            <button class="tab-button ${isActive}" data-target="${tabId}">
                ${sectionName}
            </button>
        `);

    // タブコンテンツ（テーブルコンテナ）
    $tabContents.append(`
            <div id="${tabId}" class="tab-content ${isActive}">
                <div class="table-responsive">
                    <table id="assign-table-${index}" class="assign-table">
                        <thead>
                            <tr class="table-header-parts">
                                <th class="song-header">曲名</th>
                                </tr>
                        </thead>
                        <tbody>
                            </tbody>
                    </table>
                </div>
            </div>
        `);

    isFirst = false;
  });

  $wrapper.append($tabButtons).append($tabContents);

  // 各タブのテーブルを個別に描画
  Object.keys(sectionGroups).forEach((sectionName, index) => {
    const partNamesForTab = sectionGroups[sectionName].partNames;
    renderTableHeadersAndBody(index, sectionName, partNamesForTab);
  });

  // タブ切り替えのイベント設定
  $('#assign-tabs').on('click', '.tab-button', function () {
    const targetId = $(this).data('target');

    // ボタンのアクティブ状態を切り替え
    $('.tab-button').removeClass('active');
    $(this).addClass('active');

    // コンテンツの表示を切り替え
    $('.tab-content').removeClass('active');
    $(`#${targetId}`).addClass('active');
  });
}

/**
 * 個別のタブ（テーブル）のヘッダーとボディを描画する
 * @param {number} index - タブのインデックス
 * @param {string} sectionName - セクション名
 * @param {string[]} partNamesForTab - このタブで表示するパート名リスト
 */
function renderTableHeadersAndBody(index, sectionName, partNamesForTab) {
  const $table = $(`#assign-table-${index}`);
  const $headerRow = $table.find('.table-header-parts');
  const $tbody = $table.find('tbody');

  // ヘッダー描画 (パート名のみ)
  let htmlParts = '';
  partNamesForTab.forEach((partName) => {
    htmlParts += `<th class="part-header-cell">${partName}</th>`;
  });
  // 最初の曲名ヘッダーの後にパートヘッダーを挿入
  $headerRow.append(htmlParts);

  // ボディ描画 (縦軸と中身)
  globalEventData.setlist.forEach((group) => {
    // グループタイトル行 (縦軸ラベルのグループ名)
    const groupTitle = group.title_decoded || 'No Group Title';
    const colspan = partNamesForTab.length + 1; // 1は曲名列

    $tbody.append(`
            <tr class="group-title-row">
                <td colspan="${colspan}">${sectionName}: ${groupTitle}</td>
            </tr>
        `);

    // 曲の行
    group.songIds.forEach((songId) => {
      const score = scoresCache[songId];
      if (!score) return;

      const songAbbreviation =
        score.abbreviation_decoded || score.title_decoded || '曲名不明';

      let rowHtml = `<tr><td class="song-header">${songAbbreviation}</td>`; // 曲名 (scores.abbreviation)

      // 中身のセル
      partNamesForTab.forEach((partName) => {
        const assignValue = globalAssignsData[songId]
          ? globalAssignsData[songId][partName] || 'ー'
          : 'ー';

        rowHtml += `<td class="assign-cell">${assignValue}</td>`;
      });

      rowHtml += `</tr>`;
      $tbody.append(rowHtml);
    });
  });
}
