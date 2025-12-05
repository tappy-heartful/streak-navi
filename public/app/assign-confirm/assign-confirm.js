import * as utils from '../common/functions.js';

// 譜面（scores）とセクション（sections）のキャッシュ
let scoresCache = {};
// allPartNames はタブ表示のため廃止し、sectionGroupsに集約
let sectionGroups = {}; // { sectionName: { partNames: ['part1', 'part2', ...] } }
// sectionIdsは不要になるため削除

// グローバル変数として譜割りデータを保持
let globalAssignsData = {}; // { songId: { partName: assignValue } }
let globalEventData = {};
let sectionsCache = {}; // セクション名取得用として残す

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    // 画面ごとのパンくずをセット
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
    });
    // エラーメッセージを表示してスピナーを非表示
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
 * scoresのinstrumentConfigではなく、イベントのinstrumentConfigからパート名を構築する
 * @param {Object} eventData - イベントデータ
 * @returns {Promise<void>}
 */
async function prefetchData(eventData) {
  const scoreIdsToFetch = new Set();
  const sectionIdsToFetch = new Set();

  // 1. setlist内のscoreIdをすべて収集
  eventData.setlist.forEach((group) => {
    group.songIds.forEach((id) => scoreIdsToFetch.add(id));
  });

  // 2. scoresデータをキャッシュ (曲名取得のため)
  if (scoreIdsToFetch.size > 0) {
    const scorePromises = Array.from(scoreIdsToFetch).map(async (scoreId) => {
      const docRef = utils.doc(utils.db, 'scores', scoreId);
      const snap = await utils.getWrapDoc(docRef);
      if (snap.exists()) {
        scoresCache[scoreId] = snap.data();
      }
    });
    await Promise.all(scorePromises);
  }

  // 3. eventData.instrumentConfigからsectionsCacheとsectionGroupsを構築 (メイン修正箇所)
  if (eventData.instrumentConfig) {
    // instrumentConfigのキー（sectionsのdoc.id）を収集
    Object.keys(eventData.instrumentConfig).forEach((sectionId) => {
      sectionIdsToFetch.add(sectionId);
    });
  }

  // 4. sectionsデータをキャッシュ (セクション名取得のため)
  if (sectionIdsToFetch.size > 0) {
    const sectionPromises = Array.from(sectionIdsToFetch).map(
      async (sectionId) => {
        const docRef = utils.doc(utils.db, 'sections', sectionId);
        const snap = await utils.getWrapDoc(docRef);
        if (snap.exists()) {
          sectionsCache[sectionId] = snap.data();
        }
      }
    );
    await Promise.all(sectionPromises);
  }

  // 5. sectionGroupsを構築
  if (eventData.instrumentConfig) {
    Object.keys(eventData.instrumentConfig).forEach((sectionId) => {
      const sectionData = sectionsCache[sectionId];
      if (!sectionData) return;

      const sectionName = sectionData.name_decoded;

      // instrumentConfig[sectionId]はパート設定の配列。配列の順番を維持してpartNameを取得する
      const partNames = eventData.instrumentConfig[sectionId]
        .map((config) => config.partName_decoded)
        .filter((partName) => partName); // partNameが空でないもののみをフィルタリング

      // セクション名（タブ名）をキーとして、パート名リストを保存
      if (!sectionGroups[sectionName]) {
        sectionGroups[sectionName] = { partNames: [] };
      }
      // パート名は配列の順番通りに格納する
      sectionGroups[sectionName].partNames = partNames;
    });
  }

  // ⚠️ パート名のソートは行わない (instrumentConfigの配列順を維持するため)
}

//////////////////////////////////
// 2. メインレンダリング処理
//////////////////////////////////

async function renderAssignConfirm() {
  const eventId = utils.globalGetParamEventId;
  if (!eventId) {
    throw new Error('eventIdが指定されていません。');
  }

  const eventSnap = await utils.getWrapDoc(
    utils.doc(utils.db, 'events', eventId)
  );
  if (!eventSnap.exists()) {
    throw new Error('イベントが見つかりません：' + eventId);
  }
  globalEventData = eventSnap.data();

  $('#event-date').text(
    utils.getDayOfWeek(globalEventData.date_decoded) || '日付未定'
  );
  $('#event-title').text(globalEventData.title_decoded || '');

  $('#assign-edit-button').on('click', () => {
    window.location.href = `../assign-edit/assign-edit.html?eventId=${eventId}`;
  });

  if (!globalEventData.setlist || globalEventData.setlist.length === 0) {
    $('#no-assign-message')
      .removeClass('hidden')
      .text('セットリストが設定されていません。');
    return;
  }

  await prefetchData(globalEventData);

  if (Object.keys(sectionGroups).length === 0) {
    $('#no-assign-message')
      .removeClass('hidden')
      .text('イベントに楽器パートが設定されていません。');
    return;
  }

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
    // assignValueがない、または空文字列の場合は 'ー' として扱う
    const assignValue = data.assignValue_decoded || 'ー';

    if (!assignsData[songId]) {
      assignsData[songId] = {};
    }
    assignsData[songId][partName] = assignValue;
  });
  globalAssignsData = assignsData;

  // 6. タブとコンテンツ、小計の生成
  renderTabsAndContent();
}

//////////////////////////////////
// 3. テーブル描画ヘルパー (タブ対応)
//////////////////////////////////

/**
 * タブとタブコンテンツのコンテナを生成し、utils.getSession('sectionId')に基づいて初期タブを選択する
 */
function renderTabsAndContent() {
  const $wrapper = $('#assign-table-wrapper').empty();
  const $tabButtons = $('<div id="assign-tabs" class="tab-buttons"></div>');
  const $tabContents = $('<div id="tab-contents" class="tab-contents"></div>');

  // 新しい仕様ではsectionIdではなくsectionNameをキーとして扱うため、
  // セッションのキーを一時的に使わず、最初のセクションをデフォルトとする
  const defaultSectionName = Object.keys(sectionGroups)[0];
  const targetSectionName = defaultSectionName; // 初期表示は常に最初のセクション

  Object.keys(sectionGroups).forEach((sectionName, index) => {
    const tabId = `tab-${index}`;
    const isActive = sectionName === targetSectionName ? 'active' : '';

    // タブボタン
    $tabButtons.append(`
            <button class="tab-button ${isActive}" data-target="${tabId}" data-section-name="${sectionName}">
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
  });

  $wrapper.append($tabButtons).append($tabContents);

  // 各タブのテーブルを個別に描画
  Object.keys(sectionGroups).forEach((sectionName, index) => {
    const partNamesForTab = sectionGroups[sectionName].partNames;
    renderTableHeadersAndBody(index, sectionName, partNamesForTab);
  });

  // タブ切り替えのイベント設定
  $('#assign-tabs')
    .on('click', '.tab-button', function () {
      const targetId = $(this).data('target');
      // ボタンのアクティブ状態を切り替え
      $('.tab-button').removeClass('active');
      $(this).addClass('active');

      // コンテンツの表示を切り替え
      $('.tab-content').removeClass('active');
      $(`#${targetId}`).addClass('active');

      // ★ 小計表示の更新
      renderAssignSummary($(this).data('section-name'));
    })
    .find('.tab-button.active')
    .trigger('click'); // 初期表示のためにアクティブなタブをトリガー

  // ★ 最初の小計表示をセット
  renderAssignSummary(targetSectionName);
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
  // partNamesForTab は既にinstrumentConfigの配列順に並んでいる
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
                <td colspan="${colspan}">${groupTitle}</td>
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
        // assignsDataはpartNameをキーに持っているので、そのまま参照
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

//////////////////////////////////
// 4. 小計計算と描画 (追加)
//////////////////////////////////

/**
 * 譜割りデータを集計し、セクションごとのassignValue（担当者）別カウントを生成する
 * @returns {Object} { sectionName: { assignValue: count, ... }, ... }
 */
function calculateAssignSummary() {
  const summary = {};

  // 全セクションをループ
  Object.keys(sectionGroups).forEach((sectionName) => {
    const partNames = sectionGroups[sectionName].partNames;
    const assignCounts = {}; // { assignValue: count }

    // 全曲をループ
    Object.keys(globalAssignsData).forEach((songId) => {
      const songAssigns = globalAssignsData[songId];

      // そのセクションの全パートをループ
      partNames.forEach((partName) => {
        // 割り当て値を取得 ('ー' は未割り当て)
        const assignValue = songAssigns ? songAssigns[partName] || 'ー' : 'ー';

        // カウントをインクリメント
        if (assignValue !== 'ー') {
          assignCounts[assignValue] = (assignCounts[assignValue] || 0) + 1;
        }
      });
    });

    // 0件の担当者は除外して保存
    const filteredCounts = Object.keys(assignCounts).reduce((acc, key) => {
      if (assignCounts[key] > 0) {
        acc[key] = assignCounts[key];
      }
      return acc;
    }, {});

    summary[sectionName] = filteredCounts;
  });

  return summary;
}

/**
 * 小計データを表示エリアに描画する
 * @param {string} activeSectionName - 現在アクティブなセクション名
 */
function renderAssignSummary(activeSectionName) {
  const $summaryWrapper = $('#assign-summary-wrapper');
  $summaryWrapper.find('.summary-content').remove(); // 既存のコンテンツをクリア

  const summaryData = calculateAssignSummary();
  const summaryForActiveSection = summaryData[activeSectionName];

  if (
    !summaryForActiveSection ||
    Object.keys(summaryForActiveSection).length === 0
  ) {
    // 割り当てがない場合は非表示
    $summaryWrapper.addClass('hidden');
    return;
  }

  $summaryWrapper.removeClass('hidden');

  let html = `<div class="summary-content">`;
  html += `<div class="summary-section">`;
  html += `<h3>${activeSectionName}</h3>`;
  html += `<ul class="summary-list">`;

  // 担当者名でソートして表示
  const sortedAssignValues = Object.keys(summaryForActiveSection).sort();

  sortedAssignValues.forEach((assignValue) => {
    const count = summaryForActiveSection[assignValue];
    html += `<li class="summary-item">${assignValue}：<strong>${count}</strong></li>`;
  });

  html += `</ul></div></div>`;

  $summaryWrapper.append(html);
}
