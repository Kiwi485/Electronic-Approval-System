// prototype/js/signature.js
// HTML5 Canvas 簽名板（滑鼠 + 觸控），支援清除與輸出 JPEG 壓縮
// 將簽名輸出為 DataURL 或 Blob，並提供最大大小（bytes）限制

let canvas, ctx;
let drawing = false;
let lastX = 0, lastY = 0;
let isEmpty = true;

function resizeCanvasForDpr(cv) {
  const dpr = Math.max(window.devicePixelRatio || 1, 1);
  const rect = cv.getBoundingClientRect();
  cv.width = Math.floor(rect.width * dpr);
  cv.height = Math.floor(rect.height * dpr);
  const context = cv.getContext('2d');
  context.scale(dpr, dpr);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.lineWidth = 2;
  context.strokeStyle = '#111';
}

export function initSignaturePad({ canvasId, clearBtnId }) {
  canvas = document.getElementById(canvasId);
  ctx = canvas.getContext('2d');
  resizeCanvasForDpr(canvas);

  const start = (x, y) => {
    drawing = true;
    lastX = x; lastY = y;
  };

  const move = (x, y) => {
    if (!drawing) return;
    isEmpty = false;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastX = x; lastY = y;
  };

  const stop = () => { drawing = false; };

  // 滑鼠事件
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    start(e.clientX - rect.left, e.clientY - rect.top);
  });
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    move(e.clientX - rect.left, e.clientY - rect.top);
  });
  window.addEventListener('mouseup', stop);

  // 觸控事件
  const touchHandler = (e) => {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches[0] || e.changedTouches[0];
    const x = t.clientX - rect.left;
    const y = t.clientY - rect.top;
    if (e.type === 'touchstart') start(x, y);
    else if (e.type === 'touchmove') move(x, y);
    else if (e.type === 'touchend') stop();
    e.preventDefault();
  };
  canvas.addEventListener('touchstart', touchHandler, { passive: false });
  canvas.addEventListener('touchmove', touchHandler, { passive: false });
  canvas.addEventListener('touchend', touchHandler);

  // 清除
  const clearBtn = document.getElementById(clearBtnId);
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // 重新初始化畫筆樣式
      resizeCanvasForDpr(canvas);
      isEmpty = true;
    });
  }

  // 視窗尺寸變更時維持比例（可選）
  window.addEventListener('resize', () => {
    // 取出目前圖像，再重設尺寸與重繪
    const temp = document.createElement('canvas');
    temp.width = canvas.width; temp.height = canvas.height;
    temp.getContext('2d').drawImage(canvas, 0, 0);
    resizeCanvasForDpr(canvas);
    ctx.drawImage(temp, 0, 0);
  });
}

export function isSignatureEmpty() { return isEmpty; }

export function getSignatureDataURL(quality = 0.7) {
  // 以白底輸出 JPEG，避免透明底變黑
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = canvas.width; exportCanvas.height = canvas.height;
  const ectx = exportCanvas.getContext('2d');
  ectx.fillStyle = '#fff';
  ectx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  ectx.drawImage(canvas, 0, 0);
  return exportCanvas.toDataURL('image/jpeg', quality);
}

export async function getSignatureBlob({ maxSizeBytes = 300 * 1024, initialQuality = 0.9, minQuality = 0.5 } = {}) {
  let q = initialQuality;
  let dataUrl = getSignatureDataURL(q);
  let blob = dataURLtoBlob(dataUrl);
  while (blob.size > maxSizeBytes && q > minQuality) {
    q = Math.max(minQuality, q - 0.1);
    dataUrl = getSignatureDataURL(q);
    blob = dataURLtoBlob(dataUrl);
  }
  if (blob.size > maxSizeBytes) {
    throw new Error(`壓縮後仍超過大小限制：${Math.round(blob.size/1024)}KB`);
  }
  return blob;
}

export function clearSignature() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  resizeCanvasForDpr(canvas);
  isEmpty = true;
}

function dataURLtoBlob(dataURL) {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length; const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}
