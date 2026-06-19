/* ==========================================================
   绿野迷踪 - config.js 
   游戏配置和数据定义
   ========================================================== */

const GameConfig = {
  // 地图配置
  MAP_WIDTH: 3200,
  MAP_HEIGHT: 3200,
  TILE_SIZE: 60,
  
  // 游戏时长配置
  ESCAPE_DURATION: 10000,
  ESCAPE_RANGE: 100,
  SEARCH_DURATION: 2200,
  MAX_DELTA: 100,
  INVULNERABILITY_DURATION: 1500,
  
  // 物理参数
  KNOCKBACK_FRICTION: 0.92,
  CAMERA_SMOOTHING: 0.12,
  
  // 性能限制
  MAX_PARTICLES: 300,   // 粒子数量上限
  MAX_BULLETS: 200,     // 子弹数量上限
  
  // 背包系统
  BAG_BASE_CAPACITY: 10,
  BAG_UPGRADE_COST_BASE: 300,
  BAG_UPGRADE_COST_INCREMENT: 150,
  BAG_MAX_LEVEL: 4,
  
  // 品质颜色
  RARITY_COLORS: {
    white: '#ccc',
    green: '#4ade80',
    blue: '#60a5fa',
    purple: '#c084fc',
    gold: '#ffd700',
    red: '#ef4444'
  },
  
  // 品质名称
  RARITY_NAMES: {
    white: '普通',
    green: '优秀',
    blue: '精良',
    purple: '史诗',
    gold: '传说',
    red: '禁忌'
  },
  
  // 品质价值倍率
  RARITY_MULT: {
    white: 1,
    green: 2,
    blue: 4,
    purple: 8,
    gold: 16,
    red: 24
  },
  
  // 补给品快捷键
  SUPPLY_KEYS: {
    smallHealth: 49,   // 1
    bigHealth: 50,     // 2
    armorRepair: 51,   // 3
    grenade: 52        // 4
  }
};

// 物品价格表
const PriceTable = {
  // 武器
  pistol: 50,
  rifle: 150,
  fireKirin: 500,
  eldenSword: 400,
  shotgun: 200,
  katana: 280,
  // 护甲
  light: 80,
  medium: 180,
  heavy: 350,
  cyber: 450,
  // 补给品
  smallHealth: 30,
  bigHealth: 70,
  armorRepair: 40,
  grenade: 60,
  // 基础收集品
  gem: 100,
  emerald: 180,
  sapphire: 250,
  starGem: 600,
  ruby: 800,
  artifact: 2000,
  legendary: 1500,
  loot: 30,
  common: 20,
  // 特殊收集品
  deltaHeart: 3000,
  firekirinCore: 3800,
  erdtreeBless: 3300,
  sandevistan: 3600,
  legendaryCore: 4000,
  deathNote: 3200,
  tesseract: 3500,
  soulStone: 3400,
  elderSign: 3100,
  necronomicon: 3300,
  trueHolyGrail: 3700,
  omnitrix: 3400,
  ultimateWeapon: 3600,
  // 基础材料
  coins: 30,
  cloth: 15,
  stone: 20,
  herb: 80,
  key: 120,
  medal: 220,
  ancientScroll: 380,
  royalRing: 420,
  crown: 800,
  chalice: 900,
  goldBar: 750,
  demonEye: 3000,
  darkCrystal: 3200,
  dragonHeart: 3500,
  // 特殊物品
  africanHeart: 1314520,
  wuKujia: 80,
  yangYantou: 20,
  xuZhenti: 220,
  xueYiluan: 800
};

// 武器数据
const WeaponData = {
  pistol: {
    id: 'pistol',
    name: '制式手枪',
    icon: 'weapon/sq.png',
    price: 50,
    damage: 18,
    rarity: 'white',
    desc: '基础武器',
    type: 'ranged',
    itemType: 'weapon',
    bulletSpeed: 9,
    bulletCount: 1,
    bulletSpread: 0,
    bulletRange: 400,
    particleColor: '#ffb400',
    particleCount: 4,
    model: 'weapon/sq.png',
    modelColor: '#333',
    shape: 'gun',
    knockback: 5,
    attackSpeed: 1.0
  },
  rifle: {
    id: 'rifle',
    name: '突击步枪',
    icon: 'weapon/tjbq.png',
    price: 150,
    damage: 16,
    rarity: 'blue',
    desc: '随着使用时间逐渐提升攻速',
    type: 'ranged',
    itemType: 'weapon',
    bulletSpeed: 11,
    bulletCount: 1,
    bulletSpread: 0,
    bulletRange: 600,
    particleColor: '#4ade80',
    particleCount: 3,
    attackSpeed: 0.5,
    model: 'weapon/tjbq.png',
    modelColor: '#2d5',
    shape: 'rifle',
    knockback: 4
  },
  eldenSword: {
    id: 'eldenSword',
    name: '月影巨剑',
    icon: 'weapon/yydj.png',
    price: 400,
    damage: 50,
    rarity: 'purple',
    desc: '扇形挥砍 · 强力击退',
    type: 'melee',
    itemType: 'weapon',
    range: 170,
    sweepAngle: Math.PI * 0.85,
    particleColor: '#a855f7',
    particleCount: 12,
    model: 'weapon/yydj.png',
    modelColor: '#c4b5fd',
    shape: 'greatsword',
    aoeRange: 170,
    knockback: 15,
    attackSpeed: 0.65
  },
  fireKirin: {
    id: 'fireKirin',
    name: '火麒麟',
    icon: 'weapon/hql.png',
    price: 500,
    damage: 48,
    rarity: 'gold',
    desc: '火焰弹 · 持续伤害',
    type: 'ranged',
    itemType: 'weapon',
    bulletSpeed: 6,
    bulletCount: 1,
    bulletSpread: 0,
    bulletRange: 450,
    particleColor: '#ef4444',
    particleCount: 6,
    fireEffect: true,
    burnDamage: 8,
    burnDuration: 3000,
    model: 'weapon/hql.png',
    modelColor: '#ff6b6b',
    shape: 'firearm',
    knockback: 5,
    attackSpeed: 0.7
  },
  shotgun: {
    id: 'shotgun',
    name: '霰弹枪',
    icon: 'weapon/xdq.png',
    price: 200,
    damage: 12,
    rarity: 'blue',
    desc: '大角度扇形 · 近距离强力',
    type: 'ranged',
    itemType: 'weapon',
    bulletSpeed: 10,
    bulletCount: 12,
    bulletSpread: 0.45,
    bulletRange: 220,
    particleColor: '#fbbf24',
    particleCount: 8,
    model: 'weapon/xdq.png',
    modelColor: '#f59e0b',
    shape: 'shotgun',
    knockback: 9,
    attackSpeed: 0.45
  },
  katana: {
    id: 'katana',
    name: '武士刀',
    icon: 'weapon/wsd.png',
    price: 280,
    damage: 36,
    rarity: 'purple',
    desc: '长条突刺 · 冲刺近战',
    type: 'melee',
    itemType: 'weapon',
    range: 200,
    thrustWidth: 50,
    particleColor: '#06b6d4',
    particleCount: 10,
    attackSpeed: 1.3,
    dashDistance: 30,
    model: 'weapon/wsd.png',
    modelColor: '#67e8f9',
    shape: 'katana',
    knockback: 14
  }
};

// 护甲数据
const ArmorData = {
  light: {
    id: 'light',
    name: '轻甲',
    icon: '🛡️',
    price: 80,
    defense: 35,
    maxDurability: 90,
    rarity: 'white',
    desc: '轻便灵活 · 移速-10%',
    itemType: 'armor',
    speedMod: 0.9
  },
  medium: {
    id: 'medium',
    name: '中甲',
    icon: '🛡️',
    price: 180,
    defense: 60,
    maxDurability: 140,
    rarity: 'blue',
    desc: '平衡防护 · 移速-20%',
    itemType: 'armor',
    speedMod: 0.8
  },
  heavy: {
    id: 'heavy',
    name: '重甲',
    icon: '🛡️',
    price: 350,
    defense: 100,
    maxDurability: 180,
    rarity: 'purple',
    desc: '全面防护 · 移速-30%',
    itemType: 'armor',
    speedMod: 0.7
  },
  cyber: {
    id: 'cyber',
    name: '机械外骨骼',
    icon: '🦾',
    price: 450,
    defense: 80,
    maxDurability: 150,
    rarity: 'gold',
    desc: '移速+5% · 搜索+50%',
    itemType: 'armor',
    speedMod: 1.05,
    searchSpeedMod: 1.5
  }
};

// 补给品数据
const SupplyData = {
  smallHealth: {
    id: 'smallHealth',
    name: '小血包',
    icon: '🩹',
    price: 30,
    rarity: 'white',
    desc: '恢复30生命',
    itemType: 'supply',
    effect: 'heal',
    amount: 30
  },
  bigHealth: {
    id: 'bigHealth',
    name: '大血包',
    icon: '💉',
    price: 70,
    rarity: 'green',
    desc: '恢复70生命',
    itemType: 'supply',
    effect: 'heal',
    amount: 70
  },
  armorRepair: {
    id: 'armorRepair',
    name: '护甲修复',
    icon: '🔧',
    price: 40,
    rarity: 'white',
    desc: '修复25护甲',
    itemType: 'supply',
    effect: 'repair',
    amount: 25
  },
  grenade: {
    id: 'grenade',
    name: '手雷',
    icon: '💣',
    price: 60,
    rarity: 'blue',
    desc: '范围伤害',
    itemType: 'supply',
    effect: 'damage',
    amount: 45,
    range: 120
  }
};

// 怪物数据
const MonsterData = {
  goblin: {
    id: 'goblin',
    name: '哥布林',
    health: 60,
    damage: 8,
    speed: 1.8,
    range: 40,
    color: '#4ade80',
    size: 28,
    drops: ['coins', 'cloth', 'herb'],
    dropChance: 0.3
  },
  skeleton: {
    id: 'skeleton',
    name: '骷髅兵',
    health: 80,
    damage: 12,
    speed: 1.5,
    range: 45,
    color: '#f5f5f5',
    size: 30,
    drops: ['stone', 'medal', 'ancientScroll'],
    dropChance: 0.35
  },
  orc: {
    id: 'orc',
    name: '兽人',
    health: 120,
    damage: 18,
    speed: 1.2,
    range: 50,
    color: '#8b4513',
    size: 35,
    drops: ['emerald', 'sapphire', 'royalRing'],
    dropChance: 0.4
  },
  demon: {
    id: 'demon',
    name: '恶魔',
    health: 150,
    damage: 25,
    speed: 2.0,
    range: 55,
    color: '#8b0000',
    size: 38,
    drops: ['ruby', 'demonEye', 'darkCrystal'],
    dropChance: 0.5
  },
  humanEnemy: {
    id: 'humanEnemy',
    name: '人类敌人',
    health: 100,
    damage: 15,
    speed: 1.6,
    range: 300,
    color: '#ff6b6b',
    size: 32,
    drops: ['pistol', 'rifle', 'light', 'medium'],
    dropChance: 0.2,
    isHuman: true
  }
};

// Boss数据
const BossData = {
  dragon: {
    id: 'dragon',
    name: '远古巨龙',
    health: 800,
    damage: 40,
    speed: 1.0,
    color: '#ff4500',
    size: 60,
    drops: ['dragonHeart', 'firekirinCore', 'deltaHeart'],
    dropChance: 0.8
  }
};

// 收集品数据
const CollectibleData = {
  // 白色品质
  coins: { id: 'coins', name: '钱币堆', icon: '💰', rarity: 'white', value: 30 },
  cloth: { id: 'cloth', name: '布料', icon: '🧵', rarity: 'white', value: 15 },
  stone: { id: 'stone', name: '石块', icon: '🪨', rarity: 'white', value: 20 },
  herb: { id: 'herb', name: '草药', icon: '🌿', rarity: 'white', value: 80 },
  
  // 绿色品质
  gem: { id: 'gem', name: '宝石', icon: '💎', rarity: 'green', value: 100 },
  emerald: { id: 'emerald', name: '翡翠', icon: '💚', rarity: 'green', value: 180 },
  
  // 蓝色品质
  sapphire: { id: 'sapphire', name: '蓝宝石', icon: '💙', rarity: 'blue', value: 250 },
  key: { id: 'key', name: '古钥匙', icon: '🗝️', rarity: 'blue', value: 120 },
  medal: { id: 'medal', name: '勋章', icon: '🏅', rarity: 'blue', value: 220 },
  
  // 紫色品质
  ruby: { id: 'ruby', name: '红宝石', icon: '❤️', rarity: 'purple', value: 800 },
  ancientScroll: { id: 'ancientScroll', name: '古老卷轴', icon: '📜', rarity: 'purple', value: 380 },
  royalRing: { id: 'royalRing', name: '皇室戒指', icon: '💍', rarity: 'purple', value: 420 },
  starGem: { id: 'starGem', name: '星辰宝石', icon: '✨', rarity: 'purple', value: 600 },
  
  // 金色品质
  crown: { id: 'crown', name: '皇冠', icon: '👑', rarity: 'gold', value: 800 },
  chalice: { id: 'chalice', name: '圣杯', icon: '🏆', rarity: 'gold', value: 900 },
  goldBar: { id: 'goldBar', name: '金条', icon: '🪙', rarity: 'gold', value: 750 },
  demonEye: { id: 'demonEye', name: '恶魔之眼', icon: '👁️', rarity: 'gold', value: 1500 },
  darkCrystal: { id: 'darkCrystal', name: '暗黑水晶', icon: '🔮', rarity: 'gold', value: 1800 },
  
  // 红色品质
  dragonHeart: { id: 'dragonHeart', name: '龙心', icon: '❤️‍🔥', rarity: 'red', value: 3500 },
  deltaHeart: { id: 'deltaHeart', name: '三角之心', icon: '🔺', rarity: 'red', value: 3000 },
  firekirinCore: { id: 'firekirinCore', name: '火麒麟核心', icon: '🔥', rarity: 'red', value: 3800 },
  erdtreeBless: { id: 'erdtreeBless', name: '黄金树祝福', icon: '🌳', rarity: 'red', value: 3300 },
  sandevistan: { id: 'sandevistan', name: '沙德维斯坦', icon: '⚡', rarity: 'red', value: 3600 },
  
  // 特殊收集品
  africanHeart: { id: 'africanHeart', name: '非洲之心', icon: '🖤', rarity: 'red', value: 1314520 },
  wuKujia: { id: 'wuKujia', name: '五铠甲', icon: '🥋', rarity: 'purple', value: 80 },
  yangYantou: { id: 'yangYantou', name: '羊眼头', icon: '🐑', rarity: 'white', value: 20 },
  xuZhenti: { id: 'xuZhenti', name: '薛振提', icon: '📜', rarity: 'blue', value: 220 },
  xueYiluan: { id: 'xueYiluan', name: '薛一乱', icon: '🌀', rarity: 'gold', value: 800 }
};

// 容器数据
const ContainerData = {
  chest: {
    id: 'chest',
    name: '宝箱',
    icon: '📦',
    searchTime: 2200,
    dropPool: ['coins', 'cloth', 'gem', 'herb', 'key'],
    dropChance: 0.6
  },
  crate: {
    id: 'crate',
    name: '木箱',
    icon: '🪵',
    searchTime: 1800,
    dropPool: ['stone', 'cloth', 'coins'],
    dropChance: 0.5
  },
  barrel: {
    id: 'barrel',
    name: '桶',
    icon: '🛢️',
    searchTime: 1500,
    dropPool: ['herb', 'coins'],
    dropChance: 0.4
  }
};

// 建筑物数据
const BuildingData = {
  house: {
    id: 'house',
    name: '房屋',
    width: 80,
    height: 60,
    color: '#8b4513'
  },
  tower: {
    id: 'tower',
    name: '塔楼',
    width: 40,
    height: 80,
    color: '#555'
  },
  wall: {
    id: 'wall',
    name: '墙壁',
    width: 100,
    height: 20,
    color: '#666'
  }
};

// 导出配置（供其他模块使用）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GameConfig,
    PriceTable,
    WeaponData,
    ArmorData,
    SupplyData,
    MonsterData,
    BossData,
    CollectibleData,
    ContainerData,
    BuildingData
  };
}