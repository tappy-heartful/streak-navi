import * as utils from '../common/functions.js';

// 譜面（scores）とセクション（sections）のキャッシュ
let scoresCache = {};
let sectionsCache = {};
let allPartNames = []; // 全パート名 (重複なし、表示順に格納)
let sectionGroupMap = {}; // { sectionId: { name: 'セクション名', partNames: ['part1', 'part2', ...] } }

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
 * イベントの全曲に必要なscoresとsectionsのデータを事前にキャッシュする
 * @param {Object} eventData - イベントデータ
 * @returns {Promise<void>}
 */
async function prefetchData(eventData) {
  const scoreIdsToFetch = new Set();
  const sectionIdsToFetch = new Set();

  // 譜面IDを抽出
  eventData.setlist.forEach((group) => {
    group.songIds.forEach((id) => scoreIdsToFetch.add(id));
  });

  if (scoreIdsToFetch.size === 0) return;

  // scoresデータを取得し、instrumentConfigからsectionIdとpartNameを抽出
  const scorePromises = Array.from(scoreIdsToFetch).map(async (scoreId) => {
    const docRef = utils.doc(utils.db, 'scores', scoreId);
    const snap = await utils.getWrapDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      scoresCache[scoreId] = data;

      // 横軸ラベルに必要なsectionIdを抽出
      if (data.instrumentConfig) {
        Object.keys(data.instrumentConfig).forEach((sectionId) => {
          sectionIdsToFetch.add(sectionId);

          // partNameの重複リストを作成
          data.instrumentConfig[sectionId].forEach((config) => {
            if (!allPartNames.includes(config.partName_decoded)) {
              allPartNames.push(config.partName_decoded);
            }
          });
        });
      }
    }
  });

  await Promise.all(scorePromises);

  // sectionsデータを取得
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

  // sectionGroupMapを作成: { sectionId: { name: 'セクション名', partNames: ['part1', ...] } }
  // ここでパート名をセクションごとにグルーピングし、横軸ヘッダーの描画準備を行う
  Object.keys(sectionsCache).forEach((sectionId) => {
    const sectionName = sectionsCache[sectionId].name_decoded;
    const scoreId = Object.keys(scoresCache).find(
      (sId) =>
        scoresCache[sId].instrumentConfig &&
        scoresCache[sId].instrumentConfig[sectionId]
    );

    if (scoreId && scoresCache[scoreId].instrumentConfig[sectionId]) {
      const partNames = scoresCache[scoreId].instrumentConfig[sectionId].map(
        (config) => config.partName_decoded
      );

      sectionGroupMap[sectionId] = {
        name: sectionName,
        partNames: partNames,
      };
    }
  });
}

//////////////////////////////////
// 2. メインレンダリング処理
//////////////////////////////////

async function renderAssignConfirm() {
  const eventId = utils.globalGetParamEventId;
  if (!eventId) {
    throw new Error('eventIdが指定されていません。');
  }

  // 1. イベントデータの取得
  const eventSnap = await utils.getWrapDoc(
    utils.doc(utils.db, 'events', eventId)
  );
  if (!eventSnap.exists()) {
    throw new Error('イベントが見つかりません：' + eventId);
  }
  const eventData = eventSnap.data();

  // 2. 基本情報の表示
  $('#event-date').text(
    utils.getDayOfWeek(eventData.date_decoded) || '日付未定'
  );
  $('#event-title').text(eventData.title_decoded || '');

  // 3. 譜割り編集ボタンのリンク設定
  $('#assign-edit-button').on('click', () => {
    window.location.href = `../assign-edit/assign-edit.html?eventId=${eventId}`;
  });

  if (!eventData.setlist || eventData.setlist.length === 0) {
    $('#no-assign-message')
      .removeClass('hidden')
      .text('セットリストが設定されていません。');
    return;
  }

  // 4. 譜面・セクション・パート情報の事前取得とキャッシュ
  await prefetchData(eventData);

  if (allPartNames.length === 0) {
    $('#no-assign-message')
      .removeClass('hidden')
      .text('セットリスト内の曲に楽器パートが設定されていません。');
    return;
  }

  // 5. 譜割りデータの一括取得
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

  // 6. テーブルヘッダーの生成 (横軸)
  renderTableHeaders();

  // 7. テーブルボディの生成 (縦軸と中身)
  renderTableBody(eventData, assignsData);
}

//////////////////////////////////
// 3. テーブル描画ヘルパー
//////////////////////////////////

/**
 * テーブルの横軸ヘッダー (セクション名とパート名) を描画する
 */
function renderTableHeaders() {
  const $sectionsRow = $('#table-header-sections');
  const $partsRow = $('#table-header-parts');

  // 最初の<th> (曲名 / パート) は既にHTMLにあるためスキップ

  let partCount = 0; // すべてのパートの合計数
  let htmlSections = '';

  // セクションIDをキーにして、各セクションのパート数を数える
  const sectionPartCounts = {};
  Object.values(sectionGroupMap).forEach((group) => {
    group.partNames.forEach((partName) => {
      if (allPartNames.includes(partName)) {
        sectionPartCounts[group.name] =
          (sectionPartCounts[group.name] || 0) + 1;
      }
    });
  });

  // 1行目: セクション名 (colspanを使用)
  // allPartNamesの順序でセクション名を表示するために、少し複雑なロジックが必要
  const uniqueSectionNames = new Set();
  const sectionSpans = []; // { name: 'セクション名', startPart: 'partName', endPart: 'partName' }

  allPartNames.forEach((partName) => {
    const sectionId = Object.keys(sectionGroupMap).find((id) =>
      sectionGroupMap[id].partNames.includes(partName)
    );
    const sectionName = sectionId ? sectionGroupMap[sectionId].name : 'その他';

    if (!uniqueSectionNames.has(sectionName)) {
      // 新しいセクションの開始
      uniqueSectionNames.add(sectionName);

      // そのセクションに属するパート名を数える (allPartNamesのサブセットとして)
      let currentSectionPartCount = 0;
      allPartNames.forEach((pn) => {
        const pnSectionId = Object.keys(sectionGroupMap).find((id) =>
          sectionGroupMap[id].partNames.includes(pn)
        );
        if (pnSectionId && sectionGroupMap[pnSectionId].name === sectionName) {
          currentSectionPartCount++;
        }
      });

      htmlSections += `<th colspan="${currentSectionPartCount}">${sectionName}</th>`;
      partCount += currentSectionPartCount;
    }
  });

  $sectionsRow.append(htmlSections);

  // 2行目: パート名 (allPartNamesの順に表示)
  let htmlParts = '';
  allPartNames.forEach((partName) => {
    htmlParts += `<th>${partName}</th>`;
  });
  $partsRow.append(htmlParts);
}

/**
 * テーブルの縦軸 (セットリスト) と中身 (譜割りデータ) を描画する
 * @param {Object} eventData - イベントデータ
 * @param {Object} assignsData - 譜割りデータ { songId: { partName: assignValue } }
 */
function renderTableBody(eventData, assignsData) {
  const $tbody = $('#table-body-setlist');

  eventData.setlist.forEach((group) => {
    // グループタイトル行 (縦軸ラベルのグループ名)
    const groupTitle = group.title_decoded || 'No Group Title';
    const colspan = allPartNames.length + 1; // 1は曲名列

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
      allPartNames.forEach((partName) => {
        const assignValue = assignsData[songId]
          ? assignsData[songId][partName] || 'ー'
          : 'ー';

        rowHtml += `<td class="assign-cell">${assignValue}</td>`;
      });

      rowHtml += `</tr>`;
      $tbody.append(rowHtml);
    });
  });
}
