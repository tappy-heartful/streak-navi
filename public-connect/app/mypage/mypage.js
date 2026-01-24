import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    // ログイン必須
    await utils.initDisplay(true, true);

    // プロフィール反映（「様」を追加）
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

    // Firestoreから削除
    await utils.archiveAndDeleteDoc('liveReservations', reservationId);

    utils.hideSpinner();
    await utils.showDialog('予約を取り消しました', true);
    await loadMyTickets(); // 一覧を再読み込み
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

    const companionText =
      resData.companions && resData.companions.length > 0
        ? resData.companions.join(', ')
        : 'なし';

    container.append(`
      <div class="ticket-card detail-mode">
        <div class="ticket-info">
          <div class="t-status-badge">RESERVED</div>
          <div class="t-date">${liveData.date}</div>
          <h3 class="t-title">${liveData.title}</h3>
          
          <div class="t-details">
            <p><i class="fa-solid fa-location-dot"></i> ${liveData.venue}</p>
            <p><i class="fa-solid fa-user"></i> 代表者: ${resData.representativeName}</p>
            <p><i class="fa-solid fa-users"></i> 同伴者: ${companionText}</p>
          </div>
          
          <div class="ticket-actions">
            <button class="btn-edit" onclick="location.href='../ticket-reserve/ticket-reserve.html?liveId=${resData.liveId}'">
              <i class="fa-solid fa-pen-to-square"></i> 変更
            </button>
            <button class="btn-delete" onclick="handleDeleteReservation('${resData.liveId}')">
              <i class="fa-solid fa-trash-can"></i> 取消
            </button>
          </div>
        </div>
      </div>
    `);
  }
}
