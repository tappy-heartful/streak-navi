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
 * 共有処理 (Web Share API)
 */
window.handleShareTicket = async function (title, url) {
  const shareData = {
    title: `SSJO Digital Ticket: ${title}`,
    url: url,
  };

  try {
    if (navigator.share) {
      // OS標準の共有メニューを呼び出し
      await navigator.share(shareData);
    } else {
      // 非対応ブラウザ（PCなど）の場合はクリップボードへコピー
      await navigator.clipboard.writeText(url);
      await utils.showDialog(
        'URLをクリップボードにコピーしました。\n同伴者の方へお送りください。',
        true,
      );
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Share failed:', err);
    }
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
window.handleDeleteReservation = async function (liveId) {
  if (
    !(await utils.showDialog(
      'この予約を取り消しますか？\n（この操作は元に戻せません）',
    ))
  )
    return;

  try {
    utils.showSpinner();
    const uid = utils.getSession('uid');
    const reservationId = `${liveId}_${uid}`;

    await utils.archiveAndDeleteDoc('liveReservations', reservationId);

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
    utils.collection(utils.db, 'liveReservations'),
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

    const companionText =
      resData.companions && resData.companions.length > 0
        ? resData.companions.join(' 様、') + ' 様'
        : 'なし';

    const reservationId = resDoc.id;
    // URL作成（/app/ticket-detail/... とのことなので調整）
    const detailUrl = `${window.location.origin}/app/ticket-detail/ticket-detail.html?liveReservationId=${reservationId}`;

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
            <button class="btn-delete" onclick="handleDeleteReservation('${resData.liveId}')">
              <i class="fa-solid fa-trash-can"></i> 取消
            </button>
            <button class="btn-view" onclick="handleShareTicket('${liveData.title}', '${detailUrl}')">
              <i class="fa-solid fa-share-nodes"></i> 共有
            </button>
          </div>
        </div>
      </div>
    `);
  }
}
