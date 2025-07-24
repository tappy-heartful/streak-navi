function loginWithLINE() {
  const clientId = '2007808275';
  const redirectUri = encodeURIComponent('../app/dashboard/dashboard.html'); // あなたのコールバックURLに変更
  const state = Math.random().toString(36).substring(2); // 任意の文字列（CSRF対策）
  const scope = 'openid profile email';

  const loginUrl =
    `https://access.line.me/oauth2/v2.1/authorize?` +
    `response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}` +
    `&state=${state}&scope=${scope}`;

  window.location.href = loginUrl;
}
