$(document).ready(function () {
  // 設定したい値
  const lineProfile = getSessionArray('line_profile');
  const lineIconPath = lineProfile.pictureUrl;
  const lineAccountName = lineProfile.displayName;

  // 反映
  $('#line-icon').attr('src', lineIconPath);
  $('#line-name').text(lineAccountName);
});
