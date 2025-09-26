// Canvas 簽名邏輯
export class SignaturePad {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.isEmpty = true;
        
        this.initCanvas();
        this.bindEvents();
    }
    
    /**
     * 初始化 Canvas 設定
     */
    initCanvas() {
        // 設置 Canvas 大小
        this.resizeCanvas();
        
        // 設置繪畫樣式
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // 清空背景為白色
        this.clearCanvas();
        
        // 監聽視窗大小變化
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    /**
     * 調整 Canvas 大小
     */
    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }
    
    /**
     * 綁定事件監聽器
     */
    bindEvents() {
        // 滑鼠事件
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());
        
        // 觸控事件
        this.canvas.addEventListener('touchstart', (e) => this.handleTouch(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouch(e));
        this.canvas.addEventListener('touchend', () => this.stopDrawing());
        
        // 防止觸控時頁面滾動
        this.canvas.addEventListener('touchstart', (e) => e.preventDefault());
        this.canvas.addEventListener('touchmove', (e) => e.preventDefault());
    }
    
    /**
     * 開始繪畫
     * @param {MouseEvent|TouchEvent} e - 事件物件
     */
    startDrawing(e) {
        this.isDrawing = true;
        this.isEmpty = false;
        [this.lastX, this.lastY] = this.getCoordinates(e);
    }
    
    /**
     * 繪畫過程
     * @param {MouseEvent|TouchEvent} e - 事件物件
     */
    draw(e) {
        if (!this.isDrawing) return;
        
        const [currentX, currentY] = this.getCoordinates(e);
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(currentX, currentY);
        this.ctx.stroke();
        
        [this.lastX, this.lastY] = [currentX, currentY];
    }
    
    /**
     * 停止繪畫
     */
    stopDrawing() {
        this.isDrawing = false;
    }
    
    /**
     * 處理觸控事件
     * @param {TouchEvent} e - 觸控事件
     */
    handleTouch(e) {
        e.preventDefault();
        
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 'mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        
        if (e.type === 'touchstart') {
            this.startDrawing(mouseEvent);
        } else if (e.type === 'touchmove') {
            this.draw(mouseEvent);
        }
    }
    
    /**
     * 取得座標位置
     * @param {MouseEvent} e - 滑鼠事件
     * @returns {Array} [x, y] 座標
     */
    getCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        return [
            e.clientX - rect.left,
            e.clientY - rect.top
        ];
    }
    
    /**
     * 清除簽名
     */
    clearCanvas() {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.isEmpty = true;
    }
    
    /**
     * 檢查是否為空白
     * @returns {boolean} - 是否為空白
     */
    isCanvasEmpty() {
        return this.isEmpty;
    }
    
    /**
     * 取得簽名圖片資料
     * @param {string} format - 圖片格式，預設 'image/jpeg'
     * @param {number} quality - 圖片品質，預設 0.7
     * @returns {string} - Base64 格式的圖片資料
     */
    getSignatureData(format = 'image/jpeg', quality = 0.7) {
        return this.canvas.toDataURL(format, quality);
    }
    
    /**
     * 取得 Canvas 元素
     * @returns {HTMLCanvasElement} - Canvas 元素
     */
    getCanvas() {
        return this.canvas;
    }
}