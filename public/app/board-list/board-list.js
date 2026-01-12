import * as utils from '../common/functions.js';

let currentTab = 'all'; // 'all' or 'section'
let cachedBoards = [];
let userSectionId = '';
let userSectionName = 'セクション向け';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    utils.renderBreadcrumb([{ title: '掲示板一覧' }]);

    // セッションから情報を取得
    userSectionId = utils.getSession('sectionId') || '';

    // セクション名の取得と反映（未設定時はタブ非表示）
    await fetchAndSetSectionName();

    await setUpPage();
    bindEvents();
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
 * ユーザーのセクションIDに基づいてセクション名を取得し、タブに反映
 */
async function fetchAndSetSectionName() {
  // sectionIdが未設定の場合は、セクションタブを削除して終了
  if (!userSectionId) {
    $('#section-tab-btn').remove();
    return;
  }

  try {
    const sectionDocRef = utils.doc(utils.db, 'sections', userSectionId);
    const sectionSnap = await utils.getWrapDoc(sectionDocRef);

    if (sectionSnap.exists()) {
      userSectionName = sectionSnap.data().name || 'セクション向け';
      $('#section-tab-text').text(`${userSectionName}専用`);
    } else {
      // IDはあるがドキュメントが見つからない場合もタブを削除
      $('#section-tab-btn').remove();
    }
  } catch (e) {
    console.error('セクション名の取得に失敗:', e);
    // エラー時は安全のためにタブを非表示にする
    $('#section-tab-btn').hide();
  }
}

function bindEvents() {
  $('.tab-btn').on('click', function () {
    $('.tab-btn').removeClass('active');
    $(this).addClass('active');
    currentTab = $(this).data('tab');
    renderList();
  });
}

async function setUpPage() {
  const boardsRef = utils.collection(utils.db, 'boards');
  const qBoard = utils.query(boardsRef, utils.orderBy('createdAt', 'desc'));
  const boardSnap = await utils.getWrapDocs(qBoard);

  cachedBoards = boardSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  renderList();
}

function renderList() {
  const $tbody = $('#board-list-body').empty();

  // フィルタリング
  const filtered = cachedBoards.filter((data) => {
    if (currentTab === 'all') {
      return !data.sectionId; // sectionIdが未設定(全体)
    } else {
      return data.sectionId === userSectionId; // 自分のセクションと一致
    }
  });

  if (filtered.length === 0) {
    const msg =
      currentTab === 'all'
        ? '全体向けの投稿はありません🍀'
        : `${userSectionName}向けの投稿はありません🍀`;
    $tbody.append(`<tr><td colspan="3" class="empty-row">${msg}</td></tr>`);
    return;
  }

  filtered.forEach((data) => {
    const tr = $(`
      <tr>
        <td class="list-table-row-header">
          <a href="../board-confirm/board-confirm.html?boardId=${
            data.id
          }" class="board-title-link">
            ${DOMPurify.sanitize(data.title || '無題')}
          </a>
        </td>
        <td>
          <div class="board-content-preview">
            ${DOMPurify.sanitize(data.content || '')}
          </div>
        </td>
        <td class="board-author">
          ${DOMPurify.sanitize(data.createdByName || '匿名')}
        </td>
      </tr>
    `);
    $tbody.append(tr);
  });
}
