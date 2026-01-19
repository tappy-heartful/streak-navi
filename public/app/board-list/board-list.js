import * as utils from '../common/functions.js';

let currentTab = 'section'; // 💡 初期表示を 'section' に変更
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
  // sectionIdが未設定の場合は、セクションタブを削除して全体表示に切り替え
  if (!userSectionId) {
    $('#section-tab-btn').remove();
    $('.tab-btn[data-tab="all"]').addClass('active');
    currentTab = 'all'; // 💡 セクションがない場合は全体を初期値にする
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
      $('.tab-btn[data-tab="all"]').addClass('active');
      currentTab = 'all';
    }
  } catch (e) {
    console.error('セクション名の取得に失敗:', e);
    $('#section-tab-btn').hide();
    $('.tab-btn[data-tab="all"]').addClass('active');
    currentTab = 'all';
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
    // 💡 最初の3行のみを抽出するロジック
    const content = data.content || '';
    const lines = content.split('\n');
    let displayContent = lines.slice(0, 3).join('<br>');

    // 4行以上ある場合は三点リーダーを追加
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
