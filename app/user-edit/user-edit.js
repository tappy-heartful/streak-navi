$(document).ready(function () {
  initDisplay();
  setUpPage();
  setupEventHandlers();
});

function setUpPage() {
  const userData = {
    name: 'カウント 太郎',
    isUserAdmin: true,
    isVoteAdmin: false,
  };

  $('#user-name').text(userData.name);
  $('#is-user-admin').prop('checked', userData.isUserAdmin);
  $('#is-vote-admin').prop('checked', userData.isVoteAdmin);
}

function setupEventHandlers() {
  $('#save-button').on('click', function () {
    const updatedData = {
      isUserAdmin: $('#is-user-admin').is(':checked'),
      isVoteAdmin: $('#is-vote-admin').is(':checked'),
    };

    console.log('更新内容:', updatedData);

    showDialog('ユーザ情報を更新しますか？').then((result) => {
      if (result) {
        alert('ユーザ情報を更新しました（仮）');
      }
    });
  });
}
