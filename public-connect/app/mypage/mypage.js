import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    // ログイン必須
    await utils.initDisplay(true, true);

    // 【重要】リダイレクトが走っている最中に下のコードが動かないよう、
    // 確実にuidが存在するかチェックを入れ、なければここで処理を止める。
    const uid = utils.getSession('uid');
    if (!uid) return;

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
    await utils.writeLog({
      dataId: 'none',
      action: 'Mypage初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

/**
 * 退会処理
 */
window.handleWithdrawal = async function () {
  const confirmMsg =
    '【退会確認】\n退会すると予約済みのチケットもすべて無効になります。本当によろしいですか？';
  if (!(await utils.showDialog(confirmMsg))) return;

  const finalConfirm = '本当に退会しますか？この操作は取り消せません。';
  if (!(await utils.showDialog(finalConfirm))) return;

  try {
    utils.showSpinner();
    const uid = utils.getSession('uid');
    if (!uid) throw new Error('ユーザーIDが取得できません。');

    // 1. 自分のチケットをすべて取得して削除
    const q = utils.query(
      utils.collection(utils.db, 'tickets'),
      utils.where('uid', '==', uid),
    );
    const ticketSnap = await utils.getWrapDocs(q);

    // チケットの削除（ループで一つずつ削除）
    const deletePromises = ticketSnap.docs.map((doc) =>
      utils.deleteTicket(doc.data().liveId, false),
    );
    await Promise.all(deletePromises);
    console.log(`${deletePromises.length}件のチケットを削除しました。`);

    // 2. connectUsers の自分のドキュメントを削除
    await utils.archiveAndDeleteDoc('connectUsers', uid);
    console.log('ユーザー情報を削除しました。');

    // 3. ログアウトしてリダイレクト
    await utils.auth.signOut();
    utils.clearAllAppSession();

    await utils.showDialog(
      '退会処理が完了しました。ご利用ありがとうございました。',
      true,
    );
    window.location.href = '../home/home.html';
  } catch (e) {
    console.error(e);
    await utils.showDialog(
      '退会処理中にエラーが発生しました。\nお手数ですが管理者までお問い合わせください。',
      true,
    );
    await utils.writeLog({
      dataId: utils.getSession('uid') || 'none',
      action: '退会処理',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
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
    console.error(e);
    await utils.writeLog({
      dataId: utils.getSession('uid') || 'none',
      action: 'ログアウト処理',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
};

/**
 * チケットURLをクリップボードにコピー
 */
window.handleCopyTicketUrl = async function (resType, url) {
  try {
    await navigator.clipboard.writeText(url);

    const message =
      resType === 'invite'
        ? 'チケットURLをコピーしました！\nご招待するお客様共有してください！'
        : 'チケットURLをコピーしました！\n同伴者様に共有してください！';

    await utils.showDialog(message, true);
  } catch (err) {
    console.error('Copy failed:', err);
    alert('URLのコピーに失敗しました。');
  }
};

/**
 * 予約取り消し処理（単発）
 */
window.handleDeleteTicket = async function (liveId) {
  if (await utils.deleteTicket(liveId)) await loadMyTickets();
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

    const todayStr = utils.format(new Date(), 'yyyy.MM.dd');
    const isPast = liveData.date < todayStr;

    const isAccepting = liveData.isAcceptReserve === true;
    const isWithinPeriod =
      (!liveData.acceptStartDate || todayStr >= liveData.acceptStartDate) &&
      (!liveData.acceptEndDate || todayStr <= liveData.acceptEndDate);
    const canModify = !isPast && isAccepting && isWithinPeriod;

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
    const ticketDetailUrl = `${window.location.origin}/app/ticket-detail/ticket-detail.html?ticketId=${ticketId}&fromPage=mypage`;
    const liveDetailUrl = `../live-detail/live-detail.html?liveId=${resData.liveId}&fromPage=mypage`;

    const actionButtons = canModify
      ? `
      <div class="ticket-actions">
        <button class="btn-edit" onclick="location.href='../ticket-reserve/ticket-reserve.html?liveId=${resData.liveId}&fromPage=mypage'">
          <i class="fa-solid fa-pen-to-square"></i> 変更
        </button>
        <button class="btn-delete" onclick="handleDeleteTicket('${resData.liveId}')">
          <i class="fa-solid fa-trash-can"></i> 取消
        </button>
      </div>
    `
      : `
      <div class="ticket-actions">
        <span class="status-badge">${isPast ? '終了' : '予約受付期間外（変更不可）'}</span>
      </div>
    `;

    container.append(`
      <div class="ticket-card detail-mode">
        <div class="card-status-area">
          <div class="res-no-mini">NO. ${resData.reservationNo || '----'}</div>
        </div>
        
        <div class="ticket-info">
          <span class="res-type-label">${typeName}</span>
          <div class="t-date">${liveData.date}</div>
          <a href="${liveDetailUrl}" class="t-title-link">
            <h3 class="t-title">${liveData.title}</h3>
          </a>
          
          <div class="t-details">
            <p><i class="fa-solid fa-location-dot"></i> 会場: ${liveData.venue}</p>
            <p><i class="fa-solid fa-clock"></i> 開演: ${liveData.start} (開場 ${liveData.open})</p>
            <p><i class="fa-solid fa-user"></i> ${repLabel}: ${resData.representativeName} 様</p>
            <p><i class="fa-solid fa-users"></i> ${companionLabel}: ${companionText}</p>
          </div>
          
          <div class="ticket-actions">
            <button class="btn-view" onclick="handleCopyTicketUrl('${resData.resType}', '${ticketDetailUrl}')">
              <i class="fa-solid fa-copy"></i> チケットURLをコピー
            </button>
          </div>
          <div class="ticket-actions">
            <button class="btn-ticket" onclick="location.href='${ticketDetailUrl}'">
              <i class="fa-solid fa-ticket"></i> チケットを表示
            </button>
          </div>
          
          ${actionButtons}
          
          ${canModify ? `<p class="note-text">${msgTarget}にチケットURLを共有してください！</p>` : ''}
        </div>
      </div>
    `);
  }
}
