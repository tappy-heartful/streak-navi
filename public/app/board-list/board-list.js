import * as utils from '../common/functions.js';

let cachedBoards = [];
let userSectionId = '';
let userSectionName = 'セクション向け';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    utils.renderBreadcrumb([{ title: '掲示板一覧' }]);

    // セッションから情報を取得
    userSectionId = utils.getSession('sectionId') || '';

    // セクション名の取得と反映
    await fetchAndSetSectionName();

    await setUpPage();
  } catch (e) {
    console.error(e);
    await utils.writeLog({
      dataId: 'none',
      action: '掲示板初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

/**
 * ユーザーのセクションIDに基づいてセクション名を取得
 */
async function fetchAndSetSectionName() {
  if (!userSectionId) {
    // セクションがない場合はセクション用コンテナごと非表示にする
    $('#section-board-container').hide();
    return;
  }

  try {
    const sectionDocRef = utils.doc(utils.db, 'sections', userSectionId);
    const sectionSnap = await utils.getWrapDoc(sectionDocRef);

    if (sectionSnap.exists()) {
      userSectionName = sectionSnap.data().name || 'セクション向け';
      $('#section-title-text').text(`${userSectionName}専用`);
    } else {
      $('#section-board-container').hide();
    }
  } catch (e) {
    console.error('セクション名の取得に失敗:', e);
    $('#section-board-container').hide();
  }
}

async function setUpPage() {
  // 注意: 元のコードが orderBy('title', 'asc') でしたのでそのままにしていますが、
  // 通常は createdAt (降順) の方が掲示板らしいかもしれません。
  const boardsRef = utils.collection(utils.db, 'boards');
  const qBoard = utils.query(boardsRef, utils.orderBy('title', 'asc'));
  const boardSnap = await utils.getWrapDocs(qBoard);

  cachedBoards = boardSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  renderAllLists();
}

/**
 * 2つのリストを同時にレンダリング
 */
function renderAllLists() {
  // 1. セクション向け
  const sectionBoards = cachedBoards.filter(
    (data) => data.sectionId === userSectionId
  );
  renderTable(
    $('#section-board-body'),
    sectionBoards,
    `${userSectionName}向けの投稿はありません🍀`
  );

  // 2. 全体向け
  const allBoards = cachedBoards.filter((data) => !data.sectionId);
  renderTable($('#all-board-body'), allBoards, '全体向けの投稿はありません🍀');
}

/**
 * テーブル描画用共通関数
 */
function renderTable($tbody, dataList, emptyMsg) {
  $tbody.empty();

  if (dataList.length === 0) {
    $tbody.append(
      `<tr><td colspan="3" class="empty-row">${emptyMsg}</td></tr>`
    );
    return;
  }

  dataList.forEach((data) => {
    // 最初の3行のみを抽出
    const content = data.content || '';
    const lines = content.split('\n');
    let displayContent = lines.slice(0, 3).join('<br>');
    if (lines.length > 3) {
      displayContent += ' ...';
    }

    const tr = $(`
      <tr>
        <td class="list-table-row-header">
          <a href="../board-confirm/board-confirm.html?boardId=${
            data.id
          }" class="board-title-link">
            ${data.title || '無題'}
          </a>
        </td>
        <td>
          <div class="board-content-preview">
            ${displayContent}
          </div>
        </td>
        <td class="board-author">
          ${data.createdByName || '匿名'}
        </td>
      </tr>
    `);
    $tbody.append(tr);
  });
}
