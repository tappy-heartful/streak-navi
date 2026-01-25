import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    // ログイン必須
    await utils.initDisplay(true, true);

    // プロフィール反映
    $('#user-icon').attr(
      'src',
      utils.getSession('pictureUrl') ||
        'https://tappy-heartful.github.io/streak-connect-images/line-profile-unset.png',
    );
    const displayName = utils.getSession('displayName') || 'Guest';
    $('#user-name').text(`${displayName} 様`);

    // Hero画像設定
    $('.hero').css(
      '--hero-bg',
      'url("https://tappy-heartful.github.io/streak-connect-images/background/mypage.jpg")',
    );

    await loadMyTickets();
  } catch (e) {
    console.error(e);
  } finally {
    utils.hideSpinner();
  }
});

/**
 * チケットURLをクリップボードにコピー
 */
window.handleCopyTicketUrl = async function (resType, url) {
  try {
    await navigator.clipboard.writeText(url);

    // 予約種別によってメッセージを出し分け
    const message =
      resType === 'invite'
        ? 'チケットURLをコピーしました。\nご招待する人に共有してください。'
        : 'チケットURLをコピーしました。\n同伴者様に共有してください。';

    await utils.showDialog(message, true);
  } catch (err) {
    console.error('Copy failed:', err);
    alert('URLのコピーに失敗しました。');
  }
};

/**
 * ログアウト処理
 */
window.handleLogout = async function () {
  if (!(await utils.showDialog('ログアウトしますか？'))) return;

  try {
    utils.showSpinner();
    await utils.auth.signOut();
    utils.clearAllAppSession();
    window.location.href = '../home/home.html';
  } catch (e) {
    alert('ログアウトに失敗しました');
  } finally {
    utils.hideSpinner();
  }
};

/**
 * 予約取り消し処理
 */
window.handleDeleteTicket = async function (liveId) {
  if (
    !(await utils.showDialog(
      'この予約を取り消しますか？\n（この操作は元に戻せません）',
    ))
  )
    return;

  try {
    utils.showSpinner();
    const uid = utils.getSession('uid');
    const ticketId = `${liveId}_${uid}`;

    await utils.archiveAndDeleteDoc('tickets', ticketId);

    utils.hideSpinner();
    await utils.showDialog('予約を取り消しました', true);
    await loadMyTickets();
  } catch (e) {
    console.error(e);
    alert('エラーが発生しました: ' + e.message);
  } finally {
    utils.hideSpinner();
  }
};

/**
 * 自分の予約情報を取得して表示
 */
async function loadMyTickets() {
  const container = $('#my-tickets-container');
  const uid = utils.getSession('uid');

  const q = utils.query(
    utils.collection(utils.db, 'tickets'),
    utils.where('uid', '==', uid),
    utils.orderBy('updatedAt', 'desc'),
  );

  const resSnapshot = await utils.getWrapDocs(q);

  if (resSnapshot.empty) {
    container.html('<p class="no-data">予約済みのチケットはありません。</p>');
    return;
  }

  container.empty();

  for (const resDoc of resSnapshot.docs) {
    const resData = resDoc.data();
    const liveRef = utils.doc(utils.db, 'lives', resData.liveId);
    const liveSnap = await utils.getWrapDoc(liveRef);

    if (!liveSnap.exists()) continue;
    const liveData = liveSnap.data();

    const isInvite = resData.resType === 'invite';
    const typeName = isInvite ? '招待予約' : '一般予約';
    const repLabel = isInvite ? '予約担当' : '代表者';
    const companionLabel = isInvite ? 'ご招待' : '同伴者';
    const msgTarget = isInvite ? '招待するお客様' : '同伴者様';

    const companionText =
      resData.companions && resData.companions.length > 0
        ? resData.companions.join(' 様、') + ' 様'
        : 'なし';

    const ticketId = resDoc.id;
    const detailUrl = `${window.location.origin}/app/ticket-detail/ticket-detail.html?ticketId=${ticketId}`;

    container.append(`
      <div class="ticket-card detail-mode">
        <div class="t-status-badge">RESERVED</div>
        <div class="ticket-info">
          <span class="res-type-label">${typeName}</span>
          <div class="t-date">${liveData.date}</div>
          <h3 class="t-title" style="margin: 5px 0 15px;">${liveData.title}</h3>
          
          <div class="t-details">
            <p><i class="fa-solid fa-location-dot"></i> 会場: ${liveData.venue}</p>
            <p><i class="fa-solid fa-clock"></i> 開演: ${liveData.start} (開場 ${liveData.open})</p>
            <p><i class="fa-solid fa-yen"></i> 前売: ${liveData.advance}</p>
            <p><i class="fa-solid fa-user"></i> ${repLabel}: ${resData.representativeName} 様</p>
            <p><i class="fa-solid fa-users"></i> ${companionLabel}: ${companionText}</p>
          </div>
          
          <div class="ticket-actions">
            <button class="btn-edit" onclick="location.href='../ticket-reserve/ticket-reserve.html?liveId=${resData.liveId}'">
              <i class="fa-solid fa-pen-to-square"></i> 変更
            </button>
            <button class="btn-delete" onclick="handleDeleteTicket('${resData.liveId}')">
              <i class="fa-solid fa-trash-can"></i> 取消
            </button>
            <button class="btn-ticket" onclick="location.href='../ticket-detail/ticket-detail.html?ticketId=${ticketId}&fromPage=mypage'">
              <i class="fa-solid fa-ticket"></i> 表示
            </button>
            <button class="btn-view" onclick="handleCopyTicketUrl('${resData.resType}', '${detailUrl}')">
              <i class="fa-solid fa-copy"></i> チケットURLをコピー
            </button>
          </div>
          <p class="note-text">${msgTarget}にチケットURLを共有してください</p>
        </div>
      </div>
    `);
  }
}
