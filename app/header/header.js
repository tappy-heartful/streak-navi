////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(function () {
  // ログイン情報反映
  const lineProfile = getSessionArray('line_profile');
  const lineIconPath = lineProfile.pictureUrl;
  const lineAccountName = lineProfile.displayName;
  $('#line-icon').attr('src', lineIconPath);
  $('#line-name').text(lineAccountName);

  // バンドアイコンボタン制御
  // TOPへ遷移
  $('.header-left').on('click', function (e) {
    window.location.href = '../top/top.html';
  });

  // ログアウトボタン制御
  // トグル表示
  $('.header-right').on('click', function (e) {
    e.stopPropagation(); // 外側のクリックイベントを防ぐ
    $('#logout-menu').slideToggle(200);
  });

  // ログアウトボタンクリック時にログイン画面へ遷移
  $('#logout-button').on('click', function () {
    // ログインページへ遷移
    window.location.href.startsWith(
      'https://tappy-heartful.github.io/streak-navi'
    )
      ? 'https://tappy-heartful.github.io/streak-navi' // 本番環境の場合(github Pagesはサブドメインまであるため)
      : window.location.origin; // テスト環境の場合、今のベースURLに結合;
  });

  // 外部クリックで閉じる
  $(document).on('click', function () {
    $('#logout-menu').slideUp(200);
  });
});
