import * as utils from '../common/functions.js';

// 譜面（scores）とセクション（sections）のキャッシュ
let scoresCache = {};
// allPartNames はタブ表示のため廃止し、sectionGroupsに集約
// ★ 修正: sectionIdも保持する構造に変更 { sectionId: { sectionName: '...', partNames: ['part1', 'part2', ...] } }
let sectionGroups = {};
// sectionIdsは不要になるため削除

// グローバル変数として譜割りデータを保持
// ★ 変更: partNameに対応するのは assignValue（担当者の名前）ではなく、users.doc.id（userId）とする
let globalAssignsData = {}; // { songId: { partName: userId } }
let globalEventData = {};
let sectionsCache = {}; // セクション名取得用として残す

// ★ 追加: ユーザーIDと略称のマッピングキャッシュ
let usersAbbreviationCache = {}; // { userId: abbreviation }

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

  // 3. eventData.instrumentConfigからsectionsCacheとsectionGroupsを構築
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
    // ★ 修正: sectionIdをキーとしてsectionGroupsを構築
    Object.keys(eventData.instrumentConfig).forEach((sectionId) => {
      const sectionData = sectionsCache[sectionId];
      if (!sectionData) return;

      const sectionName = sectionData.name_decoded;

      // instrumentConfig[sectionId]はパート設定の配列。配列の順番を維持してpartNameを取得する
      const partNames = eventData.instrumentConfig[sectionId]
        .map((config) => config.partName_decoded)
        .filter((partName) => partName); // partNameが空でないもののみをフィルタリング

      // セクションIDをキーとして、セクション名とパート名リストを保存
      if (partNames.length > 0) {
        sectionGroups[sectionId] = {
          sectionName: sectionName,
          partNames: partNames,
        };
      }
    });
  }

  // ⚠️ パート名のソートは行わない (instrumentConfigの配列順を維持するため)
}

//////////////////////////////////
// 2. メインレンダリング処理
//////////////////////////////////

/**
 * assignsデータから収集したuserIdに基づいてusersデータをキャッシュする
 * @param {Array<Object>} assignsDocs - assignsコレクションのドキュメントデータ配列
 * @returns {Promise<void>}
 */
async function prefetchUsers(assignsDocs) {
  const userIdsToFetch = new Set();

  // assignValue が userId であると想定して収集
  assignsDocs.forEach((data) => {
    if (data.userId) {
      // userIdがセットされている場合のみ
      userIdsToFetch.add(data.userId);
    }
  });

  if (userIdsToFetch.size === 0) {
    return;
  }

  const userPromises = Array.from(userIdsToFetch).map(async (userId) => {
    const docRef = utils.doc(utils.db, 'users', userId);
    const snap = await utils.getWrapDoc(docRef);
    if (snap.exists()) {
      // users.abbreviation_decoded をキャッシュする
      const userData = snap.data();
      usersAbbreviationCache[userId] =
        userData.abbreviation_decoded || userData.name_decoded || userId;
    } else {
      // users が見つからない場合は assignValue を表示するために、assignValue_decoded をキャッシュする
      // ★ 注: 後の処理で assignValue_decoded は assignsSnap.docs から取得する必要があるため、
      // ここでは users が見つからなかったというフラグとして userId をそのまま保持する (後の処理で上書きされる可能性あり)
      // ただし、今回は globalAssignsData の構築時に assignValue も保持するため、ここではキャッシュしない。
    }
  });
  await Promise.all(userPromises);
}

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

  // assignsデータから userId を取得し、users データを事前キャッシュ
  const rawAssignsData = assignsSnap.docs.map((doc) => doc.data());
  await prefetchUsers(rawAssignsData);

  // ★ 変更: globalAssignsData には assignValue_decoded ではなく、userId と assignValue_decoded の両方を保持する
  const assignsData = {}; // { songId: { partName: { userId: '...', assignValue: '...' } } }

  assignsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const partName = data.partName_decoded;
    const songId = data.songId;
    // userId がない場合は null、assignValue がない場合は 'ー'
    const userId = data.userId || null;
    const assignValue = data.assignValue_decoded || 'ー';

    if (!assignsData[songId]) {
      assignsData[songId] = {};
    }
    // ★ 変更: ユーザーIDと元の assignValue の両方を保存
    assignsData[songId][partName] = {
      userId: userId,
      assignValue: assignValue,
    };
  });
  globalAssignsData = assignsData;

  // 6. タブとコンテンツ、小計の生成
  renderTabsAndContent();
}

/**
 * 譜割り値（ユーザー略称または元の値）を取得するヘルパー関数
 * @param {Object} assignData - { userId: string | null, assignValue: string }
 * @returns {string} 表示する略称または元の assignValue
 */
function getDisplayAssignValue(assignData) {
  if (assignData.userId) {
    // userId があり、かつ usersAbbreviationCache に存在する場合
    return usersAbbreviationCache[assignData.userId] || assignData.assignValue;
  }
  // userId がない、または見つからない場合は assignValue をそのまま表示 ('ー'を含む)
  return assignData.assignValue;
}

//////////////////////////////////
// 3. テーブル描画ヘルパー (タブ対応)
//////////////////////////////////

/**
 * タブとタブコンテンツのコンテナを生成し, utils.getSession('sectionId')に基づいて初期タブを選択する
 */
function renderTabsAndContent() {
  const $wrapper = $('#assign-table-wrapper').empty();
  const $tabButtons = $('<div id="assign-tabs" class="tab-buttons"></div>');
  const $tabContents = $('<div id="tab-contents" class="tab-contents"></div>');

  // セッションからsectionIdを取得し、初期表示タブを決定する
  const sessionSectionId = utils.getSession('sectionId');
  const sectionIds = Object.keys(sectionGroups);
  let targetSectionId = sectionIds[0]; // デフォルトは最初のセクションID

  // セッションIDが存在し、かつそれがsectionGroupsに存在する場合、初期タブとして設定する
  if (sessionSectionId && sectionGroups[sessionSectionId]) {
    targetSectionId = sessionSectionId;
  }

  // タブの初期選択に使用するセクション名を取得
  const targetSectionName = sectionGroups[targetSectionId]
    ? sectionGroups[targetSectionId].sectionName
    : sectionGroups[sectionIds[0]]
    ? sectionGroups[sectionIds[0]].sectionName
    : '';

  // sectionGroupsはsectionIdをキーとしている
  sectionIds.forEach((sectionId, index) => {
    const groupData = sectionGroups[sectionId];
    const sectionName = groupData.sectionName;
    const tabId = `tab-${index}`;
    const isActive = sectionId === targetSectionId ? 'active' : '';

    // タブボタン
    $tabButtons.append(`
            <button class="tab-button ${isActive}" data-target="${tabId}" data-section-name="${sectionName}" data-section-id="${sectionId}">
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
  sectionIds.forEach((sectionId, index) => {
    const sectionName = sectionGroups[sectionId].sectionName;
    const partNamesForTab = sectionGroups[sectionId].partNames;
    renderTableHeadersAndBody(index, sectionName, partNamesForTab);
  });

  // ★ ここからタブスクロール処理の追加 ★

  /**
   * 指定されたタブボタンがコンテナ内で見えるようにスクロールする
   * @param {jQuery} $button - スクロール対象のタブボタン要素
   */
  function scrollTabIntoView($button) {
    const $container = $('#assign-tabs');
    if (!$button.length || !$container.length) return;

    // タブコンテナの現在のスクロール位置
    const containerScrollLeft = $container.scrollLeft();
    // タブボタンのコンテナ内での相対位置 (左端)
    const buttonOffsetLeft = $button.position().left;
    // タブボタンの幅
    const buttonWidth = $button.outerWidth(true);
    // タブコンテナの表示幅
    const containerWidth = $container.width();

    let newScrollLeft = containerScrollLeft;

    // タブが左側に見切れている場合
    if (buttonOffsetLeft < 0) {
      newScrollLeft = containerScrollLeft + buttonOffsetLeft; // 見切れている分だけ左にスクロール
    }
    // タブが右側に見切れている場合 (タブの右端の位置 > コンテナの表示幅)
    else if (buttonOffsetLeft + buttonWidth > containerWidth) {
      // タブの右端がコンテナの右端に合うようにスクロール位置を調整
      newScrollLeft =
        containerScrollLeft + (buttonOffsetLeft + buttonWidth - containerWidth);
    }

    // スクロールを実行
    if (newScrollLeft !== containerScrollLeft) {
      $container.animate({ scrollLeft: newScrollLeft }, 200);
    }
  }
  // ★ ここまでタブスクロール処理の追加 ★

  // タブ切り替えのイベント設定
  $('#assign-tabs').on('click', '.tab-button', function () {
    const $this = $(this);
    const targetId = $this.data('target');
    const clickedSectionName = $this.data('section-name');
    // const clickedSectionId = $this.data('section-id');

    // ボタンのアクティブ状態を切り替え
    $('.tab-button').removeClass('active');
    $this.addClass('active');

    // コンテンツの表示を切り替え
    $('.tab-content').removeClass('active');
    $(`#${targetId}`).addClass('active');

    // ★ クリック時にもスクロール処理を実行 ★
    scrollTabIntoView($this);

    // 小計表示の更新
    renderAssignSummary(clickedSectionName);
  });

  // 初期表示のためにアクティブなタブを特定し、クリックをトリガー
  const $initialActiveTab = $(
    `.tab-button[data-section-id="${targetSectionId}"]`
  );
  $initialActiveTab.trigger('click');

  // ★ 初期クリック後に、念のため再度スクロール処理を実行 ★
  scrollTabIntoView($initialActiveTab);
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
        const assignEntry = globalAssignsData[songId]
          ? globalAssignsData[songId][partName]
          : null;

        let displayValue = 'ー';

        if (assignEntry) {
          // ★ 修正: userIdを使って略称を取得し、なければ元のassignValueを使用
          displayValue = getDisplayAssignValue(assignEntry);
        }

        rowHtml += `<td class="assign-cell">${displayValue}</td>`;
      });

      rowHtml += `</tr>`;
      $tbody.append(rowHtml);
    });
  });
}

//////////////////////////////////
// 4. 小計計算と描画 (修正)
//////////////////////////////////

/**
 * 譜割りデータを集計し、セクションごとのassignValue（担当者）別カウントを生成する
 * @returns {Object} { sectionName: { assignValue: count, ... }, ... }
 */
function calculateAssignSummary() {
  const summary = {};

  // 全セクションをループ
  // ★ 修正: sectionGroupsはsectionIdをキーに持っているが、sectionNameで集計するためにループ
  Object.keys(sectionGroups).forEach((sectionId) => {
    const groupData = sectionGroups[sectionId];
    const sectionName = groupData.sectionName;
    const partNames = groupData.partNames;
    const assignCounts = {}; // { assignValue: count }

    // 全曲をループ
    Object.keys(globalAssignsData).forEach((songId) => {
      const songAssigns = globalAssignsData[songId];

      // そのセクションの全パートをループ
      partNames.forEach((partName) => {
        // 割り当て値を取得
        const assignEntry = songAssigns ? songAssigns[partName] : null;

        let displayValue = 'ー';

        if (assignEntry) {
          // ★ 修正: userIdを使って略称を取得し、なければ元のassignValueを使用
          displayValue = getDisplayAssignValue(assignEntry);
        }

        // カウントをインクリメント
        if (displayValue !== 'ー') {
          assignCounts[displayValue] = (assignCounts[displayValue] || 0) + 1;
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
  // ここではul/liの構造を維持し、CSSで制御できるようにする
  html += `<ul class="summary-list">`;

  // 担当者名でソートして表示
  const sortedAssignValues = Object.keys(summaryForActiveSection).sort();

  sortedAssignValues.forEach((assignValue) => {
    const count = summaryForActiveSection[assignValue];
    // 各項目が独立した<li>となり、CSSで縦並びになるようにする
    html += `<li class="summary-item">${assignValue}：<strong>${count}</strong></li>`;
  });

  html += `</ul></div></div>`;

  $summaryWrapper.append(html);
}
