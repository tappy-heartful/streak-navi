import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    // ログイン不要で表示
    await utils.initDisplay();

    const urlParams = new URLSearchParams(window.location.search);
    const liveId = urlParams.get('liveId');

    if (!liveId) {
      throw new Error('ライブ情報が見つかりません。');
    }

    // パンくず
    const breadcrumb = $('#breadcrumb');
    breadcrumb.append(
      `<a href="../home/home.html">Home</a>
       <span class="separator">&gt;</span>
       <span class="current">Live Detail</span>`,
    );

    await loadLiveInfo(liveId);

    // Hero画像（あれば）
    $('.hero').css(
      '--hero-bg',
      'url("https://tappy-heartful.github.io/streak-connect-images/background/mypage.jpg")',
    );
  } catch (e) {
    $('#live-content-area').html(`<p class="no-data">${e.message}</p>`);
  } finally {
    utils.hideSpinner();
  }
});

/**
 * ライブ詳細情報の表示
 */
async function loadLiveInfo(liveId) {
  const container = $('#live-content-area');

  // 1. ライブデータの取得
  const liveRef = utils.doc(utils.db, 'lives', liveId);
  const liveSnap = await utils.getWrapDoc(liveRef);

  if (!liveSnap.exists()) {
    throw new Error('指定されたライブは存在しないか、終了しました。');
  }

  const liveData = liveSnap.data();

  // 2. UI構築
  const html = `
    <div class="ticket-card detail-mode">
      <div class="ticket-info">
        <div class="t-date">${liveData.date}</div>
        <h3 class="t-title">${liveData.title}</h3>
        
        <div class="t-details">
          <p><i class="fa-solid fa-location-dot"></i> <span>会場: ${liveData.venue}</span></p>
          <p><i class="fa-solid fa-clock"></i> <span>Open ${liveData.open} / Start ${liveData.start}</span></p>
          <p><i class="fa-solid fa-yen-sign"></i> <span>前売: ${liveData.advance} / 当日: ${liveData.door || '未定'}</span></p>
        </div>
      </div>
    </div>

    <h3 class="sub-title">DESCRIPTION</h3>
    <div style="color:#ccc; line-height:1.8; margin-bottom:30px; white-space:pre-wrap;">${liveData.description || 'ライブの詳細情報は準備中です。'}</div>
  `;

  container.html(html);

  // 予約アクションエリアを表示し、イベント登録
  $('#reservation-action-area').show();
  $('#btn-go-reserve').on('click', () => {
    // 予約画面へ遷移（liveIdを渡す）
    window.location.href = `../ticket-reserve/ticket-reserve.html?liveId=${liveId}`;
  });
}
