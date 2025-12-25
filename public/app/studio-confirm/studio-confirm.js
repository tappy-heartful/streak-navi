import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();

    // パンくずリストのセット
    utils.renderBreadcrumb([
      { title: 'スタジオ一覧', url: '../studio-list/studio-list.html' },
      { title: 'スタジオ確認' },
    ]);

    await renderStudio();
  } catch (e) {
    console.error(e);
    // ログ登録
    await utils.writeLog({
      dataId: new URLSearchParams(window.location.search).get('studioId'),
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

/**
 * スタジオデータの表示
 */
async function renderStudio() {
  const studioId = new URLSearchParams(window.location.search).get('studioId');
  if (!studioId) throw new Error('Studio ID is missing');

  // データ取得
  const studioSnap = await utils.getWrapDoc(
    utils.doc(utils.db, 'studios', studioId)
  );
  if (!studioSnap.exists()) {
    throw new Error('スタジオが見つかりません：' + studioId);
  }
  const data = studioSnap.data();

  // 都道府県名の取得（マスタから名称を引く）
  if (data.prefecture) {
    const prefSnap = await utils.getWrapDoc(
      utils.doc(utils.db, 'prefectures', data.prefecture)
    );
    $('#studio-prefecture').text(
      prefSnap.exists() ? prefSnap.data().name : '不明'
    );
  }

  // 基本テキスト項目
  $('#studio-name').text(data.name || '');
  $('#studio-tel').text(data.tel || '未設定');
  $('#studio-reserve').text(data.reserve || '');
  $('#studio-note').text(data.note || '');

  // URL項目（リンク化）
  const renderLink = (id, url) => {
    const $el = $(id);
    if (url) {
      // 共通関数に外部リンクターゲット付きのHTML生成があればそれを利用
      $el.html(
        `<a href="${url}" target="_blank" rel="noopener noreferrer">${url} <i class="fas fa-external-link-alt"></i></a>`
      );
    } else {
      $el.text('未設定');
    }
  };

  renderLink('#studio-hp', data.hp);
  renderLink('#studio-map', data.map);
  renderLink('#studio-availability', data.availabilityInfo);
  renderLink('#studio-fee', data.fee);
  renderLink('#studio-rooms-url', data.roomsUrl);

  // 部屋一覧（配列をカンマ区切りで表示）
  if (data.rooms && data.rooms.length > 0) {
    $('#studio-rooms').text(data.rooms.join('、 '));
  } else {
    $('#studio-rooms').text('未設定');
  }

  // 管理者の場合のみ編集・削除ボタン表示
  if (utils.isAdmin('Studio')) {
    $('.confirm-buttons').show();
  }

  setupEventHandlers(studioId);
}

/**
 * イベントハンドラ
 */
function setupEventHandlers(studioId) {
  // 編集
  $('#studio-edit-button').on('click', () => {
    window.location.href = `../studio-edit/studio-edit.html?mode=edit&studioId=${studioId}`;
  });

  // コピー
  $('#studio-copy-button').on('click', () => {
    window.location.href = `../studio-edit/studio-edit.html?mode=copy&studioId=${studioId}`;
  });

  // 削除
  $('#studio-delete-button').on('click', async () => {
    const confirmed = await utils.showDialog(
      'このスタジオを削除しますか？\nこの操作は元に戻せません。'
    );
    if (!confirmed) return;

    try {
      utils.showSpinner();
      // アーカイブ保存後に削除する共通処理
      await utils.archiveAndDeleteDoc('studios', studioId);
      await utils.writeLog({ dataId: studioId, action: 'スタジオ削除' });

      utils.hideSpinner();
      await utils.showDialog('削除しました', true);
      window.location.href = '../studio-list/studio-list.html';
    } catch (e) {
      console.error(e);
      await utils.writeLog({
        dataId: studioId,
        action: 'スタジオ削除',
        status: 'error',
        errorDetail: { message: e.message, stack: e.stack },
      });
      utils.hideSpinner();
      utils.showDialog('削除に失敗しました', true);
    }
  });
}
