// Firebase Storage 上傳邏輯
import { storage } from "../firebase-init.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-storage.js";

/**
 * 將 dataURL 轉換為 Blob
 * @param {string} dataURL - Canvas 的 dataURL
 * @returns {Blob} - 轉換後的 Blob
 */
function dataURLtoBlob(dataURL) {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

/**
 * 上傳簽名到 Firebase Storage
 * @param {HTMLCanvasElement} canvas - 簽名的 Canvas 元素
 * @param {number} maxRetries - 最大重試次數，預設 3 次
 * @returns {Promise<string>} - 返回 downloadURL
 */
export async function uploadSignature(canvas, maxRetries = 3) {
    // 生成壓縮的 JPEG 圖片（quality 0.7）
    const dataURL = canvas.toDataURL('image/jpeg', 0.7);
    const blob = dataURLtoBlob(dataURL);
    
    // 檢查檔案大小（目標 < 300KB）
    if (blob.size > 300 * 1024) {
        console.warn('⚠️ 簽名檔案過大:', (blob.size / 1024).toFixed(2) + 'KB');
    }
    
    const fileName = `signatures/${Date.now()}.jpg`;
    const storageRef = ref(storage, fileName);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`📤 上傳簽名嘗試 ${attempt}/${maxRetries}: ${fileName}`);
            
            const uploadResult = await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(uploadResult.ref);
            
            console.log('✅ 簽名上傳成功:', downloadURL);
            return downloadURL;
            
        } catch (error) {
            console.error(`❌ 上傳失敗 (嘗試 ${attempt}/${maxRetries}):`, error);
            
            if (attempt === maxRetries) {
                throw new Error(`簽名上傳失敗，已重試 ${maxRetries} 次: ${error.message}`);
            }
            
            // 等待 1 秒後重試
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

/**
 * 驗證簽名檔案大小
 * @param {HTMLCanvasElement} canvas - 簽名的 Canvas 元素
 * @returns {object} - 包含 size 和 valid 的驗證結果
 */
export function validateSignatureSize(canvas) {
    const dataURL = canvas.toDataURL('image/jpeg', 0.7);
    const blob = dataURLtoBlob(dataURL);
    
    return {
        size: blob.size,
        sizeKB: (blob.size / 1024).toFixed(2),
        valid: blob.size <= 300 * 1024
    };
}