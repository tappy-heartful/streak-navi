$(document).ready(function () {
  initDisplay();
  setUpPage();
  setupEventHandlers();
});

function setUpPage() {
  // 仮データの表示（実際はURLパラメータやDBから取得）
  const userData = {
    name: 'カウント 太郎',
    isUserAdmin: true,
    isVoteAdmin: false,
  };

  $('#user-name').text(userData.name);
  $('#is-user-admin').val(userData.isUserAdmin.toString());
  $('#is-vote-admin').val(userData.isVoteAdmin.toString());
}

function setupEventHandlers() {
  $('#save-button').on('click', function () {
    const updatedData = {
      isUserAdmin: $('#is-user-admin').val() === 'true',
      isVoteAdmin: $('#is-vote-admin').val() === 'true',
    };

    console.log('更新内容:', updatedData);

    // ここにAPI送信処理などを追加可能
    showDialog('ユーザ情報を更新しますか？').then((result) => {
      if (result) {
        alert('ユーザ情報を更新しました（仮）');
      }
    });
  });
}
