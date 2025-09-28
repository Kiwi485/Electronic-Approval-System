// prototype/js/firebase-storage.js
// 封裝簽名檔上傳到 Firebase Storage，並提供重試機制
import { storage } from "../firebase-init.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-storage.js";

export async function uploadSignatureWithRetry(blob, { pathPrefix = 'signatures', maxRetries = 3 } = {}) {
  const fileName = `${pathPrefix}/${Date.now()}.jpg`;
  const storageRef = ref(storage, fileName);

  let attempt = 0;
  let lastErr;
  while (attempt < maxRetries) {
    try {
      const result = await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
      const downloadURL = await getDownloadURL(result.ref);
      return { path: fileName, downloadURL };
    } catch (err) {
      lastErr = err;
      attempt++;
      await delay(300 * attempt); // 簡單退避
    }
  }
  throw lastErr || new Error('上傳失敗');
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
