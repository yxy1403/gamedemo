/* ==========================================================
   绿野迷踪 - utils.js 
   工具函数库
   ========================================================== */

const Utils = {
  // 距离计算
  distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  },

  // 角度计算
  angle(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
  },

  // 碰撞检测 - 圆形
  circleCollision(x1, y1, r1, x2, y2, r2) {
    return this.distance(x1, y1, x2, y2) < r1 + r2;
  },

  // 碰撞检测 - 矩形
  rectCollision(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
  },

  // 碰撞检测 - 点在矩形内
  pointInRect(px, py, rect) {
    return px >= rect.x && px <= rect.x + rect.width &&
           py >= rect.y && py <= rect.y + rect.height;
  },

  // 碰撞检测 - 点在圆形内
  pointInCircle(px, py, cx, cy, r) {
    return this.distance(px, py, cx, cy) <= r;
  },

  // 线段与矩形碰撞检测
  lineRectCollision(x1, y1, x2, y2, rect) {
    // 检查线段是否穿过矩形
    const left = this.lineLineCollision(x1, y1, x2, y2, rect.x, rect.y, rect.x, rect.y + rect.height);
    const right = this.lineLineCollision(x1, y1, x2, y2, rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height);
    const top = this.lineLineCollision(x1, y1, x2, y2, rect.x, rect.y, rect.x + rect.width, rect.y);
    const bottom = this.lineLineCollision(x1, y1, x2, y2, rect.x, rect.y + rect.height, rect.x + rect.width, rect.y + rect.height);
    
    return left || right || top || bottom;
  },

  // 线段与线段碰撞检测
  lineLineCollision(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (denom === 0) return false;
    
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
    
    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  },

  // 随机数生成
  random(min, max) {
    return Math.random() * (max - min) + min;
  },

  // 随机整数
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  // 随机选择数组元素
  randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },

  // 随机布尔值
  randomBool(chance = 0.5) {
    return Math.random() < chance;
  },

  // 随机打乱数组
  shuffle(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  },

  // 限制数值范围
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },

  // 线性插值
  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  // 平滑插值
  smoothLerp(a, b, t) {
    return a + (b - a) * (3 - 2 * t) * t * t;
  },

  // 角度转方向向量
  angleToVector(angle) {
    return { x: Math.cos(angle), y: Math.sin(angle) };
  },

  // 方向向量转角度
  vectorToAngle(x, y) {
    return Math.atan2(y, x);
  },

  // 归一化向量
  normalizeVector(x, y) {
    const len = Math.sqrt(x * x + y * y);
    if (len === 0) return { x: 0, y: 0 };
    return { x: x / len, y: y / len };
  },

  // 向量长度
  vectorLength(x, y) {
    return Math.sqrt(x * x + y * y);
  },

  // 向量缩放
  scaleVector(x, y, scale) {
    return { x: x * scale, y: y * scale };
  },

  // 向量相加
  addVectors(v1, v2) {
    return { x: v1.x + v2.x, y: v1.y + v2.y };
  },

  // 向量相减
  subtractVectors(v1, v2) {
    return { x: v1.x - v2.x, y: v1.y - v2.y };
  },

  // 格式化时间（毫秒转秒）
  formatTime(ms) {
    return (ms / 1000).toFixed(1);
  },

  // 格式化数值（添加千位分隔符）
  formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  // 颜色混合
  blendColors(color1, color2, ratio) {
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);
    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);
    
    const r = Math.round(r1 + (r2 - r1) * ratio);
    const g = Math.round(g1 + (g2 - g1) * ratio);
    const b = Math.round(b1 + (b2 - b1) * ratio);
    
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  },

  // 生成随机颜色
  randomColor() {
    return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
  },

  // 带透明度的颜色
  colorWithAlpha(color, alpha) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  },

  // 深拷贝对象
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.deepClone(item));
    
    const cloned = {};
    for (const key in obj) {
      cloned[key] = this.deepClone(obj[key]);
    }
    return cloned;
  },

  // 合并对象
  mergeObjects(target, source) {
    const result = this.deepClone(target);
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object') {
        result[key] = this.mergeObjects(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  },

  // 计算护甲减伤比例
  calculateArmorMitigation(defense) {
    return defense / (defense + 40);
  },

  // 计算攻击间隔（毫秒）
  calculateAttackCooldown(damage, attackSpeed) {
    return Math.round((350 - damage * 2) / attackSpeed);
  },

  // 计算物品价值
  calculateItemValue(item) {
    const baseValue = PriceTable[item.id] || 0;
    const rarityMult = GameConfig.RARITY_MULT[item.rarity] || 1;
    return baseValue * rarityMult;
  },

  // 判断是否在视野范围内
  isInViewport(x, y, camera, canvasWidth, canvasHeight, margin = 100) {
    return x >= camera.x - margin &&
           x <= camera.x + canvasWidth + margin &&
           y >= camera.y - margin &&
           y <= camera.y + canvasHeight + margin;
  },

  // 获取品质颜色
  getRarityColor(rarity) {
    return GameConfig.RARITY_COLORS[rarity] || '#ccc';
  },

  // 获取品质名称
  getRarityName(rarity) {
    return GameConfig.RARITY_NAMES[rarity] || '普通';
  },

  // 生成唯一ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  // 延迟执行
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // 节流函数
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  // 防抖函数
  debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  },

  // 获取图标HTML（支持图片和emoji）
  getIconHtml(icon, className = '') {
    if (!icon) return '';
    // 如果是emoji或短字符串，直接显示
    if (icon.length <= 2 || !icon.includes('.')) {
      return `<span class="${className}">${icon}</span>`;
    }
    // 如果是图片文件名，使用img标签
    return `<img src="assets/${icon}" class="${className}" alt="" onerror="this.style.display='none'">`;
  },

  // 获取武器图标（用于悬浮窗）
  getWeaponIcon(weaponId) {
    const icons = {
      pistol: '🔫',
      rifle: '🔫',
      shotgun: '💥',
      sword: '⚔️',
      katana: '🗡️',
      eldenSword: '⚔️',
      flamethrower: '🔥',
      fireKirin: '🔥'
    };
    return icons[weaponId] || '🔫';
  },

  // 检查视线是否被阻挡
  hasLineOfSight(x1, y1, x2, y2, obstacles) {
    for (const obstacle of obstacles) {
      if (this.lineRectCollision(x1, y1, x2, y2, obstacle)) {
        return false;
      }
    }
    return true;
  },

  // 获取两点之间的路径点
  getPathPoints(x1, y1, x2, y2, steps) {
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      points.push({
        x: this.lerp(x1, x2, t),
        y: this.lerp(y1, y2, t)
      });
    }
    return points;
  },

  // 计算扇形范围内的角度
  isInSweepAngle(centerX, centerY, targetX, targetY, facingAngle, sweepAngle) {
    const angleToTarget = this.angle(centerX, centerY, targetX, targetY);
    let diff = angleToTarget - facingAngle;
    
    // 归一化角度差
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    
    return Math.abs(diff) <= sweepAngle / 2;
  }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
}