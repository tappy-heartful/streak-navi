import * as utils from '../common/functions.js';

$(document).ready(async function () {
  await utils.initDisplay();
  utils.renderBreadcrumb([
    { title: 'ユーザ一覧', url: '../user-list/user-list.html' },
  ]);

  try {
    const [sectionSnap, rolesSnap, instrumentsSnap, secretWordsSnap, userSnap] =
      await Promise.all([
        utils.getWrapDocs(utils.collection(utils.db, 'sections')),
        utils.getWrapDocs(utils.collection(utils.db, 'roles')),
        utils.getWrapDocs(utils.collection(utils.db, 'instruments')),
        utils.getWrapDocs(utils.collection(utils.db, 'secretWords')),
        utils.getWrapDocs(utils.collection(utils.db, 'users')),
      ]);

    const sectionMap = Object.fromEntries(
      sectionSnap.docs.map((doc) => [doc.id, doc.data()])
    );
    const roleMap = Object.fromEntries(
      rolesSnap.docs.map((doc) => [doc.id, doc.data().name || ''])
    );
    const instrumentMap = Object.fromEntries(
      instrumentsSnap.docs.map((doc) => [doc.id, doc.data().name_decoded || ''])
    );
    const adminRoles = secretWordsSnap.docs.map((doc) => doc.data());

    const usersBySection = {};
    userSnap.forEach((doc) => {
      const user = { uid: doc.id, ...doc.data() };
      const sectionId = user.sectionId || 'unknown';
      if (!usersBySection[sectionId]) usersBySection[sectionId] = [];
      usersBySection[sectionId].push(user);
    });

    const $container = $('#user-list-container').empty();

    for (const [sectionId, users] of Object.entries(usersBySection)) {
      const sectionName = sectionMap[sectionId]?.name || '未分類';

      const $sectionGroup = $(`
        <div class="section-group">
          <h2 class="section-title">${sectionName}</h2>
          <div class="table-wrapper">
            <table class="list-table">
              <thead>
                <tr>
                  <th>氏名</th>
                  <th>略称</th>
                  <th>楽器</th>
                  <th>役職</th>
                  <th>権限</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      `);

      const $tbody = $sectionGroup.find('tbody');

      users.forEach((user) => {
        const roleName = roleMap[user.roleId] ?? '-';
        const userInstruments = (user.instrumentIds || [])
          .map((id) => instrumentMap[id])
          .filter((name) => name)
          .join('<br>');
        const userAdmins = adminRoles
          .filter((role) => user[role.roleField])
          .map((role) => role.label)
          .join('<br>');

        const tr = $(`
          <tr>
            <td class="list-table-row-header">
              <a href="../user-confirm/user-confirm.html?uid=${user.uid}">
                <img src="${user.pictureUrl || utils.globalLineDefaultImage}" 
                     class="user-thumb"
                     onerror="this.src='${utils.globalLineDefaultImage}';">
                ${user.displayName || '名無し'}
              </a>
            </td>
            <td>${user.abbreviation || '-'}</td>
            <td class="text-small">${userInstruments || '-'}</td>
            <td>${roleName}</td>
            <td class="text-small">${userAdmins || '-'}</td>
          </tr>
        `);
        $tbody.append(tr);
      });
      $container.append($sectionGroup);
    }
  } catch (e) {
    await utils.writeLog({
      dataId: 'none',
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});
