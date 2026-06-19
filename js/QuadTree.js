/* ==========================================================
   绿野迷踪 - QuadTree.js 
   四叉树碰撞检测优化
   ========================================================== */

class QuadTree {
  constructor(x, y, width, height, maxObjects = 4, maxLevels = 5) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.maxObjects = maxObjects;
    this.maxLevels = maxLevels;
    this.objects = [];
    this.nodes = [];
  }

  // 清空四叉树
  clear() {
    this.objects = [];
    this.nodes = [];
  }

  // 分裂节点
  split() {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const level = this.maxLevels - 1;

    this.nodes[0] = new QuadTree(this.x, this.y, halfW, halfH, this.maxObjects, level);
    this.nodes[1] = new QuadTree(this.x + halfW, this.y, halfW, halfH, this.maxObjects, level);
    this.nodes[2] = new QuadTree(this.x, this.y + halfH, halfW, halfH, this.maxObjects, level);
    this.nodes[3] = new QuadTree(this.x + halfW, this.y + halfH, halfW, halfH, this.maxObjects, level);
  }

  // 获取对象所在区域索引
  getIndex(obj) {
    const verticalMid = this.x + this.width / 2;
    const horizontalMid = this.y + this.height / 2;

    const topQuadrant = obj.y < horizontalMid && obj.y + (obj.height || 30) < horizontalMid;
    const bottomQuadrant = obj.y > horizontalMid;
    const leftQuadrant = obj.x < verticalMid && obj.x + (obj.width || 30) < verticalMid;
    const rightQuadrant = obj.x > verticalMid;

    if (topQuadrant && leftQuadrant) return 0;
    if (topQuadrant && rightQuadrant) return 1;
    if (bottomQuadrant && leftQuadrant) return 2;
    if (bottomQuadrant && rightQuadrant) return 3;

    return -1; // 跨越多个区域
  }

  // 插入对象
  insert(obj) {
    if (this.nodes.length > 0) {
      const index = this.getIndex(obj);
      if (index !== -1) {
        this.nodes[index].insert(obj);
        return;
      }
    }

    this.objects.push(obj);

    if (this.objects.length > this.maxObjects && this.maxLevels > 0) {
      if (this.nodes.length === 0) {
        this.split();
      }

      for (let i = 0; i < this.objects.length; i++) {
        const index = this.getIndex(this.objects[i]);
        if (index !== -1) {
          this.nodes[index].insert(this.objects.splice(i, 1)[0]);
          i--;
        }
      }
    }
  }

  // 检索范围内的对象
  retrieve(range) {
    const result = [];

    if (!this.intersects(this, range)) {
      return result;
    }

    for (const obj of this.objects) {
      if (this.intersects(obj, range)) {
        result.push(obj);
      }
    }

    if (this.nodes.length > 0) {
      for (const node of this.nodes) {
        result.push(...node.retrieve(range));
      }
    }

    return result;
  }

  // 矩形相交检测
  intersects(a, b) {
    return a.x < b.x + b.width &&
           a.x + (a.width || 30) > b.x &&
           a.y < b.y + b.height &&
           a.y + (a.height || 30) > b.y;
  }

  // 获取所有对象
  getAllObjects() {
    const result = [...this.objects];
    if (this.nodes.length > 0) {
      for (const node of this.nodes) {
        result.push(...node.getAllObjects());
      }
    }
    return result;
  }

  // 统计对象数量
  count() {
    let total = this.objects.length;
    if (this.nodes.length > 0) {
      for (const node of this.nodes) {
        total += node.count();
      }
    }
    return total;
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QuadTree;
}