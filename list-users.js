// list-users.js
// 可用於列出目前 Auth 中的使用者 (emulator 或真實專案)
// 使用前請在 PowerShell 設定環境變數 (emulator 模式：FIREBASE_AUTH_EMULATOR_HOST, FIRESTORE_EMULATOR_HOST, GCLOUD_PROJECT)

const admin = require('firebase-admin');

// 初始化（在 emulator 模式下使用 projectId）
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'local-project' });

admin.auth().listUsers(1000)
  .then(r => {
    if (!r.users || r.users.length === 0) {
      console.log('No users found.');
    } else {
      console.log('Users:', r.users.map(u => ({
        uid: u.uid,
        email: u.email,
        disabled: u.disabled,
        customClaims: u.customClaims || null
      })));
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('listUsers error:', err);
    process.exit(1);
  });
