/* ==========================================================
   绿野迷踪 - game.js 
   主游戏逻辑（依赖 config.js, utils.js, QuadTree.js）
   ========================================================== */

// 注意：GameConfig, PriceTable, WeaponData, ArmorData 等配置已在 config.js 中定义
// Utils 工具函数库在 utils.js 中定义
// QuadTree 四叉树类在 QuadTree.js 中定义

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.gameState = 'menu';
    this.gold = 500;
    this.escapes = 0;
    this.bossKills = 0;
    this.bagCapacity = GameConfig.BAG_BASE_CAPACITY;
    this.warehouse = [];
    this.collection = {};
    this.bagUpgrades = 0;
    this.highDropMode = false;

    this.mapWidth = GameConfig.MAP_WIDTH;
    this.mapHeight = GameConfig.MAP_HEIGHT;
    this.tileSize = GameConfig.TILE_SIZE;

    this.player = null;
    this.monsters = [];
    this.boss = null;
    this.containers = [];
    this.obstacles = [];
    this.items = [];
    this.bullets = [];
    this.particles = [];
    this.swingEffects = [];

    this.camera = { x: 0, y: 0 };
    this.mouse = { x: 0, y: 0, down: false };
    this.keys = {};

    this.lastTime = 0;
    this.survivalTime = 0;
    this.kills = 0;
    this.goldFound = 0;

    this.isSearching = false;
    this.searchingContainer = null;
    this.searchStartTime = 0;
    this.searchDuration = GameConfig.SEARCH_DURATION;

    this.currentLootItems = [];
    this.pickedLootFlags = [];
    this.imageCache = {};
    this.preloadedImages = {};

    this.escapeTimer = 0;
    this.isInEscapeZone = false;
    this.escapeDuration = GameConfig.ESCAPE_DURATION;

    this.minimapCanvas = document.getElementById('minimapCanvas');
    this.minimapCtx = this.minimapCanvas?.getContext('2d');
    this.minimapSize = 200;

    this._errorCount = 0;

    this.initUI();
    this.bindEvents();
    this.loadData();
    this.preloadGameImages();
    this.initLoop();
  }

  resizeCanvas() {
    this.canvas.width = this.canvas.clientWidth || window.innerWidth;
    this.canvas.height = this.canvas.clientHeight || window.innerHeight;
  }

  initLoop() {
    const step = (ts) => {
      try {
        const delta = Math.min(GameConfig.MAX_DELTA, ts - this.lastTime);
        this.lastTime = ts;
        if (this.gameState === 'playing') {
          this.survivalTime += delta;
          this.update(delta);
        }
        this.render();
      } catch (err) {
        console.error('主循环异常:', err);
        this._errorCount++;
        if (this._errorCount < 5) {
          this.showLog('⚠️ 游戏异常: ' + (err.message || err), '#ef4444');
        }
      }
      requestAnimationFrame(step);
    };
    this.lastTime = performance.now();
    requestAnimationFrame(step);
  }

  loadData() {
    try {
      const saved = localStorage.getItem('goldenAdventure');
      if (saved) {
        const data = JSON.parse(saved);
        this.gold = data.gold || 500;
        this.escapes = data.escapes || 0;
        this.bossKills = data.bossKills || 0;
        this.bagCapacity = data.bagCapacity || 10;
        this.warehouse = data.warehouse || [];
        this.collection = data.collection || {};
        this.bagUpgrades = data.bagUpgrades || 0;
      }
    } catch (e) { console.warn('存档读取失败', e); }
    this.updateMenuStats();
  }

  saveData() {
    try {
      localStorage.setItem('goldenAdventure', JSON.stringify({
        gold: this.gold, escapes: this.escapes,
        bossKills: this.bossKills, bagCapacity: this.bagCapacity,
        warehouse: this.warehouse, collection: this.collection,
        bagUpgrades: this.bagUpgrades
      }));
    } catch (e) { console.warn('存档保存失败', e); }
  }

  initUI() {
    this.ui = {
      mainMenu: document.getElementById('mainMenu'),
      loadoutScreen: document.getElementById('loadoutScreen'),
      gameScreen: document.getElementById('gameScreen'),
      // 密钥系统
      keycodeInput: document.getElementById('keycodeInput'),
      keycodeSubmitBtn: document.getElementById('keycodeSubmitBtn'),
      keycodeToggleBtn: document.getElementById('keycodeToggleBtn'),
      keycodeStatus: document.getElementById('keycodeStatus'),
      gameOverModal: document.getElementById('gameOverModal'),
      deathModal: document.getElementById('deathModal'),
      health: document.getElementById('health'),
      armor: document.getElementById('armor'),
      weapon: document.getElementById('weapon'),
      kills: document.getElementById('kills'),
      survivalTime: document.getElementById('survivalTime'),
      inventoryCount: document.getElementById('inventoryCount'),
      goldFound: document.getElementById('goldFound'),
      monsterDialog: document.getElementById('monsterDialog'),
      dialogContent: document.getElementById('dialogContent'),
      searchPrompt: document.getElementById('searchPrompt'),
      pickupPrompt: document.getElementById('pickupPrompt'),
      escapePrompt: document.getElementById('escapePrompt'),
      escapeGold: document.getElementById('escapeGold'),
      inventoryPanel: document.getElementById('inventoryPanel'),
      inventoryGrid: document.getElementById('inventoryGrid'),
      inventoryValue: document.getElementById('inventoryValue'),
      lootLog: document.getElementById('lootLog'),
      searchProgress: document.getElementById('searchProgress'),
      searchProgressFill: document.getElementById('searchProgressFill'),
      searchLabel: document.getElementById('searchLabel'),
      lootModal: document.getElementById('lootModal'),
      lootModalTitle: document.getElementById('lootModalTitle'),
      lootModalInfo: document.getElementById('lootModalInfo'),
      lootItemsList: document.getElementById('lootItemsList'),
      lootBagUsed: document.getElementById('lootBagUsed'),
      lootBagMax: document.getElementById('lootBagMax'),
      lootPickAllBtn: document.getElementById('lootPickAllBtn'),
      lootCloseBtn: document.getElementById('lootCloseBtn'),
      lootCloseBtn2: document.getElementById('lootCloseBtn2'),
      // 模态框
      shopModal: document.getElementById('shopModal'),
      shopContent: document.getElementById('shopContent'),
      warehouseModal: document.getElementById('warehouseModal'),
      warehouseContent: document.getElementById('warehouseContent'),
      collectionModal: document.getElementById('collectionModal'),
      collectionContent: document.getElementById('collectionContent'),
      collectionBonusList: document.getElementById('collectionBonusList'),
      colTotalCount: document.getElementById('colTotalCount'),
      colTotalBonus: document.getElementById('colTotalBonus'),
    };
    
    // 创建悬浮窗（放在body末尾，避免被父元素裁剪）
    const tooltip = document.createElement('div');
    tooltip.id = 'itemTooltip';
    tooltip.className = 'item-tooltip hidden';
    tooltip.innerHTML = '<div class="tooltip-title"></div><div class="tooltip-content"></div>';
    document.body.appendChild(tooltip);
    this.ui.itemTooltip = tooltip;
  }

  hideAllModals() {
    if (this.ui.shopModal) this.ui.shopModal.classList.add('hidden');
    if (this.ui.warehouseModal) this.ui.warehouseModal.classList.add('hidden');
    if (this.ui.collectionModal) this.ui.collectionModal.classList.add('hidden');
    if (this.ui.lootModal) this.ui.lootModal.classList.add('hidden');
  }

  bindEvents() {
    console.log('Binding events...');
    
    // 检查按钮元素是否存在
    const startBtn = document.getElementById('startGameBtn');
    const shopBtn = document.getElementById('shopBtn');
    const collectionBtn = document.getElementById('collectionBtn');
    const inventoryBtn = document.getElementById('inventoryBtn');
    
    console.log('Buttons found:', {
      startBtn: !!startBtn,
      shopBtn: !!shopBtn,
      collectionBtn: !!collectionBtn,
      inventoryBtn: !!inventoryBtn
    });
    
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (this.gameState !== 'playing') return;
      if (e.code === 'Escape') this.toggleInventory();
      if (e.code === 'Tab') { e.preventDefault(); this.toggleInventory(); }
      if (e.code === 'KeyE') this.handleInteract();
      if (e.code === 'Digit1') this.useSupplyByType('smallHealth');
      if (e.code === 'Digit2') this.useSupplyByType('bigHealth');
      if (e.code === 'Digit3') this.useSupplyByType('armorRepair');
      if (e.code === 'Digit4') this.useSupplyByType('grenade');
    });
    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });
    this.canvas.addEventListener('mousedown', () => { this.mouse.down = true; });
    this.canvas.addEventListener('mouseup', () => { this.mouse.down = false; });

    document.getElementById('startGameBtn').addEventListener('click', () => {
      console.log('Start Game button clicked!');
      this.showLoadout();
    });
    document.getElementById('shopBtn').addEventListener('click', () => {
      console.log('Shop button clicked!');
      this.openShopModal();
    });
    document.getElementById('collectionBtn').addEventListener('click', () => {
      console.log('Collection button clicked!');
      this.openCollectionModal();
    });
    document.getElementById('inventoryBtn').addEventListener('click', () => {
      console.log('Inventory button clicked!');
      // 主菜单时打开仓库，游戏进行中打开局内背包
      if (this.gameState === 'playing') {
        this.toggleInventory();
      } else {
        this.openWarehouseModal();
      }
    });
    document.getElementById('confirmLoadoutBtn').addEventListener('click', () => this.startGame());
    document.getElementById('clearLoadoutBtn').addEventListener('click', () => this.clearLoadout());
    document.getElementById('backToMenuBtn').addEventListener('click', () => this.backToMenu());
    document.getElementById('gameOverBtn').addEventListener('click', () => this.backToMenu());
    document.getElementById('deathBtn').addEventListener('click', () => this.showLoadout());
    document.getElementById('closeInventory').addEventListener('click', () => this.toggleInventory());

    // 模态框关闭按钮
    document.getElementById('closeShopModal').addEventListener('click', () => this.hideAllModals());
    document.getElementById('closeWarehouseModal').addEventListener('click', () => this.hideAllModals());
    document.getElementById('closeCollectionModal').addEventListener('click', () => this.hideAllModals());

    // 点击模态框外部关闭
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.hideAllModals();
      });
    });

    this.ui.lootCloseBtn.addEventListener('click', () => this.closeLootModal());
    this.ui.lootCloseBtn2.addEventListener('click', () => this.closeLootModal());
    this.ui.lootPickAllBtn.addEventListener('click', () => this.lootPickAll());

    document.querySelectorAll('.shop-tab').forEach(tab => {
      tab.addEventListener('click', () => this.changeShopTab(tab.dataset.tab));
    });

    // ============ 密钥系统事件 ============
    const submitKeycode = () => {
      const input = this.ui.keycodeInput;
      const code = (input.value || '').trim().toLowerCase();
      input.value = '';
      if (code === 'bhm') {
        this.setHighDropMode(true);
      } else if (code.length > 0) {
        this.flashKeycodeStatus('❌ 密钥错误', false);
      }
    };
    this.ui.keycodeSubmitBtn.addEventListener('click', submitKeycode);
    this.ui.keycodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitKeycode();
    });
    this.ui.keycodeToggleBtn.addEventListener('click', () => this.setHighDropMode(false));
  }

  // ============ 密钥系统 —— 超高爆率模式 ============
  setHighDropMode(on) {
    this.highDropMode = !!on;
    const status = this.ui.keycodeStatus;
    if (status) {
      status.textContent = on ? '⭐ 超高爆率模式（仅掉金/红品）' : '💤 普通模式';
      status.classList.toggle('active', on);
    }
    if (this.ui.keycodeInput) this.ui.keycodeInput.classList.toggle('hidden', on);
    if (this.ui.keycodeSubmitBtn) this.ui.keycodeSubmitBtn.classList.toggle('hidden', on);
    if (this.ui.keycodeToggleBtn) this.ui.keycodeToggleBtn.classList.toggle('hidden', !on);
  }

  flashKeycodeStatus(msg, active) {
    const status = this.ui.keycodeStatus;
    if (!status) return;
    const prevText = status.textContent;
    const prevActive = status.classList.contains('active');
    status.textContent = msg;
    status.classList.toggle('active', active);
    setTimeout(() => {
      status.textContent = prevText;
      status.classList.toggle('active', prevActive);
    }, 1500);
  }

  // 图鉴物品定义（可收集获得属性加成的物品）
  static COLLECTION_ITEMS = {
    coins:      { icon: '🪙', name: '少量金币',    rarity: 'white',   desc: '最基础的货币' },
    cloth:      { icon: '🧻', name: '破布条',       rarity: 'white',   desc: '普通布料' },
    stone:      { icon: '🪨', name: '奇怪石头',     rarity: 'white',   desc: '光滑的石头' },
    herb:       { icon: '🌿', name: '神秘草药',     rarity: 'green',   desc: '可入药的植物' },
    key:        { icon: '🗝️', name: '古钥匙',       rarity: 'green',   desc: '锈迹斑斑的钥匙' },
    gem:        { icon: '💎', name: '宝石',         rarity: 'green',   desc: '闪耀的小宝石' },
    medal:      { icon: '🎖️', name: '勋章',         rarity: 'blue',    desc: '一枚老旧勋章' },
    sapphire:   { icon: '🔷', name: '蓝宝石',       rarity: 'blue',    desc: '深邃的蓝色宝石' },
    emerald:    { icon: '💚', name: '翡翠',         rarity: 'blue',    desc: '翠绿欲滴' },
    ancientScroll:{ icon:'📜', name:'古老卷轴',    rarity: 'purple',  desc: '记载神秘符文的卷轴' },
    royalRing:  { icon: '💍', name: '王室戒指',     rarity: 'purple',  desc: '镶嵌的宝石隐隐发光' },
    starGem:    { icon: '💠', name: '星辉石',       rarity: 'purple',  desc: '蕴含星光的宝石' },
    crown:      { icon: '👑', name: '金冠',         rarity: 'gold',    desc: '高贵典雅的王冠' },
    chalice:    { icon: '🏆', name: '黄金圣杯',     rarity: 'gold',    desc: '古老仪式的圣器' },
    ruby:       { icon: '❤️', name: '红宝石',       rarity: 'gold',    desc: '散发血色红光' },
    goldBar:    { icon: '🟨', name: '金条',         rarity: 'gold',    desc: '沉甸甸的金条' },
    demonEye:   { icon: '👁️', name: '恶魔之眼',     rarity: 'red',     desc: '散发着不祥的气息', price: 3000 },
    darkCrystal:{ icon: '🔮', name: '暗物质水晶',   rarity: 'red',     desc: '散发危险气息', price: 3200 },
    dragonHeart:{ icon: '❤️‍🔥', name:'龙之心',      rarity: 'red',     desc: '仍在有力跳动！', price: 3500 },
    africanHeart:{ icon: '💎', name: '非洲之心',    rarity: 'red',     desc: '传说级宝藏，价值连城！', price: 1314520 },
    // 特殊收集品
    wuKujia:    { icon: '🩲', name: '吴昕磊的裤衩',    rarity: 'green',   desc: '散发着淡淡的忧伤' },
    yangYantou: { icon: '🚬', name: '杨卓彤的烟头',    rarity: 'white',   desc: '只剩烟蒂，尚有余温' },
    xuZhenti:   { icon: '📚', name: '徐文俊的考研习题', rarity: 'blue',    desc: '满书的笔记，看得出很努力' },
    xueYiluan:  { icon: '💵', name: '薛毅乐掉的钱',    rarity: 'gold',    desc: '钞票散落一地，捡起来！' },
    // Boss 特殊掉落（核心）
    deltaHeart:   { icon: '👿', name: '哥布林王核心', rarity: 'red', desc: '蕴含哥布林王的力量', price: 3000 },
    firekirinCore:{ icon: '🐉', name: '兽神核心',    rarity: 'red', desc: '烈焰兽神的力量结晶', price: 3800 },
    erdtreeBless: { icon: '🌳', name: '古树精华',    rarity: 'red', desc: '古老树木的生命精华', price: 3300 },
    sandevistan:  { icon: '🤖', name: '战神核心',    rarity: 'red', desc: '机械战神的能量核心', price: 3600 },
    legendaryCore:{ icon: '💎', name: '传说核心',    rarity: 'red', desc: '传说级核心，蕴含强大力量', price: 4000 },
    // BOSS掉落收集品 - 白色
    bossTooth:    { icon: '🦷', name: '怪物牙齿',    rarity: 'white', desc: 'BOSS掉落的牙齿' },
    brokenHorn:   { icon: '🦴', name: '断裂角骨',    rarity: 'white', desc: '断裂的怪物角' },
    darkScale:    { icon: '📏', name: '暗黑鳞片',    rarity: 'white', desc: '坚硬的暗黑鳞片' },
    demonClaw:    { icon: 'Sharp', name: '恶魔利爪', rarity: 'white', desc: '锋利的爪刃' },
    ancientCoin:  { icon: '🪙', name: '古代金币',    rarity: 'white', desc: '古老的钱币' },
    rustyKey:     { icon: '🗝️', name: '生锈钥匙',    rarity: 'white', desc: '不知道能开什么锁' },
    mysteriousRune:{ icon: '✡️', name: '神秘符文',  rarity: 'white', desc: '无法理解的符文' },
    petrifiedEye: { icon: '👁️', name: '石化眼球',    rarity: 'white', desc: '永远凝视的眼睛' },
    // BOSS掉落收集品 - 绿色
    giantHeart:   { icon: '❤️', name: '巨人之心',    rarity: 'green', desc: '仍在跳动的心脏' },
    phoenixFeather:{ icon: '🪶', name: '凤凰羽毛',  rarity: 'green', desc: '永不熄灭的火焰' },
    moonstone:    { icon: '🌙', name: '月光石',      rarity: 'green', desc: '吸收月光的宝石' },
    shadowEssence:{ icon: '🌑', name: '暗影精华',    rarity: 'green', desc: '纯粹的黑暗能量' },
    dragonScale:  { icon: '🐉', name: '龙鳞',        rarity: 'green', desc: '真正的龙鳞' },
    holyWater:    { icon: '🧪', name: '圣水',        rarity: 'green', desc: '净化邪恶的圣水' },
    giantCrystal: { icon: '💠', name: '巨型水晶',    rarity: 'green', desc: '蕴含魔力的水晶' },
    // BOSS掉落收集品 - 蓝色（游戏致敬）
    soulCinder:      { icon: '🔥', name: '灰烬之魂',      rarity: 'blue', desc: 'Dark Souls 致敬' },
    lordvessel:      { icon: '⚱️', name: '王器',          rarity: 'blue', desc: '连接诸神的容器' },
    triforceShard:   { icon: '🔺', name: '三角神力碎片',  rarity: 'blue', desc: 'Zelda传说' },
    masterSwordHilt: { icon: '⚔️', name: '大师剑柄',      rarity: 'blue', desc: '圣剑的残留' },
    phoenixDown:     { icon: '🐦', name: '不死鸟之羽',    rarity: 'blue', desc: 'FF经典道具' },
    crystalShard:    { icon: '💎', name: '水晶碎片',      rarity: 'blue', desc: 'FF水晶的碎片' },
    worldTreeLeaf:   { icon: '🍃', name: '世界树之叶',    rarity: 'blue', desc: '北欧神话' },
    philosophersStone:{ icon: '🟠', name: '贤者之石',   rarity: 'blue', desc: '炼金终极物质' },
    // BOSS掉落收集品 - 紫色（高级神器）
    dragonSoul:       { icon: '🐲', name: '巨龙之魂',      rarity: 'purple', desc: 'WoW经典坐骑来源' },
    ashbringerShard:  { icon: '⚔️', name: '灰烬使者碎片',  rarity: 'purple', desc: '圣骑士神器' },
    eldenRemembrance: { icon: '👑', name: '艾尔登追忆',    rarity: 'purple', desc: 'Elden Ring致敬' },
    runebladeFragment:{ icon: '🗡️', name: '符文剑碎片',   rarity: 'purple', desc: '霜之哀伤的残片' },
    voidCrystal:      { icon: '💠', name: '虚空水晶',      rarity: 'purple', desc: '来自虚空的力量' },
    chaosEmerald:     { icon: '💚', name: '混沌翡翠',      rarity: 'purple', desc: 'Sonic的力量之源' },
    arcOfCovenant:    { icon: '📦', name: '约柜碎片',      rarity: 'purple', desc: '圣经中的圣物' },
    samsaraOrb:       { icon: '🔮', name: '轮回宝珠',      rarity: 'purple', desc: '东方神话瑰宝' },
    // BOSS掉落收集品 - 金色（传说级）
    elderWand:   { icon: '🪄', name: '老魔杖',      rarity: 'gold', desc: '哈利波特最强魔杖' },
    oneRing:     { icon: '💍', name: '至尊魔戒',    rarity: 'gold', desc: '魔戒之王' },
    infinityStone:{ icon: '💎', name: '无限宝石',   rarity: 'gold', desc: '漫威宇宙神器' },
    excalibur:   { icon: '⚔️', name: '王者之剑',    rarity: 'gold', desc: '亚瑟王的圣剑' },
    hammerOfThor:{ icon: '🔨', name: '雷神之锤',    rarity: 'gold', desc: 'Mjolnir' },
    pandorasBox: { icon: '📦', name: '潘多拉魔盒',  rarity: 'gold', desc: '释放所有邪恶' },
    philosopherStone:{ icon: '💎', name: '贤者之石', rarity: 'gold', desc: '点石成金' },
    holyGrail:   { icon: '🏆', name: '圣杯',        rarity: 'gold', desc: '基督最后的晚餐' },
    // BOSS掉落收集品 - 红色（究极神器）
    deathNote:      { icon: '📕', name: '死亡笔记',    rarity: 'red', desc: '写下名字即可杀人', price: 3200 },
    tesseract:      { icon: '📐', name: '宇宙魔方',    rarity: 'red', desc: '空间宝石', price: 3500 },
    soulStone:      { icon: '💀', name: '灵魂宝石',    rarity: 'red', desc: '需要献祭挚爱', price: 3400 },
    elderSign:      { icon: '☉', name: '长者之印',    rarity: 'red', desc: '克苏鲁神话', price: 3100 },
    necronomicon:   { icon: '📖', name: '死灵之书',    rarity: 'red', desc: '召唤旧日支配者', price: 3300 },
    trueHolyGrail:  { icon: '👑', name: '真圣杯',      rarity: 'red', desc: '实现任何愿望', price: 3700 },
    omnitrix:       { icon: '⌚', name: 'Omnitrix',     rarity: 'red', desc: '少年骇客变身器', price: 3400 },
    ultimateWeapon: { icon: '🔫', name: '究极武器',    rarity: 'red', desc: 'FF系列终极兵器', price: 3600 },
  };

  // 图鉴属性加成（每收集N件对应类型额外获得）
  static COLLECTION_BONUSES = [
    { threshold: 3,  stat: 'maxHealth', val: 5,  desc: '生命上限 +5' },
    { threshold: 6,  stat: 'maxHealth', val: 10, desc: '生命上限 +10' },
    { threshold: 10, stat: 'damage',    val: 3,  desc: '伤害 +3' },
    { threshold: 15, stat: 'damage',    val: 5,  desc: '伤害 +5' },
    { threshold: 20, stat: 'armor',    val: 3,  desc: '护甲 +3' },
    { threshold: 25, stat: 'armor',    val: 5,  desc: '护甲 +5' },
    { threshold: 30, stat: 'speed',    val: 0.3,desc: '移速 +0.3' },
    { threshold: 40, stat: 'maxHealth',val: 20, desc: '生命上限 +20' },
    { threshold: 50, stat: 'damage',   val: 8,  desc: '伤害 +8' },
    { threshold: 60, stat: 'maxHealth',val: 25, desc: '生命上限 +25' },
  ];

  // 从图鉴动态生成指定品质的掉落池（高爆率模式使用）
  static getCollectionPoolByRarity(rarity) {
    const pool = [];
    for (const [id, data] of Object.entries(Game.COLLECTION_ITEMS)) {
      if (data.rarity === rarity) {
        pool.push({ id, ...data });
      }
    }
    return pool;
  }

  // 获取所有图鉴中未点亮的物品总数（用于显示感叹号）
  getUnlitCollectionCount() {
    return Game.COLLECTION_COUNT - this.getCollectionTotal();
  }

  // 判断仓库中是否存在"可点亮图鉴、但图鉴尚未点亮"的物品
  hasWarehouseItemsToUnlock() {
    for (const w of this.warehouse) {
      if (!w || !w.id) continue;
      if (!Game.COLLECTION_ITEMS[w.id]) continue;  // 仓库物品不在图鉴中
      if (this.collection[w.id]) continue;         // 该物品已点亮过
      return true;
    }
    return false;
  }

  // 品质基础价格表（全局唯一数据源，供各处使用）
  static RARITY_BASE_PRICES = { white: 50, green: 150, blue: 350, purple: 700, gold: 1500, red: 3000 };

  // 补给品定义（不在图鉴中，但可从容器掉落）
  static SUPPLY_ITEMS = [
    { id: 'smallHealth', name: '小血包', icon: '🧪', price: 30, rarity: 'white', desc: '恢复30生命', isSupply: true, effect: 'heal', amount: 30 },
    { id: 'bigHealth', name: '大血包', icon: '💉', price: 70, rarity: 'green', desc: '恢复70生命', isSupply: true, effect: 'heal', amount: 70 },
    { id: 'armorRepair', name: '护甲修复', icon: '🔧', price: 40, rarity: 'white', desc: '修复25护甲', isSupply: true, effect: 'repair', amount: 25 },
    { id: 'grenade', name: '手雷', icon: '💣', price: 60, rarity: 'green', desc: '范围伤害', isSupply: true, effect: 'damage', amount: 45 }
  ];

  // 图鉴物品总数（缓存计算结果）
  static COLLECTION_COUNT = Object.keys(Game.COLLECTION_ITEMS).length;

  getCollectionBonus() {
    const total = Object.values(this.collection).reduce((s, v) => s + v, 0);
    let bonus = { maxHealth: 0, damage: 0, armor: 0, speed: 0 };
    for (const b of Game.COLLECTION_BONUSES) {
      if (total >= b.threshold) bonus[b.stat] = b.val;
    }
    return bonus;
  }

  getCollectionTotal() {
    // 已点亮种数（每种只要收集过 >= 1 就算 1）
    return Object.values(this.collection).filter(v => v > 0).length;
  }

  // 判断物品是否可进入图鉴（收集品，不是装备/补给）
  isCollectible(item) {
    if (!item) return false;
    if (item.type === 'weapon' || item.type === 'armor' || item.isSupply) return false;
    return true;
  }

  addToCollection(item) {
    if (!item || !item.id) return false;
    if (!this.isCollectible(item)) return false;
    if (this.collection[item.id]) return false;
    this.collection[item.id] = 1;
    return true;
  }

  getItemPrice(item) {
    if (!item) return 0;
    if (typeof item.price === 'number' && item.price > 0) return item.price;
    if (PriceTable[item.id]) return PriceTable[item.id];
    // 找不到精确映射时按品质估算
    const base = 20;
    const mult = GameConfig.RARITY_MULT[item.rarity] || 1;
    return base * mult;
  }

  updateMenuStats() {
    const mg = document.getElementById('menuGold');
    const mc = document.getElementById('menuBagCapacity');
    const mcol = document.getElementById('menuCollection');
    if (mg) mg.textContent = this.gold;
    if (mc) mc.textContent = this.bagCapacity;

    const total = Game.COLLECTION_COUNT;
    const collected = this.getCollectionTotal();
    const hasUnlockable = this.hasWarehouseItemsToUnlock();
    if (mcol) {
      mcol.textContent = collected + '/' + total + (hasUnlockable ? ' ❗' : '');
    }

    // 在图鉴按钮上也显示感叹号提示（仅当仓库有可点亮物品时）
    const cBtn = document.getElementById('collectionBtn');
    if (cBtn) {
      cBtn.textContent = (hasUnlockable ? '❗ ' : '') + '📖 收藏图鉴';
    }

    const loadGold = document.querySelector('#loadoutGold b');
    const shopGold = document.querySelector('#shopGold b');
    const whGold = document.querySelector('#warehouseGold b');
    if (loadGold) loadGold.textContent = this.gold;
    if (shopGold) shopGold.textContent = this.gold;
    if (whGold) whGold.textContent = this.gold;
  }

  hideAllScreens() {
    [this.ui.mainMenu, this.ui.loadoutScreen, this.ui.gameScreen].forEach(s => s && s.classList.add('hidden'));
    this.ui.gameOverModal.classList.add('hidden');
    this.ui.deathModal.classList.add('hidden');
    this.hideAllModals();
  }

  backToMenu() {
    // 归还loadout中的物品到仓库（避免装备被吞）
    if (this.loadout && this.loadout.length > 0) {
      this.loadout.forEach(item => {
        if (item) {
          this.warehouse.push({ ...item });
        }
      });
      this.loadout = [];
      this.saveData();
    }
    this.hideAllScreens();
    this.ui.mainMenu.classList.remove('hidden');
    this.gameState = 'menu';
    this.updateMenuStats();
  }

  showLoadout() {
    this.loadout = [];
    this.hideAllScreens();
    this.ui.loadoutScreen.classList.remove('hidden');
    this.renderLoadout();
  }

  renderLoadout() {
    const weaponGrid = document.getElementById('weaponGrid');
    const armorGrid = document.getElementById('armorGrid');
    const supplyGrid = document.getElementById('supplyGrid');
    const loadoutSlots = document.getElementById('loadoutSlots');
    const loadMax = document.getElementById('loadoutMax');
    if (loadMax) loadMax.textContent = this.bagCapacity;

    const weapons = [
      { id: 'pistol', name: '制式手枪', icon: 'weapon/sq.png', damage: 18, price: 50, rarity: 'white',
        desc: '基础武器', type: 'ranged', itemType: 'weapon',
        bulletSpeed: 9, bulletCount: 1, bulletSpread: 0, bulletRange: 400,
        particleColor: '#ffb400', particleCount: 4, model: 'weapon/sq.png', modelColor: '#333',
        shape: 'gun', knockback: 5, attackSpeed: 1.0 },
      { id: 'rifle', name: '突击步枪', icon: 'weapon/tjbq.png', damage: 16, price: 150, rarity: 'blue',
        desc: '随着使用时间逐渐提升攻速', type: 'ranged', itemType: 'weapon',
        bulletSpeed: 11, bulletCount: 1, bulletSpread: 0, bulletRange: 600,
        particleColor: '#4ade80', particleCount: 3, attackSpeed: 0.5, model: 'weapon/tjbq.png',
        modelColor: '#2d5', shape: 'rifle', knockback: 4 },
      { id: 'eldenSword', name: '月影巨剑', icon: 'weapon/yydj.png', damage: 65, price: 400, rarity: 'purple',
        desc: '扇形挥砍 · 强力击退', type: 'melee', itemType: 'weapon',
        range: 170, sweepAngle: Math.PI * 0.85, // 大角度扇形，半径增大
        particleColor: '#a855f7', particleCount: 12, model: 'weapon/yydj.png',
        modelColor: '#c4b5fd', shape: 'greatsword', aoeRange: 170,
        knockback: 15, attackSpeed: 0.65 }, // 强力击退，较慢攻速
      { id: 'fireKirin', name: '火麒麟', icon: 'weapon/hql.png', damage: 48, price: 500, rarity: 'gold',
        desc: '火焰弹 · 持续伤害', type: 'ranged', itemType: 'weapon',
        bulletSpeed: 6, bulletCount: 1, bulletSpread: 0, bulletRange: 450,
        particleColor: '#ef4444', particleCount: 6,
        fireEffect: true, burnDamage: 8, burnDuration: 3000, model: 'weapon/hql.png',
        modelColor: '#ff6b6b', shape: 'firearm', knockback: 5, attackSpeed: 0.7 },
      { id: 'shotgun', name: '霰弹枪', icon: 'weapon/xdq.png', damage: 12, price: 200, rarity: 'blue',
        desc: '大角度扇形 · 近距离强力', type: 'ranged', itemType: 'weapon',
        bulletSpeed: 10, bulletCount: 12, bulletSpread: 0.45, bulletRange: 220,
        particleColor: '#fbbf24', particleCount: 8, model: 'weapon/xdq.png',
        modelColor: '#f59e0b', shape: 'shotgun', knockback: 9, attackSpeed: 0.45 },
      { id: 'katana', name: '武士刀', icon: 'weapon/wsd.png', damage: 42, price: 280, rarity: 'purple',
        desc: '长条突刺 · 冲刺近战', type: 'melee', itemType: 'weapon',
        range: 200, thrustWidth: 50,
        particleColor: '#06b6d4', particleCount: 10, attackSpeed: 1.3,
        dashDistance: 30, model: 'weapon/wsd.png', modelColor: '#67e8f9',
        shape: 'katana', knockback: 14 }
    ];
    const armors = [
      { id: 'light', name: '轻甲', icon: '🛡️', defense: 35, maxDurability: 90, price: 80, rarity: 'white', desc: '轻便灵活 · 移速-10%', itemType: 'armor', speedMod: 0.9 },
      { id: 'medium', name: '中甲', icon: '🛡️', defense: 60, maxDurability: 140, price: 180, rarity: 'blue', desc: '平衡防护 · 移速-20%', itemType: 'armor', speedMod: 0.8 },
      { id: 'heavy', name: '重甲', icon: '🛡️', defense: 100, maxDurability: 180, price: 350, rarity: 'purple', desc: '全面防护 · 移速-30%', itemType: 'armor', speedMod: 0.7 },
      { id: 'cyber', name: '机械外骨骼', icon: '🦾', defense: 80, maxDurability: 150, price: 450, rarity: 'gold', desc: '移速+5% · 搜索+50%', itemType: 'armor', speedMod: 1.05, searchSpeedMod: 1.5 }
    ];
    const supplies = [
      { id: 'smallHealth', name: '小血包', icon: '🧪', heal: 30, price: 30, rarity: 'white', desc: '恢复30生命', isSupply: true, effect: 'heal', amount: 30 },
      { id: 'bigHealth', name: '大血包', icon: '💉', heal: 70, price: 70, rarity: 'green', desc: '恢复70生命', isSupply: true, effect: 'heal', amount: 70 },
      { id: 'armorRepair', name: '护甲修复', icon: '🔧', repair: 25, price: 40, rarity: 'white', desc: '修复25护甲', isSupply: true, effect: 'repair', amount: 25 },
      { id: 'grenade', name: '手雷', icon: '💣', damage: 45, price: 60, rarity: 'green', desc: '范围伤害', isSupply: true, effect: 'damage', amount: 45 }
    ];

    weaponGrid.innerHTML = ''; armorGrid.innerHTML = ''; supplyGrid.innerHTML = ''; loadoutSlots.innerHTML = '';
    weapons.forEach(w => this.createItemCard(w, weaponGrid, 'weapon'));
    armors.forEach(a => this.createItemCard(a, armorGrid, 'armor'));
    supplies.forEach(s => this.createItemCard(s, supplyGrid, 'supply'));

    // 渲染独立装备槽
    const wSlot = document.getElementById('equippedWeaponSlot');
    const wName = document.getElementById('equippedWeaponName');
    const aSlot = document.getElementById('equippedArmorSlot');
    const aName = document.getElementById('equippedArmorName');
    if (wSlot && wName) {
      if (this.equippedWeapon) {
        const wIcon = this.getIconHtml(this.equippedWeapon.icon, 'item-img-icon');
        wSlot.innerHTML = wIcon;
        wSlot.className = 'equip-slot rarity-' + (this.equippedWeapon.rarity || 'white');
        wName.textContent = this.equippedWeapon.name;
      } else {
        wSlot.innerHTML = '';
        wSlot.className = 'equip-slot empty';
        wName.textContent = '未选择';
      }
    }
    if (aSlot && aName) {
      if (this.equippedArmor) {
        const aIcon = this.getIconHtml(this.equippedArmor.icon, 'item-img-icon');
        aSlot.innerHTML = aIcon;
        aSlot.className = 'equip-slot rarity-' + (this.equippedArmor.rarity || 'white');
        aName.textContent = this.equippedArmor.name;
      } else {
        aSlot.innerHTML = '';
        aSlot.className = 'equip-slot empty';
        aName.textContent = '未选择';
      }
    }

    // 背包格子（只显示补给）
    for (let i = 0; i < this.bagCapacity; i++) {
      const slot = document.createElement('div');
      slot.className = 'loadout-slot' + (this.loadout[i] ? ' filled' : '');
      slot.innerHTML = this.loadout[i] ? this.getIconHtml(this.loadout[i].icon, 'item-img-icon') : '';
      loadoutSlots.appendChild(slot);
    }
    const ce = document.getElementById('loadoutCount');
    if (ce) ce.textContent = this.loadout.filter(Boolean).length;
  }

  createItemCard(item, parent, type) {
    const card = document.createElement('div');
    card.className = 'item-card rarity-' + (item.rarity || 'white');
    card.dataset.type = type;
    card.dataset.itemId = item.id;
    const price = this.getItemPrice(item);
    const warehouseCount = this.warehouse.filter(w => w && w.id === item.id).length;
    // 独立槽位已装备标记
    const isEquipped = (type === 'weapon' && this.equippedWeapon && this.equippedWeapon.id === item.id)
      || (type === 'armor' && this.equippedArmor && this.equippedArmor.id === item.id);
    if (isEquipped) card.classList.add('equipped');
    let priceText = warehouseCount > 0
      ? `<span style="color:#4ade80">📦 仓库 ${warehouseCount}</span>`
      : `<span>💰 ${price}</span>`;
    const iconHtml = this.getIconHtml(item.icon, 'item-img-icon');
    
    // 补给品显示详细信息
    let supplyDetails = '';
    if (type === 'supply') {
      if (item.effect === 'heal') {
        supplyDetails = `<div style="color:#ef4444;font-size:0.65rem;margin-top:2px">+${item.amount} 生命值</div>`;
      } else if (item.effect === 'repair') {
        supplyDetails = `<div style="color:#60a5fa;font-size:0.65rem;margin-top:2px">+${item.amount} 护甲值</div>`;
      } else if (item.effect === 'damage') {
        supplyDetails = `<div style="color:#fbbf24;font-size:0.65rem;margin-top:2px">造成 ${item.amount} 伤害</div>`;
      }
    }
    
    card.innerHTML = `
      <div class="item-icon">${iconHtml}</div>
      <div class="item-name">${item.name}${isEquipped ? ' <span style="color:#fbbf24">✓已装</span>' : ''}</div>
      <div class="item-desc">${item.desc || ''}</div>
      ${supplyDetails}
      <div class="item-price">${priceText}</div>
    `;
    card.addEventListener('click', () => this.toggleLoadoutItem({ ...item, itemType: type }));
    
    // 为武器和护甲添加悬浮窗事件
    if (type === 'weapon' || type === 'armor') {
      card.addEventListener('mouseenter', (e) => this.showItemTooltip(item, type, card, e));
      card.addEventListener('mouseleave', () => this.hideItemTooltip());
    }
    
    parent.appendChild(card);
  }

  showItemTooltip(item, type, card, event) {
    const tooltip = this.ui && this.ui.itemTooltip ? this.ui.itemTooltip : document.getElementById('itemTooltip');
    if (!tooltip) return;
    
    const titleEl = tooltip.querySelector('.tooltip-title');
    const contentEl = tooltip.querySelector('.tooltip-content');
    
    // 设置标题（带颜色）
    const rarityColors = {
      white: '#ccc', green: '#4ade80', blue: '#60a5fa',
      purple: '#c084fc', gold: '#ffd700', red: '#ef4444'
    };
    const color = rarityColors[item.rarity] || '#fff';
    // 获取武器类型图标（忽略图片文件名）
    const weaponIcons = { pistol: '🔫', rifle: '🔫', shotgun: '💥', sword: '⚔️', katana: '🗡️', flamethrower: '🔥' };
    const displayIcon = weaponIcons[item.id] || '';
    titleEl.innerHTML = `<span style="color:${color}">${displayIcon} ${item.name}</span>`;
    
    let content = '';
    
    if (type === 'weapon') {
      content += `<div class="tooltip-row"><span class="label">伤害</span><span class="value damage">${item.damage}</span></div>`;
      
      if (item.attackSpeed) {
        const cd = Math.round((350 - item.damage * 2) / item.attackSpeed);
        content += `<div class="tooltip-row"><span class="label">攻击间隔</span><span class="value">${cd}ms</span></div>`;
      }
      
      if (item.bulletRange) {
        content += `<div class="tooltip-row"><span class="label">射程</span><span class="value">${item.bulletRange}</span></div>`;
      }
      
      if (item.knockback) {
        content += `<div class="tooltip-row"><span class="label">击退力</span><span class="value">${item.knockback}</span></div>`;
      }
      
      if (item.bulletCount > 1) {
        content += `<div class="tooltip-row"><span class="label">子弹数量</span><span class="value">${item.bulletCount}</span></div>`;
      }
      
      // 武器特性说明
      if (item.id === 'rifle') {
        content += `<div style="margin-top:8px;color:#4ade80;font-size:0.75rem">⚡ 攻速随使用时间提升</div>`;
        content += `<div style="color:rgba(255,255,255,0.5);font-size:0.72rem">3秒后达到峰值2.0</div>`;
      } else if (item.id === 'shotgun') {
        content += `<div style="margin-top:8px;color:#fbbf24;font-size:0.75rem">⚡ 霰弹无穿透无敌帧</div>`;
      } else if (item.fireEffect) {
        content += `<div style="margin-top:8px;color:#ef4444;font-size:0.75rem">🔥 附带灼烧效果</div>`;
        content += `<div style="color:rgba(255,255,255,0.5);font-size:0.72rem">${item.burnDamage}/秒 持续${item.burnDuration/1000}秒</div>`;
      } else if (item.id === 'katana') {
        content += `<div style="margin-top:8px;color:#06b6d4;font-size:0.75rem">⚔️ 突刺冲刺攻击</div>`;
      }
      
    } else if (type === 'armor') {
      // 计算减伤比例
      const mitigation = item.defense / (item.defense + 40);
      const mitigationPercent = (mitigation * 100).toFixed(1);
      
      content += `<div class="tooltip-row"><span class="label">防御力</span><span class="value defense">${item.defense}</span></div>`;
      content += `<div class="tooltip-row"><span class="label">减伤比例</span><span class="value defense">${mitigationPercent}%</span></div>`;
      content += `<div class="tooltip-row"><span class="label">耐久度</span><span class="value">${item.maxDurability}</span></div>`;
      
      // 额外效果
      if (item.speedMod) {
        const speedChange = ((item.speedMod - 1) * 100).toFixed(0);
        const speedText = speedChange > 0 ? `+${speedChange}%` : `${speedChange}%`;
        const speedColor = speedChange > 0 ? '#4ade80' : '#f97316';
        content += `<div class="tooltip-row"><span class="label">移动速度</span><span class="value speed" style="color:${speedColor}">${speedText}</span></div>`;
      }
      
      if (item.searchSpeedMod) {
        const searchChange = ((item.searchSpeedMod - 1) * 100).toFixed(0);
        content += `<div class="tooltip-row"><span class="label">搜索速度</span><span class="value speed">+${searchChange}%</span></div>`;
      }
    }
    
    contentEl.innerHTML = content;
    tooltip.classList.remove('hidden');
    
    // 定位到卡片右侧或下方
    setTimeout(() => {
      const cardRect = card.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      
      let x = cardRect.right + 12;
      let y = cardRect.top;
      
      // 水平边界检测：如果右侧放不下，放到左侧
      if (x + tooltipRect.width > window.innerWidth - 10) {
        x = cardRect.left - tooltipRect.width - 12;
      }
      
      // 如果左侧也放不下（卡片在最左边缘），放到下方
      if (x < 10) {
        x = cardRect.left;
        y = cardRect.bottom + 12;
      }
      
      // 垂直边界检测
      if (y + tooltipRect.height > window.innerHeight - 10) {
        y = window.innerHeight - tooltipRect.height - 10;
      }
      
      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
    }, 10);
  }

  hideItemTooltip() {
    const tooltip = this.ui && this.ui.itemTooltip ? this.ui.itemTooltip : document.getElementById('itemTooltip');
    if (tooltip) {
      tooltip.classList.add('hidden');
    }
  }

  toggleLoadoutItem(item) {
    const type = item.itemType;

    // ========== 武器：独立槽位 ==========
    if (type === 'weapon') {
      const same = this.equippedWeapon && this.equippedWeapon.id === item.id;
      if (same) {
        // 取消装备
        this.warehouse.push({ ...this.equippedWeapon });
        this.showLog(`↩️ ${this.equippedWeapon.icon} ${this.equippedWeapon.name} 已退回仓库`, 'white');
        this.equippedWeapon = null;
      } else if (this.equippedWeapon) {
        // 已装备另一把，换掉
        this.warehouse.push({ ...this.equippedWeapon });
        this.showLog(`↩️ ${this.equippedWeapon.icon} ${this.equippedWeapon.name} 已退回仓库`, 'white');
        this.equippedWeapon = this.getOrBuyItem(item);
      } else {
        this.equippedWeapon = this.getOrBuyItem(item);
      }
    }
    // ========== 护甲：独立槽位 ==========
    else if (type === 'armor') {
      const same = this.equippedArmor && this.equippedArmor.id === item.id;
      if (same) {
        this.warehouse.push({ ...this.equippedArmor });
        this.showLog(`↩️ ${this.equippedArmor.icon} ${this.equippedArmor.name} 已退回仓库`, 'white');
        this.equippedArmor = null;
      } else if (this.equippedArmor) {
        this.warehouse.push({ ...this.equippedArmor });
        this.showLog(`↩️ ${this.equippedArmor.icon} ${this.equippedArmor.name} 已退回仓库`, 'white');
        this.equippedArmor = this.getOrBuyItem(item);
      } else {
        this.equippedArmor = this.getOrBuyItem(item);
      }
    }
    // ========== 补给：占用背包格子 ==========
    else {
      const supplyItem = this.getOrBuyItem(item);
      if (!supplyItem) return; // 钱不够已弹日志
      const empty = this.loadout.findIndex(s => !s);
      const target = empty !== -1 ? empty : this.loadout.length;
      if (target >= this.bagCapacity) {
        this.showLog('⚠️ 背包已满', 'white');
        return;
      }
      this.loadout[target] = supplyItem;
    }

    this.renderLoadout();
    this.updateMenuStats();
  }

  // 获取或购买物品（返回 null 表示金币不足）
  getOrBuyItem(item) {
    const whIdx = this.warehouse.findIndex(w => w && w.id === item.id);
    let finalItem = null;
    if (whIdx !== -1) {
      finalItem = { ...this.warehouse[whIdx] };
      this.warehouse.splice(whIdx, 1);
      if (!finalItem.itemType) finalItem.itemType = item.itemType;
      if (!finalItem.type && item.type) finalItem.type = item.type;
      // 补充武器属性
      if (finalItem.itemType === 'weapon') {
        const weaponDef = GameConfig.WEAPONS.find(w => w.id === item.id);
        if (weaponDef) {
          ['range','sweepAngle','knockback','thrustWidth','bulletSpeed','bulletCount','bulletSpread','bulletRange','particleColor','particleCount','attackSpeed','dashDistance'].forEach(k => {
            if (!finalItem[k] && weaponDef[k] !== undefined) finalItem[k] = weaponDef[k];
          });
        }
      }
      this.showLog(`📦 从仓库取出 ${finalItem.icon} ${finalItem.name}`, finalItem.rarity || 'white');
    } else {
      const price = this.getItemPrice(item);
      if (this.gold < price) {
        this.showLog(`💰 金币不足！需要 ${price} 金币购买 ${item.icon} ${item.name}`, 'white');
        return null;
      }
      this.gold -= price;
      finalItem = { ...item };
      this.showLog(`💰 购买 ${finalItem.icon} ${finalItem.name}（-${price}）`, item.rarity || 'white');
    }
    return finalItem;
  }

  clearLoadout() {
    // 武器/护甲退回仓库
    if (this.equippedWeapon) {
      this.warehouse.push({ ...this.equippedWeapon });
      this.equippedWeapon = null;
    }
    if (this.equippedArmor) {
      this.warehouse.push({ ...this.equippedArmor });
      this.equippedArmor = null;
    }
    this.loadout = [];
    this.renderLoadout();
  }

  openShopModal() { this.hideAllModals(); this.changeShopTab('weapons'); this.ui.shopModal.classList.remove('hidden'); }

  openWarehouseModal() { this.hideAllModals(); this.renderWarehouse(); this.ui.warehouseModal.classList.remove('hidden'); }

  openCollectionModal() { this.hideAllModals(); this.renderCollection(); this.ui.collectionModal.classList.remove('hidden'); }

  changeShopTab(tab) {
    document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
    const activeBtn = document.querySelector(`.shop-tab[data-tab="${tab}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    const content = this.ui.shopContent;
    if (!content) return;
    content.innerHTML = '';

    const items = {
      weapons: [
        { id: 'pistol', name: '制式手枪', icon: 'weapon/sq.png', price: 50, damage: 20, rarity: 'white', desc: '基础武器', type: 'ranged', itemType: 'weapon', bulletSpeed: 9, bulletCount: 1, bulletSpread: 0, bulletRange: 400, particleColor: '#ffb400', particleCount: 4, model: 'weapon/sq.png', modelColor: '#333', shape: 'gun', knockback: 5, attackSpeed: 1.0 },
        { id: 'rifle', name: '突击步枪', icon: 'weapon/tjbq.png', price: 150, damage: 18, rarity: 'blue', desc: '随着使用时间逐渐提升攻速', type: 'ranged', itemType: 'weapon', bulletSpeed: 11, bulletCount: 1, bulletSpread: 0, bulletRange: 600, particleColor: '#4ade80', particleCount: 3, attackSpeed: 0.5, model: 'weapon/tjbq.png', modelColor: '#2d5', shape: 'rifle', knockback: 4 },
        { id: 'eldenSword', name: '月影巨剑', icon: 'weapon/yydj.png', price: 400, damage: 50, rarity: 'purple', desc: '扇形挥砍 · 近战', type: 'melee', itemType: 'weapon', range: 170, sweepAngle: Math.PI * 0.85, particleColor: '#a855f7', particleCount: 12, model: 'weapon/yydj.png', modelColor: '#c4b5fd', shape: 'greatsword', aoeRange: 170, knockback: 15 },
        { id: 'fireKirin', name: '火麒麟', icon: 'weapon/hql.png', price: 500, damage: 55, rarity: 'gold', desc: '火焰弹 · 持续伤害', type: 'ranged', itemType: 'weapon', bulletSpeed: 6, bulletCount: 1, bulletSpread: 0, bulletRange: 450, particleColor: '#ef4444', particleCount: 6, fireEffect: true, burnDamage: 8, burnDuration: 3000, model: 'weapon/hql.png', modelColor: '#ff6b6b', shape: 'firearm', knockback: 5, attackSpeed: 0.7 },
        { id: 'shotgun', name: '霰弹枪', icon: 'weapon/xdq.png', price: 200, damage: 14, rarity: 'blue', desc: '大角度扇形 · 近距离强力', type: 'ranged', itemType: 'weapon', bulletSpeed: 10, bulletCount: 12, bulletSpread: 0.45, bulletRange: 220, particleColor: '#fbbf24', particleCount: 8, model: 'weapon/xdq.png', modelColor: '#f59e0b', shape: 'shotgun', knockback: 9, attackSpeed: 0.45 },
        { id: 'katana', name: '武士刀', icon: 'weapon/wsd.png', price: 280, damage: 36, rarity: 'purple', desc: '长条突刺 · 冲刺近战', type: 'melee', itemType: 'weapon', range: 200, thrustWidth: 50, particleColor: '#06b6d4', particleCount: 10, attackSpeed: 1.6, dashDistance: 30, model: 'weapon/wsd.png', modelColor: '#67e8f9', shape: 'katana', knockback: 14 }
      ],
      armor: [
        { id: 'light', name: '轻甲', icon: '🛡️', price: 80, defense: 35, maxDurability: 90, rarity: 'white', desc: '轻便灵活 · 移速-10%', itemType: 'armor', speedMod: 0.9 },
        { id: 'medium', name: '中甲', icon: '🛡️', price: 180, defense: 60, maxDurability: 140, rarity: 'blue', desc: '平衡防护 · 移速-20%', itemType: 'armor', speedMod: 0.8 },
        { id: 'heavy', name: '重甲', icon: '🛡️', price: 350, defense: 100, maxDurability: 180, rarity: 'purple', desc: '全面防护 · 移速-30%', itemType: 'armor', speedMod: 0.7 },
        { id: 'cyber', name: '机械外骨骼', icon: '🦾', price: 450, defense: 80, maxDurability: 150, rarity: 'gold', desc: '移速+5% · 搜索+50%', itemType: 'armor', speedMod: 1.05, searchSpeedMod: 1.5 }
      ],
      supplies: [
        { id: 'smallHealth', name: '小血包', icon: '🧪', price: 30, heal: 30, rarity: 'white', desc: '恢复30生命', isSupply: true, effect: 'heal', amount: 30 },
        { id: 'bigHealth', name: '大血包', icon: '💉', price: 70, heal: 70, rarity: 'green', desc: '恢复70生命', isSupply: true, effect: 'heal', amount: 70 },
        { id: 'armorRepair', name: '护甲修复', icon: '🔧', price: 40, repair: 25, rarity: 'white', desc: '修复25护甲', isSupply: true, effect: 'repair', amount: 25 },
        { id: 'grenade', name: '手雷', icon: '💣', price: 60, damage: 45, rarity: 'green', desc: '范围伤害', isSupply: true, effect: 'damage', amount: 45 }
      ],
      upgrade: []
    };

    if (tab === 'upgrade') {
      const currentLevel = this.bagUpgrades;
      const maxLevel = 4; // 10→15→20→25→30
      if (currentLevel >= maxLevel) {
        content.innerHTML = '<div class="empty-message">背包已升至最高等级（30格）</div>';
      } else {
        const nextCost = 300 + currentLevel * 150;
        const nextCap = 10 + (currentLevel + 1) * 5;
        const el = document.createElement('div');
        el.className = 'shop-item rarity-gold';
        el.innerHTML = `
          <div class="shop-item-info">
            <div class="shop-item-icon">🎒</div>
            <div class="shop-item-details">
              <h4>背包扩容（第${currentLevel + 1}次）</h4>
              <p>当前 ${this.bagCapacity} 格 → 扩容后 ${nextCap} 格</p>
            </div>
          </div>
          <div class="shop-item-price">💰 ${nextCost}</div>
        `;
        const btn = document.createElement('button');
        btn.className = 'shop-buy-btn';
        btn.textContent = '升级';
        btn.disabled = this.gold < nextCost;
        btn.addEventListener('click', () => this.buyBagUpgrade(nextCost, nextCap));
        el.appendChild(btn);
        content.appendChild(el);
      }
      this.updateMenuStats();
      return;
    }

    const list = items[tab] || [];
    list.forEach(item => {
      const price = this.getItemPrice(item);
      const el = document.createElement('div');
      el.className = 'shop-item rarity-' + (item.rarity || 'white');
      
      let iconHtml = item.icon || '📦';
      if (item.icon && typeof item.icon === 'string') {
        const lowerIcon = item.icon.toLowerCase();
        if (lowerIcon.endsWith('.png') || lowerIcon.endsWith('.jpg') || lowerIcon.endsWith('.jpeg')) {
          iconHtml = `<img src="${item.icon}?v=1" class="shop-img-icon" alt="${item.name}" />`;
        }
      }
      
      el.innerHTML = `
        <div class="shop-item-info">
          <div class="shop-item-icon-container">${iconHtml}</div>
          <div class="shop-item-details">
            <h4>${item.name} <span style="font-size:0.75em;color:#888;">· ${GameConfig.RARITY_NAMES[item.rarity || 'white']}</span></h4>
            <p>${item.desc}</p>
          </div>
        </div>
        <div class="shop-item-price">💰 ${price}</div>
      `;
      const btn = document.createElement('button');
      btn.className = 'shop-buy-btn';
      btn.textContent = '购买';
      btn.disabled = this.gold < price;
      btn.addEventListener('click', () => this.buyItem(item));
      el.appendChild(btn);
      content.appendChild(el);
    });
    this.updateMenuStats();
  }

  buyBagUpgrade(cost, newCap) {
    if (this.gold < cost) return;
    this.gold -= cost;
    this.bagCapacity = newCap;
    this.bagUpgrades++;
    this.updateMenuStats();
    this.changeShopTab('upgrade');
    this.saveData();
  }

  buyItem(item) {
    const price = this.getItemPrice(item);
    if (this.gold < price) return;
    this.gold -= price;
    this.warehouse.push({ ...item });
    this.updateMenuStats();
    const active = document.querySelector('.shop-tab.active');
    if (active) this.changeShopTab(active.dataset.tab);
    this.saveData();
  }

  renderWarehouse() {
    const content = this.ui.warehouseContent;
    if (!content) return;
    content.innerHTML = '';
    if (this.warehouse.length === 0) {
      content.innerHTML = '<div class="empty-message">仓库空空如也 —— 去副本搜刮后再来看看吧！</div>';
      return;
    }

    const grouped = {};
    const individualArmor = [];
    this.warehouse.forEach((item, idx) => {
      if (!item) return;
      if (item.itemType === 'armor') {
        individualArmor.push({ item: { ...item }, idx });
        return;
      }
      const key = item.id || ('_gen_' + idx);
      if (!grouped[key]) grouped[key] = { item: { ...item }, count: 0 };
      grouped[key].count++;
    });

    const rarityOrder = { red: 6, gold: 5, purple: 4, blue: 3, green: 2, white: 1 };
    const groupArr = Object.values(grouped).sort((a, b) =>
      (rarityOrder[b.item.rarity] || 0) - (rarityOrder[a.item.rarity] || 0));
    const armorArr = individualArmor.sort((a, b) =>
      (rarityOrder[b.item.rarity] || 0) - (rarityOrder[a.item.rarity] || 0));

    const totalKinds = groupArr.length + armorArr.length;
    const totalItems = groupArr.reduce((s, g) => s + g.count, 0) + armorArr.length;
    const header = document.createElement('div');
    header.className = 'warehouse-header-hint';
    header.innerHTML = `共 <b>${totalKinds}</b> 类 · 总数量 <b>${totalItems}</b> · 护甲可花金币维修（维修后耐久上限永久降低 ~10%）`;
    content.appendChild(header);

    armorArr.forEach(({ item }) => {
      const cur = Math.floor(item.currentDurability || 0);
      const mx = item.maxDurability || 100;
      const price = this.getItemPrice(item);
      const sellPrice = Math.floor(price * 0.6);
      const rarityLabel = GameConfig.RARITY_NAMES[item.rarity] || '普通';
      const needsRepair = cur < mx;
      const missingDur = mx - cur;
      const repairCost = Math.max(5, Math.ceil(missingDur * 0.8));
      const repairLoss = Math.ceil(missingDur * 0.1);
      const newMax = Math.max(20, mx - repairLoss);

      const row = document.createElement('div');
      row.className = 'warehouse-row rarity-' + (item.rarity || 'white');
      const durColor = cur >= mx * 0.8 ? '#4ade80' : (cur >= mx * 0.4 ? '#fbbf24' : '#ef4444');
      const armorIcon = this.getIconHtml(item.icon, 'wh-img-icon');
      row.innerHTML = `
        <div class="wh-row-icon">${armorIcon}</div>
        <div class="wh-row-info">
          <div class="wh-row-name">${item.name || '未命名护甲'}</div>
          <div class="wh-row-sub">
            品质：<span class="wh-rarity">${rarityLabel}</span> ·
            防御：<b>${item.defense || 0}</b> ·
            耐久：<span style="color:${durColor};font-weight:600">${cur}/${mx}</span> ·
            出售：💰 ${sellPrice}
          </div>
        </div>
      `;
      const btnBox = document.createElement('div');
      btnBox.className = 'wh-row-btns';
      if (needsRepair) {
        const repairBtn = document.createElement('button');
        repairBtn.className = 'wh-btn repair';
        repairBtn.textContent = `🔧 维修 (💰${repairCost})`;
        repairBtn.title = `修复至满耐久 · 上限永久降低 ${repairLoss}（${mx}→${newMax}）`;
        repairBtn.addEventListener('click', () => this.repairArmor(item, repairCost, newMax));
        btnBox.appendChild(repairBtn);
      } else {
        const okTag = document.createElement('span');
        okTag.className = 'wh-status-ok';
        okTag.textContent = '✅ 状态良好';
        btnBox.appendChild(okTag);
      }
      const sellBtn = document.createElement('button');
      sellBtn.className = 'wh-btn sell';
      sellBtn.textContent = `💰 出售`;
      sellBtn.title = `出售 1 件，获得 ${sellPrice} 金币`;
      sellBtn.addEventListener('click', () => this.sellItem(item.id, 'armor'));
      btnBox.appendChild(sellBtn);
      row.appendChild(btnBox);
      content.appendChild(row);
    });

    groupArr.forEach(group => {
      const item = group.item;
      const key = item.id;
      const price = this.getItemPrice(item);
      const sellPrice = Math.floor(price * 0.6);
      const rarityLabel = GameConfig.RARITY_NAMES[item.rarity] || '普通';

      const row = document.createElement('div');
      row.className = 'warehouse-row rarity-' + (item.rarity || 'white');
      const itemIcon = this.getIconHtml(item.icon, 'wh-img-icon');
      row.innerHTML = `
        <div class="wh-row-icon">${itemIcon}</div>
        <div class="wh-row-info">
          <div class="wh-row-name">${item.name || '未命名物品'} <span class="wh-row-count">x${group.count}</span></div>
          <div class="wh-row-sub">
            品质：<span class="wh-rarity">${rarityLabel}</span> ·
            价值：💰 <b>${price}</b> · 出售：💰 ${sellPrice}
          </div>
        </div>
      `;
      const btnBox = document.createElement('div');
      btnBox.className = 'wh-row-btns';
      const sellBtn = document.createElement('button');
      sellBtn.className = 'wh-btn sell';
      sellBtn.textContent = `💰 出售`;
      sellBtn.title = `出售 1 件，获得 ${sellPrice} 金币`;
      sellBtn.addEventListener('click', () => this.sellItem(key));
      btnBox.appendChild(sellBtn);
      if (group.count > 1) {
        const sellAllBtn = document.createElement('button');
        sellAllBtn.className = 'wh-btn sell-all';
        sellAllBtn.textContent = `全部(${group.count})`;
        sellAllBtn.title = `全部出售，获得 ${sellPrice * group.count} 金币`;
        sellAllBtn.addEventListener('click', () => this.sellAll(key));
        btnBox.appendChild(sellAllBtn);
      }
      row.appendChild(btnBox);
      content.appendChild(row);
    });
  }

  // 维修仓库中的护甲：修复当前耐久至满值，但永久降低耐久上限
  repairArmor(item, repairCost, newMax) {
    if (this.gold < repairCost) {
      this.showLog(`💰 金币不足，无法维修（需要 ${repairCost}）`, 'white');
      return;
    }
    const whIdx = this.warehouse.findIndex(w =>
      w && w.id === item.id && w.itemType === 'armor' &&
      Math.floor(w.currentDurability) === Math.floor(item.currentDurability || 0));
    const finalIdx = whIdx !== -1
      ? whIdx
      : this.warehouse.findIndex(w => w && w.id === item.id && w.itemType === 'armor');
    if (finalIdx === -1) return;
    this.gold -= repairCost;
    this.warehouse[finalIdx].currentDurability = newMax;
    this.warehouse[finalIdx].maxDurability = newMax;
    const oldMax = item.maxDurability || 100;
    const loss = oldMax - newMax;
    this.showLog(`🔧 维修 ${item.icon} ${item.name}：${item.currentDurability||0}/${oldMax} → ${newMax}/${newMax}（上限-${loss}）`, item.rarity || 'white');
    this.updateMenuStats();
    this.renderWarehouse();
    this.saveData();
  }

  sellItem(itemId, itemTypeHint) {
    let idx = -1;
    if (itemTypeHint === 'armor') {
      idx = this.warehouse.findIndex(i => i && i.id === itemId && i.itemType === 'armor');
    }
    if (idx === -1) {
      idx = this.warehouse.findIndex(i => i && i.id === itemId);
    }
    if (idx === -1) return;
    const item = this.warehouse[idx];
    const sellPrice = Math.floor(this.getItemPrice(item) * 0.6);
    this.gold += sellPrice;
    this.warehouse.splice(idx, 1);
    this.showLog(`💰 出售 ${item.icon || '📦'} ${item.name || '物品'} · 获得 ${sellPrice} 金币`, 'gold');
    this.updateMenuStats();
    this.renderWarehouse();
    this.saveData();
  }

  sellAll(itemId) {
    const matches = this.warehouse.filter(it => it && it.id === itemId);
    if (matches.length === 0) return;
    let totalGain = 0;
    matches.forEach(it => totalGain += Math.floor(this.getItemPrice(it) * 0.6));
    this.gold += totalGain;
    this.warehouse = this.warehouse.filter(it => !(it && it.id === itemId));
    this.showLog(`💰 出售 ${matches.length} 件 · 获得 ${totalGain} 金币`, 'gold');
    this.updateMenuStats();
    this.renderWarehouse();
    this.saveData();
  }

  renderCollection() {
    const content = this.ui.collectionContent;
    if (!content) return;
    content.innerHTML = '';

    const total = Game.COLLECTION_COUNT;
    const collected = this.getCollectionTotal();
    const hasUnlockable = this.hasWarehouseItemsToUnlock();

    // 更新标题：仓库中有可点亮物品时显示感叹号
    const colTitle = document.getElementById('collectionTitle');
    if (colTitle) {
      colTitle.textContent = (hasUnlockable ? '❗ ' : '') + '📖 收藏图鉴 (' + collected + '/' + total + ')';
    }

    const bonus = this.getCollectionBonus();
    const totalBonus = bonus.maxHealth + bonus.damage + bonus.armor + Math.round(bonus.speed * 10) / 10;
    if (this.ui.colTotalCount) this.ui.colTotalCount.textContent = collected;
    if (this.ui.colTotalBonus) this.ui.colTotalBonus.textContent = totalBonus;

    // 属性加成面板（按属性合并统计）
    const bonusList = this.ui.collectionBonusList;
    if (bonusList) {
      bonusList.innerHTML = '';
      const allBonuses = Game.COLLECTION_BONUSES;
      const unlocked = allBonuses.filter(b => total >= b.threshold);
      if (unlocked.length === 0) {
        bonusList.innerHTML = '<div class="collection-empty">收集物品解锁属性加成</div>';
      } else {
        const statLabels = {
          maxHealth: '生命上限',
          damage: '伤害',
          armor: '护甲',
          speed: '移速'
        };
        const merged = {};
        unlocked.forEach(b => {
          if (!merged[b.stat]) merged[b.stat] = 0;
          merged[b.stat] += b.val;
        });
        Object.keys(merged).forEach(stat => {
          const div = document.createElement('div');
          div.className = 'bonus-item';
          const label = statLabels[stat] || stat;
          const val = stat === 'speed' ? merged[stat].toFixed(1) : merged[stat];
          div.innerHTML = `<span class="bonus-item-name">${label} +${val}</span><span class="bonus-item-val">✓</span>`;
          bonusList.appendChild(div);
        });
      }
    }

    // 图鉴物品列表 — 点亮 / 未点亮两种状态
    const allItems = Game.COLLECTION_ITEMS;
    Object.keys(allItems).forEach(id => {
      const def = allItems[id];
      const lit = (this.collection[id] || 0) > 0;
      const inWarehouse = this.warehouse.filter(w => w && w.id === id).length;

      const div = document.createElement('div');
      div.className = 'collection-item rarity-' + (def.rarity || 'white') + (lit ? '' : ' unlit');
      div.innerHTML = `
        <div class="col-item-icon">${lit ? def.icon : '❓'}</div>
        <div class="col-item-info">
          <div class="col-item-name">${lit ? def.name : '???'}</div>
          <div class="col-item-desc">${lit ? def.desc : '未收集'}</div>
        </div>
      `;
      if (lit) {
        const badge = document.createElement('div');
        badge.className = 'col-item-badge';
        badge.textContent = '已收录';
        div.appendChild(badge);
      } else if (inWarehouse > 0) {
        const fillBtn = document.createElement('button');
        fillBtn.className = 'col-fill-btn';
        fillBtn.textContent = `填充 (${inWarehouse})`;
        fillBtn.title = '从仓库取出一个加入图鉴';
        fillBtn.addEventListener('click', () => this.fillCollectionFromWarehouse(id));
        div.appendChild(fillBtn);
      }
      content.appendChild(div);
    });

    if (Object.keys(allItems).length === 0) {
      content.innerHTML = '<div class="collection-empty">暂无收集品</div>';
    }
  }

  // 从仓库取出物品填充图鉴
  fillCollectionFromWarehouse(itemId) {
    if (this.collection[itemId]) {
      this.showLog('该收集品已点亮过', 'white');
      return;
    }
    const idx = this.warehouse.findIndex(w => w && w.id === itemId);
    if (idx === -1) return;
    const item = this.warehouse[idx];
    if (!this.addToCollection(item)) return;
    this.warehouse.splice(idx, 1);
    const bonus = this.getCollectionBonus();
    this.showLog(`📖 ${item.name} 已加入图鉴！属性加成：生命+${bonus.maxHealth} 伤害+${bonus.damage} 护甲+${bonus.armor} 速度+${bonus.speed.toFixed(1)}`, item.rarity || 'white');
    this.renderCollection();
    this.updateMenuStats();
    this.saveData();
  }

  startGame() {
    this.hideAllScreens();
    this.ui.gameScreen.classList.remove('hidden');
    this.survivalTime = 0;
    this.kills = 0;
    this.goldFound = 0;
    this.items = [];
    this.bullets = [];
    this.particles = [];
    this.swingEffects = [];
    this.humanEnemies = [];
    if (this.ui.lootLog) this.ui.lootLog.innerHTML = '';

    this.initMap();
    this.initPlayer();
    this.initMonsters();
    this.initContainers();
    this.spawnBoss();

    this.initQuadTree();

    // 一切就绪后再开始游戏循环
    this.gameState = 'playing';
  }

  initQuadTree() {
    this.quadTree = new QuadTree(0, 0, this.mapWidth, this.mapHeight, 8, 6);
    this.updateQuadTree();
  }

  updateQuadTree() {
    if (!this.quadTree) return;
    this.quadTree.clear();

    for (const container of this.containers) {
      this.quadTree.insert(container);
    }
    for (const item of this.items) {
      this.quadTree.insert(item);
    }
    for (const monster of this.monsters) {
      if (monster.health > 0) this.quadTree.insert(monster);
    }
    for (const enemy of this.humanEnemies || []) {
      if (enemy.health > 0) this.quadTree.insert(enemy);
    }
  }

  // ============================================================
  // 🌍 地形网格预生成 - Wang Tileset 边匹配系统
  // ============================================================
  //
  // 设计思路：
  //   1. 预先生成一张地形网格（每个格子：0=泥土 / 1=草地）
  //   2. 用"草地斑块"模拟田野 + "小径"模拟乡村小路
  //   3. 对每个格子计算 4 条边（上/下/左/右）相邻格子的地形类型
  //   4. 根据 4 条边的组合（16 种），从预制瓦片表里选最匹配的瓦片
  //
  // 这样不同地形之间会"自然衔接"——没有突兀的边界。
  //
  // 边编码（每位：1=草地，0=泥土）：
  //   bit0 (1) = 上边  bit1 (2) = 下边
  //   bit2 (4) = 左边  bit3 (8) = 右边
  // ============================================================

  initTerrainGrid() {
    const TILE = 60;
    const cols = Math.ceil(this.mapWidth / TILE);
    const rows = Math.ceil(this.mapHeight / TILE);

    // 0 = 泥土（路/田），1 = 草地
    const grid = [];
    for (let y = 0; y < rows; y++) {
      const row = new Array(cols).fill(0);
      grid.push(row);
    }

    // ---------- 第 1 步：生成基础草地背景 + 散布泥土斑块 ----------
    // 先填满草地，再挖出泥土斑块（这样草地占比更高）
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        grid[y][x] = 1;
      }
    }
    // 散布泥土斑块（田野/空地）
    const DIRT_PATCH_COUNT = 30;
    for (let i = 0; i < DIRT_PATCH_COUNT; i++) {
      const cx = Math.floor(Math.random() * cols);
      const cy = Math.floor(Math.random() * rows);
      const radius = 2 + Math.floor(Math.random() * 4);
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const d = Math.sqrt(dx * dx + dy * dy);
          const noise = Math.sin((cx + dx) * 12.9898 + (cy + dy) * 78.233) * 0.5;
          if (d <= radius + noise * 1.5) {
            const x = cx + dx, y = cy + dy;
            if (x >= 0 && x < cols && y >= 0 && y < rows) {
              grid[y][x] = 0;
            }
          }
        }
      }
    }
    // 额外散布大量小草地斑块（补充覆盖率，让草地更密集）
    const EXTRA_GRASS_PATCH = 40;
    for (let i = 0; i < EXTRA_GRASS_PATCH; i++) {
      const cx = Math.floor(Math.random() * cols);
      const cy = Math.floor(Math.random() * rows);
      const radius = 2 + Math.floor(Math.random() * 3);
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d <= radius) {
            const x = cx + dx, y = cy + dy;
            if (x >= 0 && x < cols && y >= 0 && y < rows) {
              grid[y][x] = 1;
            }
          }
        }
      }
    }

    // ---------- 第 2 步：添加"乡村小径" ----------
    const PATH_WIDTH = 1;
    const hPathCount = 2 + Math.floor(Math.random() * 2);
    for (let p = 0; p < hPathCount; p++) {
      const py = Math.floor((p + 0.5) * rows / hPathCount) + Math.floor(Math.random() * 3 - 1);
      for (let x = 0; x < cols; x++) {
        if (Math.random() < 0.05) continue;
        for (let w = -PATH_WIDTH; w <= PATH_WIDTH; w++) {
          const yy = py + w;
          if (yy >= 0 && yy < rows) grid[yy][x] = 0;
        }
      }
    }
    const vPathCount = 2 + Math.floor(Math.random() * 2);
    for (let p = 0; p < vPathCount; p++) {
      const px = Math.floor((p + 0.5) * cols / vPathCount) + Math.floor(Math.random() * 3 - 1);
      for (let y = 0; y < rows; y++) {
        if (Math.random() < 0.05) continue;
        for (let w = -PATH_WIDTH; w <= PATH_WIDTH; w++) {
          const xx = px + w;
          if (xx >= 0 && xx < cols) grid[y][xx] = 0;
        }
      }
    }
    for (let i = 0; i < 12; i++) {
      let x = Math.floor(Math.random() * cols);
      let y = Math.floor(Math.random() * rows);
      const steps = 8 + Math.floor(Math.random() * 12);
      let dir = Math.random() < 0.5 ? 'h' : 'v';
      for (let s = 0; s < steps; s++) {
        if (x < 0 || x >= cols || y < 0 || y >= rows) break;
        grid[y][x] = 0;
        if (Math.random() < 0.7) {
          if (dir === 'h') x += Math.random() < 0.5 ? -1 : 1;
          else y += Math.random() < 0.5 ? -1 : 1;
        } else {
          if (dir === 'h') { dir = 'v'; y += Math.random() < 0.5 ? -1 : 1; }
          else { dir = 'h'; x += Math.random() < 0.5 ? -1 : 1; }
        }
      }
    }

    // ---------- 第 3 步：Wang Tileset 边匹配映射 ----------
    this.wangTileMap = {
      0:  ['FieldsTile_01', 'FieldsTile_02', 'FieldsTile_07', 'FieldsTile_20', 'FieldsTile_21'],
      1:  ['FieldsTile_03', 'FieldsTile_18', 'FieldsTile_06'],
      2:  ['FieldsTile_05', 'FieldsTile_25', 'FieldsTile_22'],
      3:  ['FieldsTile_28', 'FieldsTile_06'],
      4:  ['FieldsTile_09', 'FieldsTile_29', 'FieldsTile_16'],
      5:  ['FieldsTile_06', 'FieldsTile_10'],
      6:  ['FieldsTile_16'],
      7:  ['FieldsTile_28'],
      8:  ['FieldsTile_24', 'FieldsTile_22', 'FieldsTile_30'],
      9:  ['FieldsTile_04', 'FieldsTile_26'],
      10: ['FieldsTile_22', 'FieldsTile_30'],
      11: ['FieldsTile_28'],
      12: ['FieldsTile_16'],
      13: ['FieldsTile_10'],
      14: ['FieldsTile_16'],
      15: ['FieldsTile_08', 'FieldsTile_12', 'FieldsTile_13', 'FieldsTile_14', 'FieldsTile_15']
    };

    // ---------- 第 4 步：预计算每个格子的贴图路径（关键：消除频闪） ----------
    // 用位置哈希作为伪随机，保证同一个格子每帧都用同一个贴图
    const tilePaths = [];
    for (let y = 0; y < rows; y++) {
      const row = new Array(cols);
      for (let x = 0; x < cols; x++) {
        const top    = (y > 0)        ? grid[y - 1][x] : 0;
        const bottom = (y < rows - 1) ? grid[y + 1][x] : 0;
        const left   = (x > 0)        ? grid[y][x - 1] : 0;
        const right  = (x < cols - 1) ? grid[y][x + 1] : 0;
        const code = (top ? 1 : 0) | (bottom ? 2 : 0) | (left ? 4 : 0) | (right ? 8 : 0);

        if (code === 15) {
          // 全草格：优先用草地1.png（80%），小概率用 FieldsTile 草地图片（20%）做微变化
          const grassTiles = ['草地1', '草地1', '草地1', '草地1', '草地1', '草地2', '草地3', 'FieldsTile_15'];
          const hash = (Math.sin(x * 37.1 + y * 91.7) * 43758.5453) % 1;
          const absHash = Math.abs(hash);
          row[x] = 'floor/' + grassTiles[Math.floor(absHash * grassTiles.length)] + '.png';
        } else {
          const candidates = this.wangTileMap[code] || this.wangTileMap[0];
          const hash = (Math.sin(x * 17.3 + y * 53.9 + code * 7.1) * 43758.5453) % 1;
          const absHash = Math.abs(hash);
          row[x] = 'floor/' + candidates[Math.floor(absHash * candidates.length)] + '.png';
        }
      }
      tilePaths.push(row);
    }

    this.terrainGrid = grid;
    this.tilePaths = tilePaths;
    this.terrainTileSize = TILE;
  }

  // 根据 (tx, ty) 网格坐标，返回应该绘制的瓦片路径（从预计算网格读取，无随机）
  getWangTilePath(tx, ty) {
    if (!this.tilePaths) return 'floor/草地1.png';
    const rows = this.tilePaths.length;
    const cols = this.tilePaths[0].length;
    if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return 'floor/草地1.png';
    return this.tilePaths[ty][tx];
  }
  // ============================================================

  initMap() {
    this.obstacles = [];
    // ========================================
    // 🌍 地形网格预生成（Wang Tileset 边匹配）
    // ========================================
    this.initTerrainGrid();
    // ========================================

    // 建筑群中心地标（数量 + 分布更广）
    const landmarks = [
      { cx: 420, cy: 480 }, { cx: 900, cy: 300 }, { cx: 1400, cy: 520 },
      { cx: 2050, cy: 420 }, { cx: 2700, cy: 700 }, { cx: 380, cy: 1100 },
      { cx: 1100, cy: 1200 }, { cx: 1800, cy: 1000 }, { cx: 2500, cy: 1400 },
      { cx: 600, cy: 1900 }, { cx: 1450, cy: 1850 }, { cx: 2200, cy: 2000 },
      { cx: 2900, cy: 1900 }, { cx: 400, cy: 2600 }, { cx: 1200, cy: 2750 },
      { cx: 2000, cy: 2800 }, { cx: 2800, cy: 2700 }
    ];
    // ========================================
    // 🏘️ 建筑生成 - 优化：统一大小 + 分散变体
    // ========================================
    const BUILDING_SIZE = 110;  // 统一建筑大小
    const MIN_SAME_VARIANT_DIST = 240;  // 同种建筑最小间距
    const buildingPlacements = [];  // 记录已放置建筑（用于间距检查）

    const tryPlaceBuilding = (x, y, size, variant) => {
      // 1. 边界检查
      if (x < 80 || y < 80 || x + size > this.mapWidth - 80 || y + size > this.mapHeight - 80) return false;
      // 2. 障碍物碰撞检查
      if (this.obstacles.some(o => this.rectsOverlap(o, { x: x - 10, y: y - 10, width: size + 20, height: size + 20 }))) return false;
      // 3. 同种建筑间距检查
      for (const p of buildingPlacements) {
        if (p.variant === variant) {
          const dist = this.distance(x + size/2, y + size/2, p.cx, p.cy);
          if (dist < MIN_SAME_VARIANT_DIST) return false;
        }
      }
      this.obstacles.push({ x, y, width: size, height: size, type: 'building', variant });
      buildingPlacements.push({ x, y, cx: x + size/2, cy: y + size/2, variant });
      return true;
    };

    // 建筑群中心：每群4-6个统一大小的建筑
    landmarks.forEach(lm => {
      const buildings = 4 + Math.floor(Math.random() * 3);
      const groupRadius = 80 + Math.random() * 100;
      // 圆周分布
      for (let i = 0; i < buildings; i++) {
        const angle = (Math.PI * 2 / buildings) * i + Math.random() * 0.3;
        const r = groupRadius + Math.random() * 40;
        const bx = Math.floor(lm.cx + Math.cos(angle) * r - BUILDING_SIZE / 2);
        const by = Math.floor(lm.cy + Math.sin(angle) * r - BUILDING_SIZE / 2);
        const variant = Math.floor(Math.random() * 8);
        tryPlaceBuilding(bx, by, BUILDING_SIZE, variant);
      }
    });
    // 独立散布建筑（统一大小 + 分散变体）
    for (let i = 0; i < 45; i++) {
      const bx = 150 + Math.floor(Math.random() * (this.mapWidth - 400));
      const by = 150 + Math.floor(Math.random() * (this.mapHeight - 400));
      const variant = Math.floor(Math.random() * 8);
      tryPlaceBuilding(bx, by, BUILDING_SIZE, variant);
    }
    // ========================================
    // 岩石 / 障碍物（更多）- 每种类型有固定大小 + 同种类型保持间距
    const obstacleConfigs = [
      { name: '小推车', width: 70, height: 55 },
      { name: '小车2', width: 65, height: 50 },
      { name: '水井', width: 55, height: 60 },
      { name: '铁砧', width: 60, height: 55 }
    ];
    const MIN_SAME_TYPE_DIST = 180;  // 同种类型最小间距
    const placedObstacles = [];  // 记录已放置的障碍物（用于间距检查）
    
    for (let i = 0; i < 110; i++) {
      const variant = Math.floor(Math.random() * obstacleConfigs.length);
      const config = obstacleConfigs[variant];
      let placed = false;
      let attempts = 0;
      
      while (!placed && attempts < 50) {
        attempts++;
        const x = 80 + Math.random() * (this.mapWidth - 160 - config.width);
        const y = 80 + Math.random() * (this.mapHeight - 160 - config.height);
        const w = config.width;
        const h = config.height;
        
        // 1. 检查与已有障碍物的碰撞
        if (this.obstacles.some(o => this.rectsOverlap(o, { x, y, width: w, height: h }))) continue;
        
        // 2. 检查与同种类型障碍物的间距
        const cx = x + w / 2;
        const cy = y + h / 2;
        const tooClose = placedObstacles.some(p => {
          if (p.variant === variant) {
            const dist = this.distance(cx, cy, p.cx, p.cy);
            return dist < MIN_SAME_TYPE_DIST;
          }
          return false;
        });
        
        if (!tooClose) {
          this.obstacles.push({ x, y, width: w, height: h, type: 'rock', variant });
          placedObstacles.push({ x, y, cx, cy, variant });
          placed = true;
        }
      }
    }
    // 移除装饰物（树木/灌木/水池）以保持画面简洁
    // 原有代码已注释，如需恢复请取消注释：
    /*
    // 树木 / 灌木（新增装饰元素但不阻挡通行）
    for (let i = 0; i < 150; i++) {
      const x = 60 + Math.random() * (this.mapWidth - 120);
      const y = 60 + Math.random() * (this.mapHeight - 120);
      const w = 28 + Math.random() * 18;
      const h = 28 + Math.random() * 18;
      if (this.obstacles.some(o => this.rectsOverlap(o, { x, y, width: w, height: h }))) continue;
      this.obstacles.push({ x, y, width: w, height: h, type: 'tree', variant: Math.floor(Math.random() * 3) });
    }
    // 水池装饰（视觉，不阻挡）
    for (let i = 0; i < 12; i++) {
      const x = 120 + Math.random() * (this.mapWidth - 240);
      const y = 120 + Math.random() * (this.mapHeight - 240);
      const w = 80 + Math.random() * 80;
      const h = 80 + Math.random() * 80;
      if (this.obstacles.some(o => this.rectsOverlap(o, { x, y, width: w, height: h }))) continue;
      this.obstacles.push({ x, y, width: w, height: h, type: 'pond' });
    }
    */
    this.playerSpawnPoint = this.findFreeSpot();

    let escapeX, escapeY, tries = 0;
    do {
      escapeX = 300 + Math.random() * (this.mapWidth - 600);
      escapeY = 300 + Math.random() * (this.mapHeight - 600);
      tries++;
      if (tries > 60) break;
    } while (this.distance(this.playerSpawnPoint.x, this.playerSpawnPoint.y, escapeX, escapeY) < 1200 ||
             this.obstacles.some(o => this.rectsOverlap(o, { x: escapeX - 40, y: escapeY - 40, width: 80, height: 80 })));
    this.escapePoint = { x: escapeX, y: escapeY, width: 60, height: 60 };
  }

  findFreeSpot() {
    for (let attempt = 0; attempt < 200; attempt++) {
      const x = 200 + Math.random() * (this.mapWidth - 400);
      const y = 200 + Math.random() * (this.mapHeight - 400);
      const box = { x: x - 40, y: y - 40, width: 80, height: 80 };
      if (!this.obstacles.some(o => this.rectsOverlap(o, box))) return { x, y };
    }
    return { x: this.mapWidth / 2, y: this.mapHeight / 2 };
  }

  rectsOverlap(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  distance(x1, y1, x2, y2) { return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2); }

  initPlayer() {
    const colBonus = this.getCollectionBonus();
    // 玩家属性：生命/速度来自基础+图鉴加成
    this.player = {
      x: this.playerSpawnPoint.x, y: this.playerSpawnPoint.y,
      width: 30, height: 30,
      health: 100 + colBonus.maxHealth,
      maxHealth: 100 + colBonus.maxHealth,
      armor: 0,
      speed: 2.2 + colBonus.speed, // 降低移动速度
      weapon: null,
      armorItem: null,
      inventory: [...this.loadout].filter(Boolean),
      facing: 0, attackCooldown: 0,
      colBonus,
      // 击退系统
      knockbackX: 0, knockbackY: 0,
      // 无敌时间系统
      invulnerable: false,
      invulnerabilityTimer: 0,
      invulnerabilityDuration: 800, // 玩家无敌时间 800ms
      // 突击步枪攻速提升系统
      rifleAttackTime: 0,
      lastRifleAttackTime: 0
    };
    // 从独立装备槽应用武器与护甲
    if (this.equippedWeapon) {
      this.player.weapon = this.equippedWeapon;
    }
    if (this.equippedArmor) {
      const md = this.equippedArmor.maxDurability || 100;
      this.player.armorItem = {
        id: this.equippedArmor.id, name: this.equippedArmor.name, icon: this.equippedArmor.icon,
        rarity: this.equippedArmor.rarity, defense: this.equippedArmor.defense,
        maxDurability: md,
        currentDurability: (typeof this.equippedArmor.currentDurability === 'number') ? this.equippedArmor.currentDurability : md,
        itemType: 'armor',
        speedMod: this.equippedArmor.speedMod,
        searchSpeedMod: this.equippedArmor.searchSpeedMod
      };
      this.player.armor = this.player.armorItem.currentDurability;
    }
    this.updateHUD();
  }

  initMonsters() {
    this.monsters = [];
    const types = [
      { id: 'goblin', icon: '👺', name: '哥布林', baseHp: 35, speed: 0.55, damage: 8, rarity: 'white', loot: 'green' },
      { id: 'skeleton', icon: '💀', name: '骷髅兵', baseHp: 40, speed: 0.5, damage: 10, rarity: 'white', loot: 'green' },
      { id: 'orc', icon: '👹', name: '兽人', baseHp: 65, speed: 0.45, damage: 14, rarity: 'green', loot: 'blue' },
      { id: 'slime', icon: '🟢', name: '史莱姆', baseHp: 25, speed: 0.3, damage: 5, rarity: 'white', loot: 'white' },
      { id: 'ghost', icon: '👻', name: '幽灵', baseHp: 30, speed: 0.6, damage: 9, rarity: 'green', loot: 'blue' },
      { id: 'wolf', icon: '🐺', name: '野狼', baseHp: 45, speed: 0.65, damage: 12, rarity: 'green', loot: 'blue' },
      { id: 'bat', icon: '🦇', name: '魔蝠', baseHp: 55, speed: 0.7, damage: 13, rarity: 'blue', loot: 'purple' }
    ];
    const taunts = ['你完蛋了！', '尝尝这个！', '入侵者！', '死吧！', '想跑？没门！', '你的装备归我了！', '嘿嘿嘿...'];
    const count = 14;
    let added = 0;
    for (let i = 0; i < count * 3 && added < count; i++) {
      const t = types[Math.floor(Math.random() * types.length)];
      const spot = this.findFreeSpot();
      if (this.distance(spot.x, spot.y, this.playerSpawnPoint.x, this.playerSpawnPoint.y) < 350) continue;
      this.monsters.push({
        ...t, x: spot.x, y: spot.y, width: 40, height: 40,
        maxHealth: t.baseHp, health: t.baseHp,
        damage: t.damage,
        hasTaunted: false, taunt: taunts[Math.floor(Math.random() * taunts.length)],
        attackTimer: 0, attackInterval: 1400,
        // 领地 AI
        homeX: spot.x, homeY: spot.y,
        baseTerritoryRange: 200,
        baseAlertRange: 150,
        territoryRange: 200,
        alertRange: 150,
        chaseExtension: 300,
        aggroDoubled: false,
        state: 'idle',
        wanderDirX: 0, wanderDirY: 0, lastMoveChange: 0,
        // 击退系统
        knockbackX: 0, knockbackY: 0,
        // 无敌时间系统（怪物无敌时间比玩家短）
        invulnerable: false,
        invulnerabilityTimer: 0,
        invulnerabilityDuration: 300 // 怪物无敌时间 300ms
      });
      added++;
    }
    // 初始化人类敌人（寻金者/探险家），超高爆率模式下不刷
    if (!this.highDropMode) this.initHumanEnemies();
  }

  // ============ 人类敌人系统 ============
  initHumanEnemies() {
    this.humanEnemies = [];
    const count = 2 + Math.floor(Math.random() * 2); // 2~3 个
    const portraits = ['🧑', '🧔', '👨', '🧓', '👩', '🧕', '🧑‍🎤', '🧑‍🚀'];
    const names = ['寻金者', '探险家', '盗墓客', '流浪剑客', '赏金猎人', '遗迹猎人', '徐文俊', '吴昕磊', '杨卓彤', '薛毅乐'];
    const weaponIds = ['pistol', 'rifle', 'eldenSword', 'fireKirin', 'shotgun', 'katana'];
    const armorIds = ['light', 'medium', 'heavy', 'cyber'];
    for (let i = 0; i < count; i++) {
      const spot = this.findFreeSpot();
      if (!spot) break;
      if (this.distance(spot.x, spot.y, this.playerSpawnPoint.x, this.playerSpawnPoint.y) < 600) continue;
      // 随机装备
      const wId = weaponIds[Math.floor(Math.random() * weaponIds.length)];
      const aId = armorIds[Math.floor(Math.random() * armorIds.length)];
      const weapon = this.buildWeaponById(wId);
      const armor = this.buildArmorById(aId);
      const maxHp = 80 + Math.floor(Math.random() * 50);
      const portraitIdx = Math.floor(Math.random() * portraits.length);
      const portrait = portraits[portraitIdx];
      const name = names[Math.floor(Math.random() * names.length)];
      this.humanEnemies.push({
        type: 'human',
        icon: portrait,
        name,
        x: spot.x, y: spot.y, width: 30, height: 30,
        maxHealth: maxHp, health: maxHp,
        speed: 1.6 + Math.random() * 0.5,
        baseSpeed: 1.6,
        weapon,
        armorItem: { ...armor, currentDurability: armor.maxDurability },
        defense: armor.defense,
        // 拾取上限
        inventory: [],
        inventoryCap: 5,
        // 状态机
        state: 'wander',  // wander | chase_player | chase_monster | combat | flee
        facing: Math.random() * Math.PI * 2,
        attackCooldown: 0,
        attackRange: (weapon.range || 100) + 10,
        // 仇恨范围
        baseAggroRangePlayer: 400,
        aggroRangePlayer: 400,
        aggroRangeMonster: 180,
        aggroDoubled: false,
        // AI 决策时间
        decisionTimer: 0,
        decisionInterval: 600,
        // 击退
        knockbackX: 0, knockbackY: 0,
        // 无敌
        invulnerable: false,
        invulnerabilityTimer: 0,
        invulnerabilityDuration: 300,
        // 装备价值（用于计算击败掉落）
        weaponValue: this.getItemPrice(weapon),
        armorValue: this.getItemPrice(armor)
      });
    }
  }

  // 构造武器数据（与商店一致）
  buildWeaponById(id) {
    const presets = {
      pistol:    { id:'pistol', name:'制式手枪', icon:'weapon/sq.png', price:50, damage:18, rarity:'white', type:'ranged', itemType:'weapon', bulletSpeed:9, bulletCount:1, bulletSpread:0, bulletRange:400, particleColor:'#ffb400', particleCount:4, model:'weapon/sq.png', modelColor:'#333', shape:'gun', knockback:5, attackSpeed:1.0 },
      rifle:     { id:'rifle', name:'突击步枪', icon:'weapon/tjbq.png', price:150, damage:16, rarity:'blue', type:'ranged', itemType:'weapon', bulletSpeed:11, bulletCount:1, bulletSpread:0, bulletRange:600, particleColor:'#4ade80', particleCount:3, attackSpeed:0.5, model:'weapon/tjbq.png', modelColor:'#2d5', shape:'rifle', knockback:4 },
      eldenSword:{ id:'eldenSword', name:'月影巨剑', icon:'weapon/yydj.png', price:400, damage:50, rarity:'purple', type:'melee', itemType:'weapon', range:170, sweepAngle:Math.PI*0.85, particleColor:'#a855f7', particleCount:12, model:'weapon/yydj.png', modelColor:'#c4b5fd', shape:'greatsword', aoeRange:170, knockback:15, attackSpeed:0.65 },
      fireKirin: { id:'fireKirin', name:'火麒麟', icon:'weapon/hql.png', price:500, damage:55, rarity:'gold', type:'ranged', itemType:'weapon', bulletSpeed:6, bulletCount:1, bulletSpread:0, bulletRange:450, particleColor:'#ef4444', particleCount:6, fireEffect:true, burnDamage:8, burnDuration:3000, model:'weapon/hql.png', modelColor:'#ff6b6b', shape:'firearm', knockback:5, attackSpeed:0.7 },
      shotgun:   { id:'shotgun', name:'霰弹枪', icon:'weapon/xdq.png', price:200, damage:14, rarity:'blue', type:'ranged', itemType:'weapon', bulletSpeed:10, bulletCount:12, bulletSpread:0.45, bulletRange:220, particleColor:'#fbbf24', particleCount:8, model:'weapon/xdq.png', modelColor:'#f59e0b', shape:'shotgun', knockback:9, attackSpeed:0.45 },
      katana:    { id:'katana', name:'武士刀', icon:'weapon/wsd.png', price:280, damage:36, rarity:'purple', type:'melee', itemType:'weapon', range:200, thrustWidth:50, particleColor:'#06b6d4', particleCount:10, attackSpeed:1.6, dashDistance:30, model:'weapon/wsd.png', modelColor:'#67e8f9', shape:'katana', knockback:14 }
    };
    return { ...presets[id] };
  }

  // 构造护甲数据
  buildArmorById(id) {
    const presets = {
      light:  { id:'light',  name:'轻甲',         icon:'🛡️', defense:35, maxDurability:90,  price:80,  rarity:'white',  desc:'轻便灵活 · 移速-10%', itemType:'armor', speedMod:0.9 },
      medium: { id:'medium', name:'中甲',         icon:'🛡️', defense:60, maxDurability:140, price:180, rarity:'blue',   desc:'平衡防护 · 移速-20%', itemType:'armor', speedMod:0.8 },
      heavy:  { id:'heavy',  name:'重甲',         icon:'🛡️', defense:100, maxDurability:180, price:350, rarity:'purple', desc:'全面防护 · 移速-30%', itemType:'armor', speedMod:0.7 },
      cyber:  { id:'cyber',  name:'机械外骨骼',   icon:'🦾', defense:80, maxDurability:150, price:450, rarity:'gold',   desc:'移速+5% · 搜索+50%', itemType:'armor', speedMod:1.05, searchSpeedMod:1.5 }
    };
    return { ...presets[id] };
  }

  spawnBoss() {
    if (Math.random() < 0.6) {
      const bossSize = 70;
      let sx, sy;
      let attempts = 0;
      const maxAttempts = 200;
      // —— 检测生成位置是否会卡进建筑 ——
      for (attempts = 0; attempts < maxAttempts; attempts++) {
        // 生成随机点（地图中央区域，避开边缘）
        const centerX = 200 + Math.random() * (this.mapWidth - 400);
        const centerY = 200 + Math.random() * (this.mapHeight - 400);
        // 计算BOSS左上角坐标（centerX/Y是BOSS中心点）
        const testX = centerX - bossSize / 2;
        const testY = centerY - bossSize / 2;
        // 检测BOSS矩形是否与任意障碍物重叠
        const bossRect = { x: testX, y: testY, width: bossSize, height: bossSize };
        const blocked = this.obstacles.some(o => this.isBlockingObstacle(o) && this.rectsOverlap(o, bossRect));
        if (!blocked) {
          // 检测该点到玩家出生点是否足够远
          if (this.distance(centerX, centerY, this.playerSpawnPoint.x, this.playerSpawnPoint.y) >= 800) {
            sx = testX; sy = testY; break;
          } else {
            // 距离太近，尝试地图对角线的另一个方向
            const altX = (this.mapWidth - centerX) - bossSize / 2;
            const altY = (this.mapHeight - centerY) - bossSize / 2;
            const altRect = { x: altX, y: altY, width: bossSize, height: bossSize };
            const altBlocked = this.obstacles.some(o => this.isBlockingObstacle(o) && this.rectsOverlap(o, altRect));
            if (!altBlocked) {
              sx = Math.max(100, Math.min(this.mapWidth - bossSize - 100, altX));
              sy = Math.max(100, Math.min(this.mapHeight - bossSize - 100, altY));
              break;
            }
          }
        }
      }
      // 兜底：多次尝试失败时强制将BOSS放置在地图中心，确保不会卡进建筑
      if (sx === undefined || sy === undefined) {
        sx = this.mapWidth / 2 - bossSize / 2;
        sy = this.mapHeight / 2 - bossSize / 2;
        // 最终兜底：确保不与建筑重叠，从出生点向四周扫描
        let searchR = 0;
        while (searchR < Math.max(this.mapWidth, this.mapHeight)) {
          let found = false;
          for (let ang = 0; ang < Math.PI * 2; ang += Math.PI / 8) {
            const tx = this.mapWidth / 2 + Math.cos(ang) * searchR - bossSize / 2;
            const ty = this.mapHeight / 2 + Math.sin(ang) * searchR - bossSize / 2;
            const tr = { x: tx, y: ty, width: bossSize, height: bossSize };
            if (tx > 50 && ty > 50 && tx < this.mapWidth - bossSize - 50 && ty < this.mapHeight - bossSize - 50 &&
                !this.obstacles.some(o => this.isBlockingObstacle(o) && this.rectsOverlap(o, tr))) {
              sx = tx; sy = ty; found = true; break;
            }
          }
          if (found) break;
          searchR += 80;
        }
      }

      const bossNames = [
        { name: '哥布林王', icon: '👿', special: 'deltaHeart' },
        { name: '烈焰兽神', icon: '🐉', special: 'firekirinCore' },
        { name: '古树化身', icon: '🌳', special: 'erdtreeBless' },
        { name: '机械战神', icon: '🤖', special: 'sandevistan' }
      ];
      const pick = bossNames[Math.floor(Math.random() * bossNames.length)];
      this.boss = {
        type: 'boss', name: pick.name, icon: pick.icon, specialLoot: pick.special,
        x: sx, y: sy, width: bossSize, height: bossSize,
        health: 600, maxHealth: 600,
        speed: 0.5, damage: 20,
        attackTimer: 0, attackInterval: 1800, phase: 1, specialAttackTimer: 0,
        taunt: '凡人，你竟敢踏入我的领地！', hasTaunted: false,
        invulnerable: false,
        invulnerabilityTimer: 0,
        invulnerabilityDuration: 300,
        knockbackX: 0, knockbackY: 0,
        knockbackResistance: 0.95
      };
    }
  }

  initContainers() {
    this.containers = [];
    const types = [
      { type: 'chest', icon: 'folder/mx.png', name: '宝箱' },
      { type: 'barrel', icon: 'folder/mt.png', name: '木桶' },
      { type: 'trash', icon: 'folder/ljt.png', name: '垃圾桶' },
      { type: 'bag', icon: 'folder/stb.png', name: '遗落手提包' },
      { type: 'crate', icon: 'folder/dyx.png', name: '弹药箱' }
    ];
    for (let i = 0; i < 22; i++) {
      const t = types[Math.floor(Math.random() * types.length)];
      let x, y, tries = 0;
      do {
        x = 120 + Math.random() * (this.mapWidth - 240);
        y = 120 + Math.random() * (this.mapHeight - 240);
        tries++;
        if (tries > 30) break;
      } while (this.obstacles.some(o => this.rectsOverlap(o, { x: x - 25, y: y - 25, width: 50, height: 50 })));
      // refreshTotal = 15~25秒的刷新时间
      this.containers.push({
        ...t, x, y, width: 30, height: 30,
        searched: false, hasLoot: Math.random() < 0.85,
        refreshTotal: 15000 + Math.random() * 10000,
        refreshTimer: 0
      });
    }
  }

  updateContainers(delta) {
    this.containers.forEach(c => {
      if (c.searched) {
        c.refreshTimer -= delta;
        if (c.refreshTimer <= 0) {
          // 重置为可搜索状态，重新生成战利品概率
          c.searched = false;
          c.refreshTimer = 0;
          c.hasLoot = Math.random() < 0.75;
        }
      }
    });
  }

  update(delta) {
    if (this.isSearching) this.updateSearching(delta);
    this.updatePlayer(delta);
    this.updateMonsters(delta);
    this.updateBoss(delta);
    this.updateHumanEnemies(delta);
    this.updateBullets(delta);
    this.updateParticles(delta);
    this.updateSwingEffects(delta);
    this.updateGrenades(delta);
    this.updateContainers(delta);
    this.updateQuadTree();
    this.checkCollisions();
    this.updateCamera();
    this.updateEscapeTimer(delta);
    this.updateHUD();
    this.renderMinimap();
  }

  updateSwingEffects(delta) {
    for (let i = this.swingEffects.length - 1; i >= 0; i--) {
      this.swingEffects[i].life -= delta;
      if (this.swingEffects[i].life <= 0) this.swingEffects.splice(i, 1);
    }
  }

  // 撤离计时器更新
  updateEscapeTimer(delta) {
    if (!this.escapePoint) return;
    
    const px = this.player.x + this.player.width / 2;
    const py = this.player.y + this.player.height / 2;
    const ex = this.escapePoint.x + this.escapePoint.width / 2;
    const ey = this.escapePoint.y + this.escapePoint.height / 2;
    const dist = this.distance(px, py, ex, ey);
    
    // 撤离点范围（更大的触发范围）
    const escapeRange = 100;
    
    if (dist < escapeRange) {
      this.isInEscapeZone = true;
      this.escapeTimer += delta;
      // 显示撤离倒计时提示
      if (this.ui.escapePrompt) {
        this.ui.escapePrompt.classList.remove('hidden');
        const remaining = Math.ceil((this.escapeDuration - this.escapeTimer) / 1000);
        if (remaining > 0) {
          this.ui.escapePrompt.innerHTML = `🚪 撤离中... <span style="color:#fbbf24">${remaining}秒</span>`;
        } else {
          this.escape();
        }
      }
    } else {
      this.isInEscapeZone = false;
      this.escapeTimer = 0;
      // 显示普通撤离提示
      if (this.ui.escapePrompt && !this.ui.escapePrompt.classList.contains('hidden')) {
        const totalValue = this.player.inventory.reduce((sum, item) => sum + this.getItemPrice(item), 0);
        this.ui.escapePrompt.innerHTML = `🚪 发现撤离点！进入范围开始撤离（当前价值：💰 <span id="escapeGold">${totalValue}</span>）`;
      }
    }
  }

  // 渲染小地图
  renderMinimap() {
    if (!this.minimapCtx || !this.player || !this.escapePoint) return;
    
    const ctx = this.minimapCtx;
    const size = this.minimapSize;
    
    // 确保 canvas 实际尺寸与显示尺寸一致
    if (this.minimapCanvas.width !== size || this.minimapCanvas.height !== size) {
      this.minimapCanvas.width = size;
      this.minimapCanvas.height = size;
    }
    
    const scale = size / Math.max(this.mapWidth, this.mapHeight);
    
    // 清空背景（完全透明，让 CSS 的半透明背景生效）
    ctx.clearRect(0, 0, size, size);
    
    // 半透明深色背景（圆角矩形）
    ctx.fillStyle = 'rgba(10, 20, 30, 0.3)';
    this.roundRect(ctx, 2, 2, size - 4, size - 4, 6);
    ctx.fill();
    
    // 半透明边框
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, 2, 2, size - 4, size - 4, 6);
    ctx.stroke();
    
    // 绘制建筑物（简化为灰色半透明方块）
    this.obstacles.forEach(o => {
      if (o.type === 'building') {
        const mx = o.x * scale;
        const my = o.y * scale;
        const mw = o.width * scale;
        const mh = o.height * scale;
        if (mw > 1 && mh > 1) {
          ctx.fillStyle = 'rgba(120, 120, 130, 0.4)';
          ctx.fillRect(mx, my, mw, mh);
        }
      }
    });
    
    // 绘制撤离点（黄色，带脉冲效果）
    const ex = this.escapePoint.x * scale + (this.escapePoint.width * scale) / 2;
    const ey = this.escapePoint.y * scale + (this.escapePoint.height * scale) / 2;
    
    // 撤离点外圈脉冲
    const pulse = 7 + Math.sin(performance.now() / 300) * 2;
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ex, ey, pulse, 0, Math.PI * 2);
    ctx.stroke();
    
    // 撤离点实心点
    ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
    ctx.beginPath();
    ctx.arc(ex, ey, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // 绘制 Boss（红色，带警告效果）
    if (this.boss) {
      const bx = this.boss.x * scale + (this.boss.width * scale) / 2;
      const by = this.boss.y * scale + (this.boss.height * scale) / 2;
      
      // Boss 外圈警告（半透明）
      ctx.strokeStyle = 'rgba(255, 32, 32, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bx, by, 8, 0, Math.PI * 2);
      ctx.stroke();
      
      // Boss 外圈光晕（半透明）
      ctx.fillStyle = 'rgba(255, 32, 32, 0.3)';
      ctx.beginPath();
      ctx.arc(bx, by, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // Boss 实心点
      ctx.fillStyle = 'rgba(255, 32, 32, 0.95)';
      ctx.beginPath();
      ctx.arc(bx, by, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // 绘制怪物（灰色小点）
    if (this.monsters) {
      this.monsters.forEach(m => {
        if (!m || m.health <= 0) return;
        const mx = m.x * scale + (m.width * scale) / 2;
        const my = m.y * scale + (m.height * scale) / 2;
        ctx.fillStyle = 'rgba(200, 100, 100, 0.6)';
        ctx.beginPath();
        ctx.arc(mx, my, 2, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    
    // 绘制人类敌人（蓝色小点）
    if (this.humanEnemies) {
      this.humanEnemies.forEach(h => {
        if (!h || h.health <= 0) return;
        const hx = h.x * scale + (h.width * scale) / 2;
        const hy = h.y * scale + (h.height * scale) / 2;
        ctx.fillStyle = 'rgba(96, 165, 250, 0.7)';
        ctx.beginPath();
        ctx.arc(hx, hy, 2, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    
    // 绘制玩家（绿色，带方向指示）
    const px = this.player.x * scale + (this.player.width * scale) / 2;
    const py = this.player.y * scale + (this.player.height * scale) / 2;
    
    // 玩家光晕
    ctx.fillStyle = 'rgba(74, 222, 128, 0.25)';
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // 玩家实心点
    ctx.fillStyle = 'rgba(74, 222, 128, 1)';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // 玩家方向指示
    ctx.fillStyle = 'rgba(74, 222, 128, 0.9)';
    ctx.beginPath();
    ctx.moveTo(px + Math.cos(this.player.facing) * 8, py + Math.sin(this.player.facing) * 8);
    ctx.lineTo(px + Math.cos(this.player.facing - 0.6) * 4, py + Math.sin(this.player.facing - 0.6) * 4);
    ctx.lineTo(px + Math.cos(this.player.facing + 0.6) * 4, py + Math.sin(this.player.facing + 0.6) * 4);
    ctx.closePath();
    ctx.fill();
  }
  
  // 辅助函数：绘制圆角矩形路径
  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  isBlockingObstacle(o) { return o.type === 'building' || o.type === 'rock' || o.type === 'wall'; }

  /**
   * 将实体从障碍物中推到最近的空地（用于解决BOSS穿墙追击后卡住的问题）
   * @param {Object} entity - 实体（必须有 x, y, width, height）
   */
  ejectFromObstacles(entity) {
    const ex = entity.x, ey = entity.y, ew = entity.width, eh = entity.height;
    // 算法：在8个方向上扩大搜索范围（每次递增20像素），最多搜索200像素
    for (let radius = 20; radius <= 200; radius += 20) {
      const angles = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4,
                      Math.PI, 5 * Math.PI / 4, 3 * Math.PI / 2, 7 * Math.PI / 4];
      for (const ang of angles) {
        const tx = ex + Math.cos(ang) * radius;
        const ty = ey + Math.sin(ang) * radius;
        const tR = { x: tx, y: ty, width: ew, height: eh };
        const blocked = this.obstacles.some(o => this.isBlockingObstacle(o) && this.rectsOverlap(tR, o));
        if (!blocked) {
          entity.x = tx;
          entity.y = ty;
          this.createParticles(tx + ew / 2, ty + eh / 2, '#ffff66', 10);
          return;
        }
      }
    }
    // 如果还没找到，尝试向玩家方向或地图中心推（保底策略）
    const centerX = this.mapWidth / 2, centerY = this.mapHeight / 2;
    const ang = Math.atan2(centerY - (ey + eh / 2), centerX - (ex + ew / 2));
    entity.x = ex + Math.cos(ang) * 80;
    entity.y = ey + Math.sin(ang) * 80;
    this.createParticles(entity.x + ew / 2, entity.y + eh / 2, '#ff9933', 15);
  }

  /**
   * 检测两点之间是否有障碍物阻挡（视线检测）
   * @param {number} x1 - 起点X
   * @param {number} y1 - 起点Y
   * @param {number} x2 - 终点X
   * @param {number} y2 - 终点Y
   * @returns {boolean} 是否能看到（无阻挡）
   */
  canSee(x1, y1, x2, y2) {
    for (const o of this.obstacles) {
      if (!this.isBlockingObstacle(o)) continue;
      if (this.lineIntersectsRect(x1, y1, x2, y2, o.x, o.y, o.width, o.height)) {
        return false;
      }
    }
    return true;
  }

  /**
   * 检测线段是否与矩形相交
   * @private
   */
  lineIntersectsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
    // 使用 Liang-Barsky 算法简化版
    const left = Math.max(x1, x2) < rx;
    const right = Math.min(x1, x2) > rx + rw;
    const top = Math.max(y1, y2) < ry;
    const bottom = Math.min(y1, y2) > ry + rh;
    if (left || right || top || bottom) return false;
    
    // 检查线段是否穿过矩形边界
    const cx = rx + rw / 2;
    const cy = ry + rh / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.001) return false;
    
    const nx = dx / len;
    const ny = dy / len;
    
    // 计算从矩形中心到线段的距离
    const px = x1 - cx;
    const py = y1 - cy;
    const proj = px * nx + py * ny;
    const closestX = Math.max(-rw/2, Math.min(rw/2, proj));
    const closestY = Math.sqrt(Math.max(0, px*px + py*py - closestX*closestX));
    
    return closestY < rh / 2;
  }

  // 尝试移动实体（分轴检测障碍物，防止卡入建筑物），返回实际应用的位移
  tryMove(entity, dx, dy) {
    if (dx === 0 && dy === 0) return;
    if (!this.obstacles || this.obstacles.length === 0) {
      entity.x += dx; entity.y += dy; return;
    }
    const w = entity.width, h = entity.height;
    // X 轴
    if (dx !== 0) {
      const nx = entity.x + dx;
      let blocked = false;
      for (let i = 0; i < this.obstacles.length; i++) {
        const o = this.obstacles[i];
        if (!this.isBlockingObstacle(o)) continue;
        if (nx < o.x + o.width && nx + w > o.x &&
            entity.y < o.y + o.height && entity.y + h > o.y) {
          blocked = true; break;
        }
      }
      if (!blocked) entity.x = nx;
    }
    // Y 轴
    if (dy !== 0) {
      const ny = entity.y + dy;
      let blocked = false;
      for (let i = 0; i < this.obstacles.length; i++) {
        const o = this.obstacles[i];
        if (!this.isBlockingObstacle(o)) continue;
        if (entity.x < o.x + o.width && entity.x + w > o.x &&
            ny < o.y + o.height && ny + h > o.y) {
          blocked = true; break;
        }
      }
      if (!blocked) entity.y = ny;
    }
    // 地图边界
    entity.x = Math.max(4, Math.min(this.mapWidth - w - 4, entity.x));
    entity.y = Math.max(4, Math.min(this.mapHeight - h - 4, entity.y));
  }

  // 击退移动：沿方向前进，一旦碰到建筑就按剩余轴向滑，遇阻立即停止，避免卡进建筑
  applyKnockback(entity, kbX, kbY) {
    if (kbX === 0 && kbY === 0) return 0;
    // 按像素拆分为多步，保证不会一步穿墙
    const totalLen = Math.hypot(kbX, kbY);
    const steps = Math.max(1, Math.ceil(totalLen / 4));
    const sx = kbX / steps, sy = kbY / steps;
    let moved = 0;
    for (let s = 0; s < steps; s++) {
      const beforeX = entity.x, beforeY = entity.y;
      this.tryMove(entity, sx, sy);
      if (entity.x === beforeX && entity.y === beforeY) break; // 完全被阻挡，停止击退
      moved += Math.hypot(entity.x - beforeX, entity.y - beforeY);
    }
    return moved;
  }

  updatePlayer(delta) {
    if (!this.player) return;
    let s = this.player.speed;
    // 应用护甲速度修正
    if (this.player.armorItem && this.player.armorItem.speedMod) {
      s *= this.player.armorItem.speedMod;
    }
    let dx = 0, dy = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= s;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += s;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= s;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += s;
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }
    
    // 处理击退（使用防卡入建筑的安全移动）
    if (this.player.knockbackX !== 0 || this.player.knockbackY !== 0) {
      const kbFriction = 0.92;
      this.applyKnockback(this.player, this.player.knockbackX, this.player.knockbackY);
      this.player.knockbackX *= kbFriction;
      this.player.knockbackY *= kbFriction;
      if (Math.abs(this.player.knockbackX) < 0.1 && Math.abs(this.player.knockbackY) < 0.1) {
        this.player.knockbackX = 0;
        this.player.knockbackY = 0;
      }
    }

    // 无敌时间更新
    if (this.player.invulnerable) {
      this.player.invulnerabilityTimer -= delta;
      if (this.player.invulnerabilityTimer <= 0) {
        this.player.invulnerable = false;
        this.player.invulnerabilityTimer = 0;
      }
    }

    // 普通移动：使用 tryMove，自动分轴检测障碍物，避免卡墙
    this.tryMove(this.player, dx, dy);

    // 小步抖动修正：若玩家意外卡在建筑内，做小幅位移推出
    if (this.obstacles.some(o => this.isBlockingObstacle(o) &&
        this.rectsOverlap({ x: this.player.x, y: this.player.y, width: this.player.width, height: this.player.height }, o))) {
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const tx = this.player.x + Math.cos(ang) * 3;
        const ty = this.player.y + Math.sin(ang) * 3;
        if (!this.obstacles.some(o => this.isBlockingObstacle(o) &&
            this.rectsOverlap({ x: tx, y: ty, width: this.player.width, height: this.player.height }, o))) {
          this.player.x = tx; this.player.y = ty; break;
        }
      }
    }

    const worldMouseX = this.mouse.x + this.camera.x;
    const worldMouseY = this.mouse.y + this.camera.y;
    this.player.facing = Math.atan2(worldMouseY - this.player.y, worldMouseX - this.player.x);

    this.player.attackCooldown -= delta;
    
    const now = Date.now();
    if (this.player.weapon && this.player.weapon.id === 'rifle') {
      if (now - this.player.lastRifleAttackTime > 1000) {
        this.player.rifleAttackTime = 0;
      } else {
        this.player.rifleAttackTime += delta;
      }
    }
    
    if (this.mouse.down && this.player.attackCooldown <= 0 && this.player.weapon) {
      const weapon = this.player.weapon;
      
      let currentAttackSpeed = weapon.attackSpeed || 1;
      if (weapon.id === 'rifle') {
        const maxTime = 3000;
        const minSpeed = 0.5;
        const maxSpeed = 2.0;
        const progress = Math.min(this.player.rifleAttackTime / maxTime, 1);
        currentAttackSpeed = minSpeed + (maxSpeed - minSpeed) * progress;
        this.player.lastRifleAttackTime = now;
      }
      
      const cd = (350 - (weapon.damage || 0) * 2) / currentAttackSpeed;
      this.player.attackCooldown = Math.max(150, cd);
      const colBonus = this.player.colBonus || {};
      const totalDamage = (weapon.damage || 20) + (colBonus.damage || 0);
      const px = this.player.x + this.player.width / 2;
      const py = this.player.y + this.player.height / 2;
      const pColor = weapon.particleColor || '#ffb400';
      const pCount = weapon.particleCount || 4;

      // 武士刀冲刺
      if (weapon.dashDistance) {
        const newX = this.player.x + Math.cos(this.player.facing) * weapon.dashDistance;
        const newY = this.player.y + Math.sin(this.player.facing) * weapon.dashDistance;
        if (!this.obstacles.some(o => this.isBlockingObstacle(o) && this.rectsOverlap({ x: newX, y: newY, width: this.player.width, height: this.player.height }, o))) {
          this.player.x = newX;
          this.player.y = newY;
        }
      }

      if (weapon.type === 'melee') {
        const meleeRange = weapon.range || 100;
        const facing = this.player.facing;
        const isThrust = !!weapon.thrustWidth; // 武士刀：长条突刺
        const sweepAngle = weapon.sweepAngle || Math.PI * 0.8;
        const halfSweep = sweepAngle / 2;
        const thrustWidth = weapon.thrustWidth || 50;

        // —— 近战命中判定 —— 突刺用矩形，扇形用角度扇区
        const isInThrustHitbox = isThrust
          ? (mx, my, ex, ey) => {
              // ex, ey：怪物中心相对于玩家的坐标
              const projLen = ex * Math.cos(facing) + ey * Math.sin(facing); // 投影到朝向
              const projDist = Math.abs(-ex * Math.sin(facing) + ey * Math.cos(facing)); // 垂直距离
              return projLen > 5 && projLen < meleeRange && projDist < thrustWidth / 2;
            }
          : null;

        // [收集阶段]
        const toDamage = [];
        const monstersRef = this.monsters;
        for (let idx = 0; idx < monstersRef.length; idx++) {
          const m = monstersRef[idx];
          if (!m || typeof m.x !== 'number' || typeof m.y !== 'number') continue;
          const mx = m.x + (m.width || 0) / 2;
          const my = m.y + (m.height || 0) / 2;
          const ex = mx - px, ey = my - py;
          const dist = Math.sqrt(ex * ex + ey * ey);
          if (dist > meleeRange + (m.width || 0) / 2) continue;

          let hit = false;
          if (isThrust) {
            hit = isInThrustHitbox(mx, my, ex, ey);
          } else {
            const angleToEnemy = Math.atan2(ey, ex);
            let dAng = angleToEnemy - facing;
            while (dAng > Math.PI) dAng -= 2 * Math.PI;
            while (dAng < -Math.PI) dAng += 2 * Math.PI;
            hit = Math.abs(dAng) <= halfSweep;
          }
          if (hit) toDamage.push(m);
        }

        // 人类敌人命中
        if (this.humanEnemies && this.humanEnemies.length > 0) {
          for (const h of this.humanEnemies) {
            if (!h || h.health <= 0) continue;
            const hx = h.x + h.width/2, hy = h.y + h.height/2;
            const ex = hx - px, ey = hy - py;
            const dist = Math.sqrt(ex*ex + ey*ey);
            if (dist > meleeRange + h.width/2) continue;
            let hit = false;
            if (isThrust) {
              const projLen = ex * Math.cos(facing) + ey * Math.sin(facing);
              const projDist = Math.abs(-ex * Math.sin(facing) + ey * Math.cos(facing));
              hit = projLen > 5 && projLen < meleeRange && projDist < thrustWidth / 2;
            } else {
              const ang = Math.atan2(ey, ex);
              let dAng = ang - facing;
              while (dAng > Math.PI) dAng -= 2*Math.PI;
              while (dAng < -Math.PI) dAng += 2*Math.PI;
              hit = Math.abs(dAng) <= halfSweep;
            }
            if (hit) toDamage.push(h);
          }
        }

        // [伤害阶段] 只修改 .health，不触碰 this.monsters
        toDamage.forEach(m => {
          if (!m) return;
          // 怪物无敌时间检查
          if (m.invulnerable) return;

          let dmg = totalDamage;
          // 人类敌人：有护甲则按比例吸收并消耗耐久
          if (m.armorItem && m.armorItem.currentDurability > 0 && m.armorItem.maxDurability > 0) {
            const mitigation = m.armorItem.defense / (m.armorItem.defense + 40);
            const absorbed = Math.min(m.armorItem.currentDurability, dmg * mitigation * 1.4);
            m.armorItem.currentDurability = Math.max(0, m.armorItem.currentDurability - absorbed);
            dmg = dmg - absorbed;
            if (m.armorItem.currentDurability <= 0) m.armorItem = null;
          }
          m.health -= Math.max(1, dmg);

          // 设置怪物无敌时间
          m.invulnerable = true;
          m.invulnerabilityTimer = m.invulnerabilityDuration;

          // 近战武器强力击退
          const mx = m.x + (m.width || 0) / 2;
          const my = m.y + (m.height || 0) / 2;
          const dx = mx - px;
          const dy = my - py;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const knockbackPower = weapon.knockback || 8; // 近战击退力
            m.knockbackX = (dx / dist) * knockbackPower;
            m.knockbackY = (dy / dist) * knockbackPower;
          }

          // 被玩家攻击：若玩家不在仇恨范围内，则仇恨范围翻倍（除boss外所有敌人）
          if (!m.aggroDoubled) {
            if (m.type === 'human') {
              if (dist >= m.aggroRangePlayer) {
                m.aggroRangePlayer = m.baseAggroRangePlayer * 2;
                m.aggroDoubled = true;
                m.state = 'chase_player';
                m.target = this.player;
              }
            } else {
              if (dist >= m.alertRange) {
                m.alertRange = m.baseAlertRange * 2;
                m.territoryRange = m.baseTerritoryRange * 2;
                m.aggroDoubled = true;
                m.state = 'chase';
              }
            }
          }

          if (typeof m.x === 'number' && typeof m.y === 'number') {
            this.createParticles(m.x + (m.width || 0) / 2, m.y + (m.height || 0) / 2, pColor, 4);
          }
        });

        // [清理阶段] 用 filter 重建数组
        if (this.monsters.length > 0) {
          const killedList = this.monsters.filter(m => m && m.health <= 0);
          if (killedList.length > 0) {
            this.kills += killedList.length;
            killedList.forEach(km => {
              if (km && typeof km.x === 'number' && typeof km.y === 'number') {
                this.spawnLoot(km.x, km.y, km.loot || 'green');
              }
            });
            this.monsters = this.monsters.filter(m => m && m.health > 0);
          }
        }

        // Boss 判定
        if (this.boss && typeof this.boss.x === 'number') {
          const bxv = this.boss.x + (this.boss.width || 0) / 2 - px;
          const byv = this.boss.y + (this.boss.height || 0) / 2 - py;
          const distB = Math.sqrt(bxv * bxv + byv * byv);
          if (distB < meleeRange + (this.boss.width || 0) / 2) {
            let bossHit = false;
            if (isThrust) {
              const projLen = bxv * Math.cos(facing) + byv * Math.sin(facing);
              const projDist = Math.abs(-bxv * Math.sin(facing) + byv * Math.cos(facing));
              bossHit = projLen > 5 && projLen < meleeRange && projDist < thrustWidth / 2;
            } else {
              const angB = Math.atan2(byv, bxv);
              let dAng2 = angB - facing;
              while (dAng2 > Math.PI) dAng2 -= 2 * Math.PI;
              while (dAng2 < -Math.PI) dAng2 += 2 * Math.PI;
              bossHit = Math.abs(dAng2) <= halfSweep;
            }
            if (bossHit) {
              this.damageBoss(totalDamage);
              if (this.boss) this.createParticles(this.boss.x + this.boss.width / 2, this.boss.y + this.boss.height / 2, pColor, 6);
            }
          }
        }

        // 特效：突刺用矩形射线，扇形用弧形扇区
        if (!this.swingEffects) this.swingEffects = [];
        if (isThrust) {
          // 突刺特效：长条矩形
          this.swingEffects.push({
            cx: px, cy: py, facing: facing,
            thrustLength: meleeRange, thrustWidth: thrustWidth,
            isThrust: true, color: pColor,
            life: 200, maxLife: 200
          });
        } else {
          this.swingEffects.push({ cx: px, cy: py, facing: facing, range: meleeRange, sweep: sweepAngle, color: pColor, life: 260, maxLife: 260 });
        }
        this.createParticles(px + Math.cos(facing) * meleeRange * 0.5, py + Math.sin(facing) * meleeRange * 0.5, pColor, pCount);
      } else {
        const bulletSpeed = weapon.bulletSpeed || 9;
        const bulletCount = weapon.bulletCount || 1;
        const spread = weapon.bulletSpread || 0;
        const bRange = weapon.bulletRange || 400;
        // 子弹数量上限
        const maxAllowed = GameConfig.MAX_BULLETS - this.bullets.length;
        const actualCount = Math.min(bulletCount, maxAllowed);
        for (let i = 0; i < actualCount; i++) {
          let angle = this.player.facing;
          if (actualCount > 1) angle += (i / (actualCount - 1) - 0.5) * spread * 2;
          else if (spread > 0) angle += (Math.random() - 0.5) * spread;
          this.bullets.push({
            x: px + Math.cos(this.player.facing) * 15,
            y: py + Math.sin(this.player.facing) * 15,
            dx: Math.cos(angle) * bulletSpeed,
            dy: Math.sin(angle) * bulletSpeed,
            width: 8, height: 8,
            damage: totalDamage,
            lifetime: (bRange / bulletSpeed) * 16,
            fireEffect: weapon.fireEffect, burnDamage: weapon.burnDamage, burnDuration: weapon.burnDuration,
            color: pColor,
            weaponId: weapon.id
          });
        }
        this.createParticles(px + Math.cos(this.player.facing) * 20, py + Math.sin(this.player.facing) * 20, pColor, pCount);
      }
    }
  }

  // 挥砍特效：一个扇形，带渐进淡出
  addSwingEffect(cx, cy, facing, range, sweep, color) {
    this.swingEffects.push({
      cx, cy, facing, range, sweep, color,
      life: 220, maxLife: 220
    });
  }

  updateMonsters(delta) {
    const px = this.player.x + this.player.width / 2;
    const py = this.player.y + this.player.height / 2;

    if (!this.monsters) return;
    
    this.monsters.forEach(m => {
      if (!m) return; // null 检查
      // 处理击退（安全移动：避免卡入建筑）
      if (m.knockbackX !== 0 || m.knockbackY !== 0) {
        const kbFriction = 0.9;
        this.applyKnockback(m, m.knockbackX, m.knockbackY);
        m.knockbackX *= kbFriction;
        m.knockbackY *= kbFriction;
        if (Math.abs(m.knockbackX) < 0.1 && Math.abs(m.knockbackY) < 0.1) {
          m.knockbackX = 0;
          m.knockbackY = 0;
        }
        // 被击退后若仍卡入建筑，做小抖动推出
        if (this.obstacles.some(o => this.isBlockingObstacle(o) &&
            this.rectsOverlap({ x: m.x, y: m.y, width: m.width, height: m.height }, o))) {
          for (let i = 0; i < 10; i++) {
            const ang = (i / 10) * Math.PI * 2;
            const tx = m.x + Math.cos(ang) * 4;
            const ty = m.y + Math.sin(ang) * 4;
            if (!this.obstacles.some(o => this.isBlockingObstacle(o) &&
                this.rectsOverlap({ x: tx, y: ty, width: m.width, height: m.height }, o))) {
              m.x = tx; m.y = ty; break;
            }
          }
        }
      }
      
      // 无敌时间更新
      if (m.invulnerable) {
        m.invulnerabilityTimer -= delta;
        if (m.invulnerabilityTimer <= 0) {
          m.invulnerable = false;
          m.invulnerabilityTimer = 0;
        }
      }
      
      // 处理燃烧效果
      if (m.onFire && m.fireTimer > 0) {
        m.fireTimer -= delta;
        if (m.fireTimer <= 0) {
          m.onFire = false;
        } else {
          m.health -= m.burnDamage || 1;
          if (Math.random() < 0.3) {
            this.createParticles(m.x + m.width / 2, m.y + m.height / 2, '#ef4444', 2);
          }
        }
      }

      m.attackTimer += delta;
      const mcx = m.x + m.width / 2;
      const mcy = m.y + m.height / 2;
      const distToPlayer = this.distance(mcx, mcy, px, py);
      const distFromHome = this.distance(mcx, mcy, m.homeX, m.homeY);

      // 状态机：idle / chase / return
      // 警戒范围=alertRange，追逐时可跑出领地到territoryRange+chaseExtension
      if (m.state === 'chase') {
        // 追逐中：判断是否超出最大追逐距离
        const maxChaseDist = m.territoryRange + m.chaseExtension;
        if (distFromHome > maxChaseDist) {
          m.state = 'return';
        } else if (distToPlayer < m.alertRange * 1.8) {
          // 智能移动：视线检测 + 绕行
          const targetAngle = Math.atan2(py - mcy, px - mcx);
          const hasLineOfSight = this.canSee(mcx, mcy, px, py);
          let moveDx = 0, moveDy = 0;

          if (hasLineOfSight) {
            // 能看到玩家：直线追击
            moveDx = Math.cos(targetAngle) * m.speed;
            moveDy = Math.sin(targetAngle) * m.speed;
          } else {
            // 被障碍物挡住：尝试绕行
            // 候选方向：左偏60°、右偏60°、左偏90°、右偏90°
            const offsets = [Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2];
            let bestDist = distToPlayer;
            let foundPath = false;

            for (const offset of offsets) {
              const tryAngle = targetAngle + offset;
              const tryDx = Math.cos(tryAngle) * m.speed * 0.85;
              const tryDy = Math.sin(tryAngle) * m.speed * 0.85;
              // 检测该方向是否可通行（模拟下一步位置）
              const nextX = m.x + tryDx;
              const nextY = m.y + tryDy;
              const nextRect = { x: nextX, y: nextY, width: m.width, height: m.height };
              const blocked = this.obstacles.some(o => this.isBlockingObstacle(o) &&
                  this.rectsOverlap(nextRect, o));
              if (!blocked) {
                const newDist = this.distance(nextX + m.width / 2, nextY + m.height / 2, px, py);
                if (newDist < bestDist) {
                  bestDist = newDist;
                  moveDx = tryDx;
                  moveDy = tryDy;
                  foundPath = true;
                }
              }
            }

            if (!foundPath) {
              // 四个偏移方向都被挡：尝试纯水平或垂直移动
              if (Math.abs(Math.cos(targetAngle)) > Math.abs(Math.sin(targetAngle))) {
                // 目标主要在水平方向：先尝试水平移动
                const tryDx = Math.sign(Math.cos(targetAngle)) * m.speed * 0.6;
                const testRect = { x: m.x + tryDx, y: m.y, width: m.width, height: m.height };
                if (!this.obstacles.some(o => this.isBlockingObstacle(o) &&
                    this.rectsOverlap(testRect, o))) {
                  moveDx = tryDx;
                  moveDy = 0;
                } else {
                  const tryDy = Math.sign(Math.sin(targetAngle)) * m.speed * 0.6;
                  const testRect2 = { x: m.x, y: m.y + tryDy, width: m.width, height: m.height };
                  if (!this.obstacles.some(o => this.isBlockingObstacle(o) &&
                      this.rectsOverlap(testRect2, o))) {
                    moveDx = 0;
                    moveDy = tryDy;
                  }
                }
              } else {
                // 目标主要在垂直方向：先尝试垂直移动
                const tryDy = Math.sign(Math.sin(targetAngle)) * m.speed * 0.6;
                const testRect = { x: m.x, y: m.y + tryDy, width: m.width, height: m.height };
                if (!this.obstacles.some(o => this.isBlockingObstacle(o) &&
                    this.rectsOverlap(testRect, o))) {
                  moveDx = 0;
                  moveDy = tryDy;
                } else {
                  const tryDx = Math.sign(Math.cos(targetAngle)) * m.speed * 0.6;
                  const testRect2 = { x: m.x + tryDx, y: m.y, width: m.width, height: m.height };
                  if (!this.obstacles.some(o => this.isBlockingObstacle(o) &&
                      this.rectsOverlap(testRect2, o))) {
                    moveDx = tryDx;
                    moveDy = 0;
                  }
                }
              }
            }

            // 最后兜底：如果完全被围死，随机抖动一点
            if (moveDx === 0 && moveDy === 0) {
              const randA = Math.random() * Math.PI * 2;
              moveDx = Math.cos(randA) * m.speed * 0.4;
              moveDy = Math.sin(randA) * m.speed * 0.4;
            }
          }

          this.tryMove(m, moveDx, moveDy);

          if (!m.hasTaunted && distToPlayer < 180 && Math.random() < 0.03) {
            this.showMonsterDialog(m);
            m.hasTaunted = true;
          }
          if (m.attackTimer >= m.attackInterval && distToPlayer < 70) {
            this.damagePlayer(m.damage, mcx, mcy);
            m.attackTimer = 0;
          }
          // 怪物攻击人类敌人
          if (m.attackTimer >= m.attackInterval && this.humanEnemies) {
            for (const h of this.humanEnemies) {
              if (h.health <= 0) continue;
              const hd = this.distance(mcx, mcy, h.x + h.width/2, h.y + h.height/2);
              if (hd < 70) {
                h.health -= m.damage;
                h.invulnerable = true;
                h.invulnerabilityTimer = 300;
                const kx = (h.x + h.width/2 - mcx) / (hd || 1) * 5;
                const ky = (h.y + h.height/2 - mcy) / (hd || 1) * 5;
                h.knockbackX = (h.knockbackX || 0) + kx;
                h.knockbackY = (h.knockbackY || 0) + ky;
                this.createParticles(h.x + h.width/2, h.y + h.height/2, '#ff6666', 5);
                m.attackTimer = 0;
                break;
              }
            }
          }
        } else {
          m.state = 'return';
        }
      } else if (m.state === 'return') {
        // 返回家园：同样使用绕行逻辑
        if (distFromHome < 40) {
          m.state = 'idle';
        } else {
          const homeAngle = Math.atan2(m.homeY - mcy, m.homeX - mcx);
          const canSeeHome = this.canSee(mcx, mcy, m.homeX, m.homeY);
          let hDx = 0, hDy = 0;

          if (canSeeHome) {
            hDx = Math.cos(homeAngle) * m.speed * 0.7;
            hDy = Math.sin(homeAngle) * m.speed * 0.7;
          } else {
            // 回家途中被挡：尝试简单绕行
            const offsets = [Math.PI / 3, -Math.PI / 3];
            let bestHDist = distFromHome;
            let foundH = false;
            for (const offset of offsets) {
              const a = homeAngle + offset;
              const tDx = Math.cos(a) * m.speed * 0.6;
              const tDy = Math.sin(a) * m.speed * 0.6;
              const tR = { x: m.x + tDx, y: m.y + tDy, width: m.width, height: m.height };
              if (!this.obstacles.some(o => this.isBlockingObstacle(o) && this.rectsOverlap(tR, o))) {
                const nd = this.distance(m.x + tDx + m.width/2, m.y + tDy + m.height/2, m.homeX, m.homeY);
                if (nd < bestHDist) {
                  bestHDist = nd;
                  hDx = tDx;
                  hDy = tDy;
                  foundH = true;
                }
              }
            }
            if (!foundH) {
              // 两个方向都被挡：用默认速度继续前进（会被tryMove沿墙滑动）
              hDx = Math.cos(homeAngle) * m.speed * 0.5;
              hDy = Math.sin(homeAngle) * m.speed * 0.5;
            }
          }
          this.tryMove(m, hDx, hDy);
        }
      } else {
        // idle：只在领地内游荡，警戒范围小
        if (distToPlayer < m.alertRange) {
          m.state = 'chase';
        } else {
          // 游荡，只在领地内
          if (performance.now() - m.lastMoveChange > 2800 || (m.wanderDirX === 0 && m.wanderDirY === 0)) {
            m.lastMoveChange = performance.now();
            const ang = Math.random() * Math.PI * 2;
            m.wanderDirX = Math.cos(ang) * m.speed * 0.4;
            m.wanderDirY = Math.sin(ang) * m.speed * 0.4;
            if (Math.random() < 0.35) { m.wanderDirX = 0; m.wanderDirY = 0; }
          }
          if (distFromHome < m.territoryRange ||
              (m.wanderDirX === 0 && m.wanderDirY === 0)) {
            this.tryMove(m, m.wanderDirX, m.wanderDirY);
          } else {
            // 出了领地，朝家走
            const angle = Math.atan2(m.homeY - mcy, m.homeX - mcx);
            m.wanderDirX = Math.cos(angle) * m.speed * 0.3;
            m.wanderDirY = Math.sin(angle) * m.speed * 0.3;
          }
        }
      }
    });
  }

  updateBoss(delta) {
    if (!this.boss) return;

    // 更新Boss无敌时间
    if (this.boss.invulnerable) {
      this.boss.invulnerabilityTimer -= delta;
      if (this.boss.invulnerabilityTimer <= 0) {
        this.boss.invulnerable = false;
        this.boss.invulnerabilityTimer = 0;
      }
    }

    // 处理Boss击退（安全移动：避免卡入建筑）
    if (this.boss.knockbackX !== 0 || this.boss.knockbackY !== 0) {
      const kbFriction = 0.85;
      this.applyKnockback(this.boss, this.boss.knockbackX, this.boss.knockbackY);
      this.boss.knockbackX *= kbFriction;
      this.boss.knockbackY *= kbFriction;
      if (Math.abs(this.boss.knockbackX) < 0.05 && Math.abs(this.boss.knockbackY) < 0.05) {
        this.boss.knockbackX = 0;
        this.boss.knockbackY = 0;
      }
    }

    // 初始化 Boss 状态字段
    if (this.boss.skillState === undefined) this.boss.skillState = 'idle';
    if (this.boss.skillTimer === undefined) this.boss.skillTimer = 0;
    if (this.boss.skillCooldown === undefined) this.boss.skillCooldown = 6000;
    if (this.boss.skillDx === undefined) this.boss.skillDx = 0;
    if (this.boss.skillDy === undefined) this.boss.skillDy = 0;
    if (this.boss.skillHitSet === undefined) this.boss.skillHitSet = new Set();
    if (this.boss.specialAttackTimer === undefined) this.boss.specialAttackTimer = 0;

    this.boss.attackTimer += delta;
    this.boss.skillTimer += delta;
    this.boss.skillCooldown -= delta;
    this.boss.specialAttackTimer += delta;

    const bcx = this.boss.x + this.boss.width / 2;
    const bcy = this.boss.y + this.boss.height / 2;
    const pcx = this.player.x + this.player.width / 2;
    const pcy = this.player.y + this.player.height / 2;
    const distToPlayer = Math.hypot(bcx - pcx, bcy - pcy);

    // —— BOSS视野检测：古树BOSS无视障碍物，其他BOSS需要视线 ——
    const isAncientTreeBoss = (this.boss.name || '').indexOf('古树') !== -1;
    const hasLineOfSight = isAncientTreeBoss || this.canSee(bcx, bcy, pcx, pcy);

    // —— 按 Boss 名字选择独特技能 ——
    const bossName = this.boss.name || '';
    // 根据 Boss 类型设定技能参数表
    let skillProfile;
    if (bossName.indexOf('机械') !== -1) {
      skillProfile = { type: 'dash', warn: 800, duration: 3000, speed: 0, cooldown: 7000, color: '#29b6f6',
        label: '狂暴冲刺', range: 700 };
    } else if (bossName.indexOf('哥布林') !== -1) {
      skillProfile = { type: 'cleave', warn: 600, duration: 3000, speed: 0, cooldown: 8000, color: '#ef5350',
        label: '狂暴冲锋', range: 600 };
    } else if (bossName.indexOf('兽神') !== -1 || bossName.indexOf('烈焰') !== -1) {
      skillProfile = { type: 'fireball', warn: 500, duration: 200, speed: 0, cooldown: 3500, color: '#ff7043',
        label: '火焰弹', range: 900 };
    } else if (bossName.indexOf('古树') !== -1) {
      skillProfile = { type: 'roots', warn: 800, duration: 1500, speed: 0, cooldown: 5500, color: '#66bb6a',
        label: '根须缠绕', range: 800 };
    } else {
      skillProfile = { type: 'barrage', warn: 700, duration: 400, speed: 0, cooldown: 5000, color: '#ab47bc',
        label: '炮击', range: 800 };
    }

    // —— 技能状态机：idle → warning → active → cooldown ——
    const skill = skillProfile;
    if (this.boss.skillState === 'idle') {
      // 只有在能"看到"玩家时（古树除外）才能释放技能
      if (this.boss.skillCooldown <= 0 && distToPlayer < skill.range && hasLineOfSight) {
        this.boss.skillState = 'warning';
        this.boss.skillTimer = 0;
        const ang = Math.atan2(pcy - bcy, pcx - bcx);
        this.boss.skillDx = Math.cos(ang);
        this.boss.skillDy = Math.sin(ang);
        this.boss.skillHitSet = new Set();
        this.showLog(`⚠️ ${this.boss.name} 正在蓄力【${skill.label}】！`, 'red');
      }
    } else if (this.boss.skillState === 'warning') {
      if (this.boss.skillTimer >= skill.warn) {
        this.boss.skillState = 'active';
        this.boss.skillTimer = 0;

        // —— 立即触发型技能（开火/挥砍/根须）在这里放初始效果 ——
        if (skill.type === 'cleave') {
          // 哥布林王：进入狂暴追击状态
          this.boss._cleaveState = 'chase';
          this.boss._cleaveSwingTimer = 0;
        } else if (skill.type === 'bounceShot') {
          // 哥布林王：朝玩家连续发射3枚可随机弹射的弹幕
          if (this.boss.shotIndex === undefined) this.boss.shotIndex = 0;
          if (this.boss.shotCooldown === undefined) this.boss.shotCooldown = 0;
          this.boss.shotCooldown += delta;
          const interval = 180;
          if (this.boss.shotIndex < 3 && this.boss.shotCooldown >= interval) {
            this.boss.shotCooldown = 0;
            const facing = Math.atan2(pcy - bcy, pcx - bcx);
            const bulletSpeed = 6;
            this.bullets.push({
              x: bcx, y: bcy,
              dx: Math.cos(facing) * bulletSpeed,
              dy: Math.sin(facing) * bulletSpeed,
              width: 14, height: 14,
              damage: this.boss.damage * 0.45,
              lifetime: 3500,
              isBoss: true,
              bouncing: true,
              bounceCount: 0,
              maxBounces: 3,
              color: '#ef5350'
            });
            this.boss.shotIndex++;
            if (this.boss.shotIndex >= 3) {
              this.boss.shotIndex = undefined;
              this.boss.skillState = 'cooldown';
              this.boss.skillTimer = 0;
              this.boss.skillCooldown = skill.cooldown;
            }
          }
        } else if (skill.type === 'fireball') {
          // 烈焰兽神：朝玩家方向射 3 发火焰弹
          const facing = Math.atan2(pcy - bcy, pcx - bcx);
          const maxAllowed = GameConfig.MAX_BULLETS - this.bullets.length;
          const fireballCount = Math.min(3, maxAllowed);
          for (let i = 0; i < fireballCount; i++) {
            const ang = facing + (i - 1) * 0.18;
            this.bullets.push({ x: bcx, y: bcy, dx: Math.cos(ang) * 6, dy: Math.sin(ang) * 6,
              width: 16, height: 16, damage: this.boss.damage * 0.6, lifetime: 2500, isBoss: true,
              fireEffect: true, burnDamage: 6, burnDuration: 2500, color: '#ff5722' });
          }
        } else if (skill.type === 'roots') {
          // 古树化身：在玩家脚下生成 5 处根须预警圈，延迟后造成伤害
          this.boss._rootMarkers = [];
          for (let i = 0; i < 5; i++) {
            const offAng = Math.random() * Math.PI * 2;
            const offR = 40 + Math.random() * 80;
            this.boss._rootMarkers.push({
              x: pcx + Math.cos(offAng) * offR,
              y: pcy + Math.sin(offAng) * offR,
              radius: 45, explodeTimer: 1200, hit: false
            });
          }
        } else if (skill.type === 'barrage') {
          // 默认：环形炮击，限制子弹数量
          const maxAllowed = GameConfig.MAX_BULLETS - this.bullets.length;
          const bulletCount = Math.min(12, maxAllowed);
          for (let i = 0; i < bulletCount; i++) {
            const ang = (Math.PI * 2 / bulletCount) * i;
            this.bullets.push({ x: bcx, y: bcy, dx: Math.cos(ang) * 4.5, dy: Math.sin(ang) * 4.5,
              width: 14, height: 14, damage: this.boss.damage * 0.5, lifetime: 3200, isBoss: true, color: '#ab47bc' });
          }
        }
      }
    } else if (this.boss.skillState === 'active') {
      if (skill.type === 'dash') {
        // 机械战神：高速追踪玩家冲刺（无视建筑穿墙）
        const chaseSpeed = this.boss.speed * 2.2;
        // 实时计算朝玩家的方向（持续追踪）
        const chaseAngle = Math.atan2(pcy - bcy, pcx - bcx);
        this.boss.x += Math.cos(chaseAngle) * chaseSpeed;
        this.boss.y += Math.sin(chaseAngle) * chaseSpeed;
        const newBcx = this.boss.x + this.boss.width / 2;
        const newBcy = this.boss.y + this.boss.height / 2;
        // 冲刺伤害玩家
        if (this.rectsOverlap(this.boss, this.player) && !this.boss.skillHitSet.has('player')) {
          this.damagePlayer(this.boss.damage * 1.3, newBcx, newBcy);
          this.boss.skillHitSet.add('player');
          this.createParticles(pcx, pcy, '#ff0000', 20);
        }
        // 冲刺对小怪造成伤害
        if (this.monsters) {
          for (let i = 0; i < this.monsters.length; i++) {
            if (this.boss.skillHitSet.has('m' + i)) continue;
            const m = this.monsters[i];
            if (!m) continue;
            if (this.rectsOverlap(this.boss, m)) {
              m.health -= 30;
              this.boss.skillHitSet.add('m' + i);
              this.createParticles(m.x + m.width / 2, m.y + m.height / 2, '#ff8800', 10);
            }
          }
        }
        // 冲刺尾迹粒子（限制频率）
        if (this.boss.skillTimer % 60 < 20) {
          this.createParticles(newBcx, newBcy, '#29b6f6', 3);
        }
        if (this.boss.skillTimer >= skill.duration ||
            this.boss.x < 20 || this.boss.x > this.mapWidth - this.boss.width - 20 ||
            this.boss.y < 20 || this.boss.y > this.mapHeight - this.boss.height - 20) {
          // 检查是否卡在建筑里 → 推到空地
          const bossRect = { x: this.boss.x, y: this.boss.y, width: this.boss.width, height: this.boss.height };
          const stuck = this.obstacles.some(o => this.isBlockingObstacle(o) && this.rectsOverlap(bossRect, o));
          if (stuck) {
            this.ejectFromObstacles(this.boss);
          }
          this.boss.skillState = 'cooldown';
          this.boss.skillTimer = 0;
          this.boss.skillCooldown = skill.cooldown;
          this.createParticles(newBcx, newBcy, '#ff6600', 12);
        }
      } else if (skill.type === 'cleave') {
        // 哥布林王：狂暴追击 → 挥砍
        if (this.boss._cleaveState === 'chase') {
          // 朝玩家高速移动（2倍速度，无视地形）
          const chaseSpeed = this.boss.speed * 2;
          const chaseAngle = Math.atan2(pcy - bcy, pcx - bcx);
          this.boss.x += Math.cos(chaseAngle) * chaseSpeed;
          this.boss.y += Math.sin(chaseAngle) * chaseSpeed;
          // 追击尾迹粒子
          if (this.boss.skillTimer % 60 < 20) {
            this.createParticles(bcx, bcy, '#ef5350', 2);
          }
          // 检查是否在挥砍范围内
          if (distToPlayer < 120) {
            // 执行挥砍
            const facing = Math.atan2(pcy - bcy, pcx - bcx);
            const sweep = Math.PI * 0.8;
            const range = 120;
            // 玩家伤害
            const dAng = Math.atan2(pcy - bcy, pcx - bcx) - facing;
            const norm = Math.atan2(Math.sin(dAng), Math.cos(dAng));
            if (Math.abs(norm) < sweep / 2) {
              this.damagePlayer(this.boss.damage * 1.3, bcx, bcy);
            }
            // 小怪伤害
            if (this.monsters) {
              for (let i = 0; i < this.monsters.length; i++) {
                const m = this.monsters[i];
                if (!m) continue;
                const mcx = m.x + m.width / 2, mcy = m.y + m.height / 2;
                const md = Math.hypot(mcx - bcx, mcy - bcy);
                if (md < range) {
                  const a = Math.atan2(mcy - bcy, mcx - bcx);
                  if (Math.abs(Math.atan2(Math.sin(a - facing), Math.cos(a - facing))) < sweep / 2) {
                    m.health -= 25;
                  }
                }
              }
            }
            // 添加挥砍视觉特效
            this.swingEffects.push({ cx: bcx, cy: bcy, facing: facing, range: range, sweep: sweep, color: skill.color, life: 350, maxLife: 350 });
            this.boss._cleaveState = 'swing';
            this.boss._cleaveSwingTimer = 0;
          }
          // 超时未追上 → 结束
          if (this.boss.skillTimer >= skill.duration) {
            // 检查是否卡在建筑里 → 推到空地
            const bossRect = { x: this.boss.x, y: this.boss.y, width: this.boss.width, height: this.boss.height };
            const stuck = this.obstacles.some(o => this.isBlockingObstacle(o) && this.rectsOverlap(bossRect, o));
            if (stuck) {
              this.ejectFromObstacles(this.boss);
            }
            this.boss.skillState = 'cooldown';
            this.boss.skillTimer = 0;
            this.boss.skillCooldown = skill.cooldown;
          }
        } else if (this.boss._cleaveState === 'swing') {
          // 挥砍动作阶段（0.5秒），不移动
          this.boss._cleaveSwingTimer += delta;
          if (this.boss._cleaveSwingTimer >= 500) {
            // 挥砍结束 → 检查是否卡住 → 冷却
            const bossRect = { x: this.boss.x, y: this.boss.y, width: this.boss.width, height: this.boss.height };
            const stuck = this.obstacles.some(o => this.isBlockingObstacle(o) && this.rectsOverlap(bossRect, o));
            if (stuck) {
              this.ejectFromObstacles(this.boss);
            }
            this.boss.skillState = 'cooldown';
            this.boss.skillTimer = 0;
            this.boss.skillCooldown = skill.cooldown;
          }
        }
      } else if (skill.type === 'roots') {
        // 古树：根须倒计时，到点爆炸
        if (this.boss._rootMarkers) {
          for (let i = 0; i < this.boss._rootMarkers.length; i++) {
            const r = this.boss._rootMarkers[i];
            r.explodeTimer -= delta;
            // 未击中状态下更新为标记（视觉由渲染处理）
            if (!r.hit && r.explodeTimer <= 0) {
              r.hit = true;
              const dx = pcx - r.x, dy = pcy - r.y;
              if (Math.hypot(dx, dy) < r.radius + 15) {
                this.damagePlayer(this.boss.damage * 0.8, r.x, r.y);
              }
              this.createParticles(r.x, r.y, '#66bb6a', 8);
            }
          }
          // 全部爆炸后进入冷却
          if (this.boss._rootMarkers.every(r => r.hit)) {
            this.boss._rootMarkers = null;
            this.boss.skillState = 'cooldown';
            this.boss.skillTimer = 0;
            this.boss.skillCooldown = skill.cooldown;
          }
        } else {
          this.boss.skillState = 'cooldown';
          this.boss.skillTimer = 0;
          this.boss.skillCooldown = skill.cooldown;
        }
        if (this.boss.skillTimer >= skill.duration) {
          this.boss._rootMarkers = null;
          this.boss.skillState = 'cooldown';
          this.boss.skillTimer = 0;
          this.boss.skillCooldown = skill.cooldown;
        }
      } else {
        // 瞬时型技能（fireball/barrage/bounceShot）：激活后立即冷却
        this.boss.skillState = 'cooldown';
        this.boss.skillTimer = 0;
        this.boss.skillCooldown = skill.cooldown;
      }
    } else if (this.boss.skillState === 'cooldown') {
      if (this.boss.skillTimer >= 600) {
        this.boss.skillState = 'idle';
        this.boss.skillTimer = 0;
      }
    }

    // 保留 skillColor 给渲染层使用
    this.boss.skillColor = skill.color;
    this.boss.skillLabel = skill.label;

    // —— 漫游 / 追击 / 绕行 行为 ——
    if (this.boss.skillState === 'idle' || this.boss.skillState === 'cooldown') {
      // 初始化漫游目标点
      if (this.boss.wanderTarget === undefined) {
        this.boss.wanderTarget = {
          x: 200 + Math.random() * (this.mapWidth - 400),
          y: 200 + Math.random() * (this.mapHeight - 400),
          timer: 0
        };
      }
      this.boss.wanderTarget.timer += delta;
      const distToTarget = Math.hypot(this.boss.wanderTarget.x - bcx, this.boss.wanderTarget.y - bcy);
      if (distToTarget < 60 || this.boss.wanderTarget.timer > 6000) {
        this.boss.wanderTarget = {
          x: 200 + Math.random() * (this.mapWidth - 400),
          y: 200 + Math.random() * (this.mapHeight - 400),
          timer: 0
        };
      }

      let moveAngle;
      let moveSpeed = this.boss.speed * 0.6;

      if (distToPlayer < 600) {
        // —— 玩家在仇恨范围内 ——
        if (!this.boss.hasTaunted) {
          this.showMonsterDialog(this.boss);
          this.boss.hasTaunted = true;
        }

        if (hasLineOfSight) {
          // —— 能看到玩家：直线追击 ——
          moveAngle = Math.atan2(pcy - bcy, pcx - bcx);
          moveSpeed = this.boss.speed;
        } else {
          // —— 看不到玩家：智能绕行接近 ——
          // 初始化状态
          if (this.boss.bypassTimer === undefined) this.boss.bypassTimer = 0;
          if (this.boss.stuckCounter === undefined) this.boss.stuckCounter = 0;
          if (this.boss.lastPos === undefined) this.boss.lastPos = { x: bcx, y: bcy };
          
          this.boss.bypassTimer += delta;
          
          // 检测是否被卡住（连续多帧位置几乎没变）
          const posDiff = Math.hypot(bcx - this.boss.lastPos.x, bcy - this.boss.lastPos.y);
          this.boss.lastPos = { x: bcx, y: bcy };
          
          if (posDiff < 0.5) {
            this.boss.stuckCounter++;
            // 连续卡住超过30帧：强制切换方向并尝试逃离
            if (this.boss.stuckCounter > 30) {
              this.boss.bypassDir = -(this.boss.bypassDir || 1);
              this.boss.stuckCounter = 0;
            }
          } else {
            this.boss.stuckCounter = 0;
          }
          
          // 每隔1-3秒随机切换绕行方向（增加随机性）
          const switchInterval = 1000 + Math.random() * 2000;
          if (this.boss.bypassTimer > switchInterval) {
            this.boss.bypassDir = Math.random() < 0.5 ? 1 : -1;
            this.boss.bypassTimer = 0;
          }
          
          // 智能绕行：尝试多个方向，选择最优路径
          const baseAngle = Math.atan2(pcy - bcy, pcx - bcx);
          let bestAngle = baseAngle;
          let bestScore = -1;
          let foundPath = false;
          
          // 尝试多个绕行方向：左偏45°、左偏90°、右偏45°、右偏90°、左偏135°、右偏135°
          const offsets = [-Math.PI/4, -Math.PI/2, Math.PI/4, Math.PI/2, -3*Math.PI/4, 3*Math.PI/4];
          for (const offset of offsets) {
            const testAngle = baseAngle + offset;
            const testDx = Math.cos(testAngle) * this.boss.speed * 1.5;
            const testDy = Math.sin(testAngle) * this.boss.speed * 1.5;
            
            // 测试下一步位置是否可行
            const nextX = this.boss.x + testDx;
            const nextY = this.boss.y + testDy;
            const nextRect = { x: nextX, y: nextY, width: this.boss.width, height: this.boss.height };
            const blocked = this.obstacles.some(o => this.isBlockingObstacle(o) && this.rectsOverlap(nextRect, o));
            
            if (!blocked) {
              // 计算该方向的评分：优先选择能接近玩家的方向
              const nextBcx = nextX + this.boss.width / 2;
              const nextBcy = nextY + this.boss.height / 2;
              const distAfter = Math.hypot(pcx - nextBcx, pcy - nextBcy);
              const distBefore = distToPlayer;
              const distImprovement = distBefore - distAfter;
              
              // 评分 = 距离改善值 + 角度奖励（偏好接近玩家方向）
              const angleDiff = Math.abs(offset);
              const score = distImprovement + (1 - angleDiff / (Math.PI * 1.5));
              
              if (score > bestScore) {
                bestScore = score;
                bestAngle = testAngle;
                foundPath = true;
              }
            }
          }
          
          if (foundPath) {
            moveAngle = bestAngle;
            moveSpeed = this.boss.speed * 1.3;
          } else {
            // 所有方向都被挡：沿墙滑动（使用当前绕行方向）
            const bypassAngle = baseAngle + (this.boss.bypassDir || 1) * Math.PI / 2;
            moveAngle = bypassAngle;
            moveSpeed = this.boss.speed * 1.0;
            
            // 极端情况：完全被困，尝试随机抖动
            if (this.boss.stuckCounter > 60) {
              moveAngle = Math.random() * Math.PI * 2;
              moveSpeed = this.boss.speed * 0.5;
            }
          }
          
          // 最后检查：如果直行一小步就能看到玩家，优先直行
          const directTestX = bcx + Math.cos(baseAngle) * 15;
          const directTestY = bcy + Math.sin(baseAngle) * 15;
          if (this.canSee(bcx, bcy, directTestX, directTestY)) {
            moveAngle = baseAngle;
            moveSpeed = this.boss.speed;
          }
        }
      } else {
        // —— 玩家不在仇恨范围内：漫游 ——
        moveAngle = Math.atan2(this.boss.wanderTarget.y - bcy, this.boss.wanderTarget.x - bcx);
      }

      // warning 阶段不移动（给玩家反应时间）
      if (this.boss.skillState !== 'warning') {
        this.tryMove(this.boss, Math.cos(moveAngle) * moveSpeed, Math.sin(moveAngle) * moveSpeed);
      }
    }

    // —— 近战攻击：仅在能看到玩家时（古树除外）且贴近玩家时触发 ——
    if ((this.boss.skillState === 'idle' || this.boss.skillState === 'cooldown') &&
        this.boss.attackTimer >= this.boss.attackInterval && distToPlayer < 90 && hasLineOfSight) {
      this.damagePlayer(this.boss.damage);
      this.boss.attackTimer = 0;
      this.createParticles(pcx, pcy, '#ff0000', 15);
    }

    // 阶段 2：生命低于一半 → 狂暴
    if (this.boss.health < this.boss.maxHealth * 0.5 && this.boss.phase === 1) {
      this.boss.phase = 2;
      this.boss.speed = 1.0;
      this.boss.attackInterval = 800;
      this.showLog(`⚠️ ${this.boss.name} 进入狂暴状态！`, 'red');
    }
  }

  updateBullets(delta) {
    const keep = [];
    for (let i = 0; i < this.bullets.length; i++) {
      const b = this.bullets[i];
      b.x += b.dx; b.y += b.dy; b.lifetime -= delta;
      if (b.lifetime <= 0) continue;
      // 检测障碍物碰撞：可反弹子弹随机方向弹射，普通子弹销毁
      let blocked = false;
      for (const o of this.obstacles) {
        if (!this.isBlockingObstacle(o)) continue;
        if (this.rectsOverlap({ x: b.x, y: b.y, width: b.width, height: b.height }, o)) {
          blocked = true;
          if (b.bouncing && b.bounceCount < b.maxBounces) {
            // 随机方向弹射：在当前位置生成一个随机新方向
            const randAngle = Math.random() * Math.PI * 2;
            const currentSpeed = Math.sqrt(b.dx * b.dx + b.dy * b.dy);
            b.dx = Math.cos(randAngle) * currentSpeed;
            b.dy = Math.sin(randAngle) * currentSpeed;
            // 退回碰撞前位置，避免卡在墙里
            b.x -= b.dx * 2;
            b.y -= b.dy * 2;
            b.bounceCount++;
            this.createParticles(b.x + b.width / 2, b.y + b.height / 2, b.color || '#ef5350', 4);
            blocked = false; // 反弹后不销毁
            break;
          } else {
            this.createParticles(b.x, b.y, '#aaa', 3);
            break;
          }
        }
      }
      if (blocked) continue;
      if (b.isBoss) {
        if (this.rectsOverlap({ x: b.x, y: b.y, width: b.width, height: b.height }, { x: this.player.x, y: this.player.y, width: this.player.width, height: this.player.height })) {
          // Boss子弹伤害玩家，传递伤害来源位置用于击退
          const bx = this.boss ? this.boss.x + this.boss.width / 2 : b.x;
          const by = this.boss ? this.boss.y + this.boss.height / 2 : b.y;
          this.damagePlayer(b.damage, bx, by);
          this.createParticles(b.x, b.y, '#ff4444', 8);
          continue;
        }
        keep.push(b);
      } else {
        let hit = false;
        // 找怪物命中，只修改 .health，不修改 this.monsters
        for (let j = 0; j < this.monsters.length; j++) {
          const m = this.monsters[j];
          if (this.rectsOverlap({ x: b.x, y: b.y, width: b.width, height: b.height }, { x: m.x, y: m.y, width: m.width, height: m.height })) {
            // 怪物无敌时间检查（霰弹枪不触发无敌帧）
            if (m.invulnerable && b.weaponId !== 'shotgun') continue;

            m.health -= b.damage;

            // 设置怪物无敌时间（霰弹枪不设置无敌帧）
            if (b.weaponId !== 'shotgun') {
              m.invulnerable = true;
              m.invulnerabilityTimer = m.invulnerabilityDuration;
            }

            // 远程武器击退（比近战弱）
            const mx = m.x + m.width / 2;
            const my = m.y + m.height / 2;
            const dx = mx - b.x;
            const dy = my - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
              const knockbackPower = b.knockback || 6; // 远程击退力（比近战弱但已提升）
              m.knockbackX = (dx / dist) * knockbackPower;
              m.knockbackY = (dy / dist) * knockbackPower;
            }

            // 被玩家攻击：若玩家不在仇恨范围内，则仇恨范围翻倍
            if (!m.aggroDoubled) {
              const distToPlayer = this.distance(mx, my, this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
              if (distToPlayer >= m.alertRange) {
                m.alertRange = m.baseAlertRange * 2;
                m.territoryRange = m.baseTerritoryRange * 2;
                m.aggroDoubled = true;
                m.state = 'chase';
              }
            }

            const color = b.color || '#ff6b6b';
            this.createParticles(b.x, b.y, color, 6);
            if (b.fireEffect) { m.onFire = true; m.fireTimer = b.burnDuration || 2000; m.burnDamage = b.burnDamage || 5; }
            hit = true;
            break;
          }
        }
        // 人类敌人命中
        if (!hit && b.owner !== 'human' && this.humanEnemies && this.humanEnemies.length > 0) {
          for (const h of this.humanEnemies) {
            if (!h || h.health <= 0 || h.invulnerable) continue;
            if (this.rectsOverlap({ x: b.x, y: b.y, width: b.width, height: b.height }, { x: h.x, y: h.y, width: h.width, height: h.height })) {
              let dmg = b.damage;
              if (h.armorItem && h.armorItem.currentDurability > 0 && h.armorItem.maxDurability > 0) {
                const mitigation = h.armorItem.defense / (h.armorItem.defense + 40);
                const absorbed = Math.min(h.armorItem.currentDurability, dmg * mitigation * 1.4);
                h.armorItem.currentDurability = Math.max(0, h.armorItem.currentDurability - absorbed);
                dmg = dmg - absorbed;
                if (h.armorItem.currentDurability <= 0) h.armorItem = null;
              }
              h.health -= Math.max(1, dmg);
              h.invulnerable = true;
              h.invulnerabilityTimer = 300;

              // 被玩家攻击：若玩家不在仇恨范围内，则仇恨范围翻倍
              if (!h.aggroDoubled) {
                const hcx = h.x + h.width / 2;
                const hcy = h.y + h.height / 2;
                const distToPlayer = this.distance(hcx, hcy, this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
                if (distToPlayer >= h.aggroRangePlayer) {
                  h.aggroRangePlayer = h.baseAggroRangePlayer * 2;
                  h.aggroDoubled = true;
                  h.state = 'chase_player';
                  h.target = this.player;
                }
              }

              const color = b.color || '#ff6b6b';
              this.createParticles(b.x, b.y, color, 6);
              hit = true;
              break;
            }
          }
        }
        // 人类子弹打到玩家
        if (!hit && b.owner === 'human' && this.rectsOverlap({ x: b.x, y: b.y, width: b.width, height: b.height }, { x: this.player.x, y: this.player.y, width: this.player.width, height: this.player.height })) {
          this.damagePlayer(b.damage, b.x, b.y);
          this.createParticles(b.x, b.y, b.color || '#fbbf24', 6);
          hit = true;
        }
        // Boss 命中（同样只读操作，damageBoss自己处理）
        if (!hit && this.boss && this.rectsOverlap({ x: b.x, y: b.y, width: b.width, height: b.height }, { x: this.boss.x, y: this.boss.y, width: this.boss.width, height: this.boss.height })) {
          this.damageBoss(b.damage, b.x, b.y, b.weaponId === 'shotgun');
          hit = true;
        }
        if (!hit) keep.push(b);
      }
    }
    this.bullets = keep;
    // 统一在 update 最后清理死亡怪物（避免在子弹循环内处理）
    if (this.monsters && this.monsters.length > 0) {
      const deadList = this.monsters.filter(m => m && m.health <= 0);
      if (deadList.length > 0) {
        this.kills += deadList.length;
        deadList.forEach(dm => this.spawnLoot(dm.x, dm.y, dm.loot || 'green'));
        this.monsters = this.monsters.filter(m => m && m.health > 0);
      }
    }
  }

  damagePlayer(dmg, sourceX, sourceY) {
    // 无敌时间检查
    if (this.player.invulnerable) return;
    
    let left = dmg;
    // 若装备了护甲：按护甲的 defense 比例减免伤害，并消耗耐久
    if (this.player.armorItem && this.player.armorItem.currentDurability > 0) {
      const mitigation = this.player.armorItem.defense / (this.player.armorItem.defense + 40);
      const absorbed = Math.min(this.player.armorItem.currentDurability, dmg * mitigation * 1.4);
      this.player.armorItem.currentDurability = Math.max(0, this.player.armorItem.currentDurability - absorbed);
      this.player.armor = Math.floor(this.player.armorItem.currentDurability);
      left = dmg - absorbed;
      if (this.player.armorItem.currentDurability <= 0) {
        this.showLog(`🛡️ ${this.player.armorItem.name} 已损坏！`, this.player.armorItem.rarity || 'white');
        this.player.armorItem = null;
        this.player.armor = 0;
      }
    }
    this.player.health -= Math.max(0, left);
    
    // 设置无敌时间
    this.player.invulnerable = true;
    this.player.invulnerabilityTimer = this.player.invulnerabilityDuration;
    
    // 计算击退方向（远离伤害来源）
    if (sourceX !== undefined && sourceY !== undefined) {
      const px = this.player.x + this.player.width / 2;
      const py = this.player.y + this.player.height / 2;
      const dx = px - sourceX;
      const dy = py - sourceY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        const knockbackPower = 5; // 基础击退力
        this.player.knockbackX = (dx / dist) * knockbackPower;
        this.player.knockbackY = (dy / dist) * knockbackPower;
      }
    }
    
    this.createParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, '#ff0000', 10);
    if (this.player.health <= 0) this.gameOver(false);
    this.updateHUD();
  }

  damageBoss(dmg, sourceX, sourceY, skipInvulnerable = false) {
    if (!this.boss) return;
    
    // Boss 无敌时间检查（与小怪一致），霰弹枪跳过无敌帧检查
    if (this.boss.invulnerable && !skipInvulnerable) return;
    
    this.boss.health -= dmg;
    
    // 设置 Boss 无敌时间（与小怪一致：300ms），霰弹枪不设置无敌帧
    if (!skipInvulnerable) {
      this.boss.invulnerable = true;
      this.boss.invulnerabilityTimer = this.boss.invulnerabilityDuration;
    }
    
    // Boss 超强抗击退
    if (sourceX !== undefined && sourceY !== undefined) {
      const bx = this.boss.x + this.boss.width / 2;
      const by = this.boss.y + this.boss.height / 2;
      const dx = bx - sourceX;
      const dy = by - sourceY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        const knockbackPower = 1; // Boss 击退力极小
        const resistance = this.boss.knockbackResistance || 0.95;
        this.boss.knockbackX = (dx / dist) * knockbackPower * (1 - resistance);
        this.boss.knockbackY = (dy / dist) * knockbackPower * (1 - resistance);
      }
    }
    
    this.createParticles(this.boss.x + this.boss.width / 2, this.boss.y + this.boss.height / 2, '#ff0000', 15);
    if (this.boss.health <= 0) {
      this.spawnBossLoot();
      this.bossKills++;
      this.kills++;
      this.boss = null;
    }
  }

  updateParticles(delta) {
    const keep = [];
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += p.dx; p.y += p.dy;
      p.dx *= 0.95; p.dy *= 0.95;
      p.lifetime -= delta;
      p.alpha = Math.max(0, p.alpha - delta * 0.002);
      if (p.lifetime > 0 && p.alpha > 0) keep.push(p);
    }
    this.particles = keep;
  }

  createParticles(x, y, color, count) {
    // 粒子数量上限，避免性能问题
    const maxAllowed = GameConfig.MAX_PARTICLES - this.particles.length;
    if (maxAllowed <= 0) return;
    count = Math.min(count, maxAllowed);
    for (let i = 0; i < count; i++) {
      this.particles.push({ x, y, dx: (Math.random() - 0.5) * 6, dy: (Math.random() - 0.5) * 6,
        size: 2 + Math.random() * 3, color, lifetime: 400 + Math.random() * 400, alpha: 1 });
    }
  }

  checkCollisions() {
    this.nearestContainer = null;
    this.nearestItemDrop = null;

    if (!this.player) return;

    const px = this.player.x + this.player.width / 2;
    const py = this.player.y + this.player.height / 2;

    for (const c of this.containers) {
      if (c.searched) continue;
      const d = this.distance(px, py, c.x + c.width / 2, c.y + c.height / 2);
      if (d < 55) {
        this.nearestContainer = c;
        break;
      }
    }

    for (const item of this.items) {
      const d = this.distance(px, py, item.x + (item.width || 20) / 2, item.y + (item.height || 20) / 2);
      if (d < 50) {
        this.nearestItemDrop = item;
        break;
      }
    }

    if (this.nearestContainer) this.ui.searchPrompt.classList.remove('hidden');
    else this.ui.searchPrompt.classList.add('hidden');
    if (this.nearestItemDrop) this.ui.pickupPrompt.classList.remove('hidden');
    else this.ui.pickupPrompt.classList.add('hidden');

    const distToEscape = this.distance(
      this.escapePoint.x + this.escapePoint.width / 2,
      this.escapePoint.y + this.escapePoint.height / 2,
      this.player.x + this.player.width / 2,
      this.player.y + this.player.height / 2
    );
    if (distToEscape < 100 && !this.isSearching) {
      this.ui.escapePrompt.classList.remove('hidden');
      this.ui.escapeGold.textContent = this.lootValue();
    } else {
      this.ui.escapePrompt.classList.add('hidden');
    }
  }

  lootValue() {
    let total = this.goldFound;
    this.player.inventory.forEach(item => total += this.getItemPrice(item));
    return total;
  }

  handleInteract() {
    if (!this.ui.lootModal.classList.contains('hidden')) return;
    if (this.nearestContainer) { this.startSearching(this.nearestContainer); return; }
    if (this.nearestItemDrop) { this.pickupDroppedItem(this.nearestItemDrop); return; }
    // 撤离改为自动检测范围，不再需要按键触发
  }

  startSearching(container) {
    if (this.isSearching) return;
    this.isSearching = true;
    this.searchingContainer = container;
    this.searchStartTime = performance.now();
    // 应用护甲搜索速度修正（机械外骨骼+50%搜索速度）
    let searchMod = 1;
    if (this.player.armorItem && this.player.armorItem.searchSpeedMod) {
      searchMod = 1 / this.player.armorItem.searchSpeedMod; // 搜索时间缩短
    }
    this.searchDuration = GameConfig.SEARCH_DURATION * searchMod;
    this.ui.searchProgress.classList.remove('hidden');
    this.ui.searchProgressFill.style.width = '0%';
    this.ui.searchLabel.textContent = `🔍 搜索 ${container.name}...`;
    this.ui.searchPrompt.classList.add('hidden');
  }

  updateSearching(delta) {
    const elapsed = performance.now() - this.searchStartTime;
    const ratio = Math.min(1, elapsed / this.searchDuration);
    this.ui.searchProgressFill.style.width = (ratio * 100) + '%';
    if (this.searchingContainer &&
        this.distance(this.searchingContainer.x, this.searchingContainer.y,
                       this.player.x + this.player.width / 2, this.player.y + this.player.height / 2) > 120) {
      this.cancelSearching(); return;
    }
    if (ratio >= 1) this.finishSearching();
  }

  cancelSearching() {
    this.isSearching = false;
    this.searchingContainer = null;
    this.ui.searchProgress.classList.add('hidden');
  }

  finishSearching() {
    const c = this.searchingContainer;
    this.isSearching = false;
    this.searchingContainer = null;
    this.ui.searchProgress.classList.add('hidden');
    if (c) {
      c.searched = true;
      // 启动刷新倒计时
      c.refreshTimer = c.refreshTotal || 20000;
    }
    const found = this.generateLootFromContainer(c);
    this.openLootModal(found, c ? c.name : '容器');
  }

  generateLootFromContainer(container) {
    if (!container || !container.hasLoot) {
      return [{ id: 'empty', name: '空空如也', icon: '🚫', rarity: 'white', price: 0, isEmpty: true }];
    }
    // 超高爆率模式 —— 从图鉴中所有金/红色物品随机掉落
    if (this.highDropMode) {
      const rarity = Math.random() < 0.6 ? 'gold' : 'red';
      const pool = Game.getCollectionPoolByRarity(rarity);
      const item = pool[Math.floor(Math.random() * pool.length)];
      const count = rarity === 'red' ? 1 : (Math.random() < 0.4 ? 2 : 1);
      const result = [{ ...item, rarity }];
      for (let i = 1; i < count; i++) {
        const r = pool[Math.floor(Math.random() * pool.length)];
        result.push({ ...r, rarity });
      }
      return result;
    }
    // 普通模式：容器品质概率 —— 白38% 绿30% 蓝19% 紫9% 金2.5% 红1.5%
    const rarityRoll = Math.random();
    let rarity;
    if (rarityRoll < 0.38) rarity = 'white';
    else if (rarityRoll < 0.68) rarity = 'green';
    else if (rarityRoll < 0.87) rarity = 'blue';
    else if (rarityRoll < 0.96) rarity = 'purple';
    else if (rarityRoll < 0.985) rarity = 'gold';
    else rarity = 'red';

    // 普通模式：从图鉴统一数据源获取 + 低品质混入补给品
    let pool = Game.getCollectionPoolByRarity(rarity);
    // 低品质（白/绿）容器有概率掉落补给品
    if (rarity === 'white' || rarity === 'green') {
      const supplyPool = Game.SUPPLY_ITEMS.filter(s => s.rarity === rarity);
      pool = pool.concat(supplyPool);
    }
    const item = pool[Math.floor(Math.random() * pool.length)];
    const count = (rarity === 'red' || rarity === 'gold') ? 1 : (Math.random() < 0.3 ? 2 : 1);
    const result = [{ ...item, rarity: item.rarity || rarity }];
    for (let i = 1; i < count; i++) {
      const r = pool[Math.floor(Math.random() * pool.length)];
      result.push({ ...r, rarity: r.rarity || rarity });
    }
    return result;
  }

  spawnLoot(x, y, rarity) {
    // 超高爆率模式 —— 从图鉴中所有金/红色物品随机掉落（确保所有图鉴物品都能覆盖）
    if (this.highDropMode) {
      const forcedRarity = Math.random() < 0.5 ? 'gold' : 'red';
      const pool = Game.getCollectionPoolByRarity(forcedRarity);
      const item = pool[Math.floor(Math.random() * pool.length)];
      this.items.push({ ...item, rarity: forcedRarity, x, y, width: 20, height: 20 });
      this.createParticles(x, y, forcedRarity === 'red' ? '#ff0000' : '#ffd700', 12);
      return;
    }
    // 普通模式 - 全部从图鉴统一数据源获取，避免重复定义
    const pools = {
      white:  Game.getCollectionPoolByRarity('white'),
      green:  Game.getCollectionPoolByRarity('green'),
      blue:   Game.getCollectionPoolByRarity('blue'),
      purple: Game.getCollectionPoolByRarity('purple'),
      gold:   Game.getCollectionPoolByRarity('gold'),
      red:    Game.getCollectionPoolByRarity('red')
    };
    const pool = pools[rarity] || pools.green;
    const item = pool[Math.floor(Math.random() * pool.length)];
    this.items.push({ ...item, rarity: item.rarity || rarity, x, y, width: 20, height: 20 });
    this.createParticles(x, y, '#ffd700', 8);
  }

  spawnBossLoot() {
    const bx = this.boss ? this.boss.x + this.boss.width / 2 : this.player.x;
    const by = this.boss ? this.boss.y + this.boss.height / 2 : this.player.y;
    
    // 核心掉落：20%概率
    if (Math.random() < 0.2) {
      this.items.push({
        id: this.boss && this.boss.specialLoot || 'legendaryCore',
        name: (this.boss && this.boss.name ? this.boss.name + '·核心' : '传说核心'),
        icon: '💎', rarity: 'red', price: 9000,
        x: bx, y: by,
        width: 30, height: 30
      });
      this.showLog(`🔥 传说掉落：${this.boss.name} 的核心！`, 'red');
    }

    // 超高爆率模式 —— 从图鉴中所有金/红色物品随机掉落（2-4件）
    if (this.highDropMode) {
      const lootCount = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < lootCount; i++) {
        const rarity = Math.random() < 0.5 ? 'gold' : 'red';
        const pool = Game.getCollectionPoolByRarity(rarity);
        const pick = pool[Math.floor(Math.random() * pool.length)];
        this.items.push({
          ...pick, rarity,
          x: bx + (Math.random() - 0.5) * 80,
          y: by + (Math.random() - 0.5) * 80,
          width: 22, height: 22
        });
      }
      this.createParticles(bx, by, '#ff0000', 50);
      this.showLog(`💀 高爆率模式：击败 ${this.boss.name}！掉落 ${lootCount} 件金/红收集品！`, 'gold');
      return;
    }

    // 普通模式：从图鉴统一数据源获取 —— BOSS掉落1-5件，高品质概率更高
    const lootCount = 1 + Math.floor(Math.random() * 5);
    for (let i = 0; i < lootCount; i++) {
      // 全随机稀有度（BOSS也可能掉落低品质，但高品质概率稍高）
      const rarityRoll = Math.random();
      let rarity;
      if (rarityRoll < 0.12) rarity = 'red';
      else if (rarityRoll < 0.27) rarity = 'gold';
      else if (rarityRoll < 0.45) rarity = 'purple';
      else if (rarityRoll < 0.65) rarity = 'blue';
      else if (rarityRoll < 0.85) rarity = 'green';
      else rarity = 'white';

      const pool = Game.getCollectionPoolByRarity(rarity);
      const pick = pool[Math.floor(Math.random() * pool.length)];

      // BOSS掉落价值比普通物品高80%
      const basePrice = this.getItemPriceByRarity(rarity);
      const bossPrice = Math.floor(basePrice * 1.8);
      
      // 掉落地面
      this.items.push({
        ...pick,
        rarity: rarity,
        price: pick.price || bossPrice, // 使用自定义价格或计算的BOSS价格
        x: bx + (Math.random() - 0.5) * 80,
        y: by + (Math.random() - 0.5) * 80,
        width: 22,
        height: 22
      });
    }
    
    this.createParticles(bx, by, '#ffd700', 40);
    this.showLog(`💀 击败 ${this.boss.name}！掉落了珍贵的收集品！`, 'gold');
  }
  
  getItemPriceByRarity(rarity) {
    return Game.RARITY_BASE_PRICES[rarity] || 100;
  }

  pickupDroppedItem(item) {
    if (this.player.inventory.length >= this.bagCapacity) {
      this.showLog(`❌ 背包已满，无法拾取 ${item.name}`, 'red');
      return;
    }
    // 补全 isSupply 标记（从地面拾取的非容器物品）
    if (!item.isSupply && (item.id === 'smallHealth' || item.id === 'bigHealth' || item.id === 'armorRepair' || item.id === 'grenade' || item.effect)) {
      item.isSupply = true;
    }
    this.player.inventory.push(item);
    this.items = this.items.filter(i => i !== item);
    this.nearestItemDrop = null;
    this.updateHUD();
    this.showLog(`✅ 拾取 ${item.icon} ${item.name}（价值${this.getItemPrice(item)}）`, item.rarity || 'white');
  }

  useSupply() {
    const supplies = this.player.inventory.map((i, idx) => ({ item: i, idx })).filter(x => x.item && x.item.isSupply);
    if (supplies.length === 0) return;
    this.useSupplyAt(supplies[0].idx);
  }

  // 通过补给品 id 直接使用（对应 1/2/3/4 按键）
  useSupplyByType(typeId) {
    const idx = this.player.inventory.findIndex(i => i && i.isSupply && (i.id === typeId || i.effect));
    if (idx === -1) {
      this.showLog(`⚠️ 没有对应的补给品`, 'white');
      return;
    }
    const item = this.player.inventory[idx];
    // 简单按 id 匹配效果
    const idMap = { smallHealth: 'heal:30', bigHealth: 'heal:70', armorRepair: 'repair:25', grenade: 'damage:0' };
    const want = idMap[typeId];
    if (want) {
      const [effect, amountStr] = want.split(':');
      const amount = parseInt(amountStr, 10) || 0;
      // 如果是 grenade 走投掷
      if (typeId === 'grenade') {
        this.useSupplyAt(idx);
        return;
      }
      if (item.effect !== effect) {
        this.showLog(`⚠️ 这个槽位不是 ${typeId}`, 'white');
        return;
      }
    }
    this.useSupplyAt(idx);
  }

  useSupplyAt(idx) {
    const supply = this.player.inventory[idx];
    if (!supply) return;
    // 手雷特殊处理
    if (supply.effect === 'damage') {
      this.throwGrenade(supply, idx);
      return;
    }
    if (supply.effect === 'heal') {
      this.player.health = Math.min(this.player.health + supply.amount, this.player.maxHealth);
    } else if (supply.effect === 'repair') {
      if (this.player.armorItem) {
        this.player.armorItem.currentDurability = Math.min(
          this.player.armorItem.currentDurability + supply.amount,
          this.player.armorItem.maxDurability
        );
        this.player.armor = Math.floor(this.player.armorItem.currentDurability);
      } else {
        this.showLog('⚠️ 未装备护甲，无法修复', 'white');
        return;
      }
    }
    this.player.inventory.splice(idx, 1);
    this.showLog(`🧪 使用 ${supply.icon} ${supply.name}`, supply.rarity || 'white');
    this.createParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, '#00ff00', 8);
    this.updateHUD();
  }

  // 投掷手雷
  throwGrenade(supply, inventoryIdx) {
    // 计算鼠标指向的世界坐标（鼠标坐标 + 相机偏移）
    const worldX = this.mouse.x + this.camera.x;
    const worldY = this.mouse.y + this.camera.y;
    
    // 创建手雷实体
    const grenade = {
      x: this.player.x + this.player.width / 2,
      y: this.player.y + this.player.height / 2,
      targetX: worldX,
      targetY: worldY,
      speed: 8,
      damage: supply.amount,
      radius: 180,
      timer: 1200, // 1.2秒延迟
      inventoryIdx: inventoryIdx,
      supply: supply
    };
    
    this.items.push({
      id: 'grenade_in_flight',
      name: '手雷',
      icon: '💣',
      x: grenade.x,
      y: grenade.y,
      width: 15,
      height: 15,
      isGrenade: true,
      grenade: grenade
    });
    
    this.player.inventory.splice(inventoryIdx, 1);
    this.showLog(`💣 投掷手雷！`, supply.rarity || 'green');
  }

  // ============ 人类敌人 AI ============
  updateHumanEnemies(delta) {
    if (!this.humanEnemies || this.humanEnemies.length === 0) return;
    for (let i = this.humanEnemies.length - 1; i >= 0; i--) {
      const h = this.humanEnemies[i];
      if (!h) continue;
      if (h.health <= 0) {
        this.dropHumanLoot(h);
        this.humanEnemies.splice(i, 1);
        continue;
      }
      // 无敌时间
      if (h.invulnerable) {
        h.invulnerabilityTimer -= delta;
        if (h.invulnerabilityTimer <= 0) h.invulnerable = false;
      }
      // 击退
      h.x += h.knockbackX;
      h.y += h.knockbackY;
      h.knockbackX *= 0.85;
      h.knockbackY *= 0.85;
      // AI 决策
      h.decisionTimer -= delta;
      if (h.decisionTimer <= 0) {
        h.decisionTimer = h.decisionInterval;
        this.humanAIDecide(h);
      }
      // 根据状态移动
      let tx = null, ty = null;
      if (h.state === 'wander') {
        // 随机漫游
        if (Math.random() < 0.05) {
          h.facing = Math.random() * Math.PI * 2;
        }
        tx = h.x + Math.cos(h.facing) * 100;
        ty = h.y + Math.sin(h.facing) * 100;
      } else if (h.state === 'chase_player') {
        // 追击玩家：优先检查是否有寻路目标点
        if (h.moveToX !== undefined && h.moveToY !== undefined) {
          // 有寻路目标，先移动到目标点
          tx = h.moveToX;
          ty = h.moveToY;
          h.facing = Math.atan2(ty - h.y, tx - h.x);
          // 检查是否到达目标点
          const distToGoal = this.distance(h.x, h.y, tx, ty);
          if (distToGoal < 20) {
            // 到达目标点，清除寻路目标
            h.moveToX = undefined;
            h.moveToY = undefined;
          }
        } else {
          // 正常追击玩家
          tx = this.player.x;
          ty = this.player.y;
          h.facing = Math.atan2(ty - h.y, tx - h.x);
        }
      } else if (h.state === 'chase_monster' && h.target) {
        tx = h.target.x;
        ty = h.target.y;
        h.facing = Math.atan2(ty - h.y, tx - h.x);
      } else if (h.state === 'flee') {
        // 血量低，朝远离玩家方向跑
        const dx = h.x - this.player.x, dy = h.y - this.player.y;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        tx = h.x + (dx/len) * 200;
        ty = h.y + (dy/len) * 200;
        h.facing = Math.atan2(dy, dx);
      } else if (h.state === 'loot') {
        // 拾取掉落
        if (h.target) {
          tx = h.target.x;
          ty = h.target.y;
          h.facing = Math.atan2(ty - h.y, tx - h.x);
        } else {
          h.state = 'wander';
        }
      } else if (h.state === 'combat') {
        // combat 状态：朝目标攻击
        if (h.target) {
          tx = h.target.x;
          ty = h.target.y;
          h.facing = Math.atan2(ty - h.y, tx - h.x);
        } else {
          h.state = 'wander';
        }
      }
      // 移动
      if (tx !== null && ty !== null) {
        const dx = tx - h.x, dy = ty - h.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d > 5) {
          let step = h.speed * (delta / 16);
          // 流血状态下追击减速
          if (h.health < h.maxHealth * 0.3) step *= 0.8;
          const nx = h.x + (dx/d) * step;
          const ny = h.y + (dy/d) * step;
          if (!this.obstacles.some(o => this.isBlockingObstacle(o) && this.rectsOverlap({ x: nx, y: h.y, width: h.width, height: h.height }, o))) h.x = nx;
          if (!this.obstacles.some(o => this.isBlockingObstacle(o) && this.rectsOverlap({ x: h.x, y: ny, width: h.width, height: h.height }, o))) h.y = ny;
        }
      }
      // 攻击
      h.attackCooldown -= delta;
      if (h.attackCooldown <= 0 && h.target && h.weapon) {
        const dToTarget = this.distance(h.x, h.y, h.target.x, h.target.y);
        const weapon = h.weapon;
        const hcx = h.x + h.width / 2;
        const hcy = h.y + h.height / 2;
        const tcx = h.target.x + (h.target.width || 0) / 2;
        const tcy = h.target.y + (h.target.height || 0) / 2;
        
        // 检查是否能看到目标（视线检测）
        const canSeeTarget = this.canSee(hcx, hcy, tcx, tcy);
        
        if (weapon.type === 'ranged' && dToTarget < h.attackRange + (weapon.bulletRange || 0)) {
          // 远程攻击需要视线
          if (canSeeTarget) {
            this.humanFireRanged(h, weapon);
            h.attackCooldown = 500 / (weapon.attackSpeed || 1);
          } else {
            // 无法看到目标，尝试寻路
            this.humanFindAttackPosition(h);
            h.attackCooldown = 200;
          }
        } else if (weapon.type === 'melee' && dToTarget < (weapon.range || 100) + 30) {
          // 近战攻击不需要视线（可以贴身攻击）
          this.humanMelee(h, weapon);
          h.attackCooldown = 350 / (weapon.attackSpeed || 1);
          // 武士刀冲刺
          if (weapon.dashDistance) {
            const nx = h.x + Math.cos(h.facing) * weapon.dashDistance;
            const ny = h.y + Math.sin(h.facing) * weapon.dashDistance;
            if (!this.obstacles.some(o => this.isBlockingObstacle(o) && this.rectsOverlap({ x: nx, y: ny, width: h.width, height: h.height }, o))) {
              h.x = nx; h.y = ny;
            }
          }
        } else {
          h.attackCooldown = 100;
        }
      }
      // 拾取逻辑
      if (h.state === 'loot' && h.target) {
        const d = this.distance(h.x, h.y, h.target.x, h.target.y);
        if (d < 30 && h.inventory.length < h.inventoryCap) {
          const it = h.target;
          // 把物品从地面移到人类背包
          h.inventory.push({ ...it });
          this.items = this.items.filter(x => x !== it);
          h.target = null;
          h.state = 'wander';
          this.showLog(`🎒 ${h.name} 拾取了 ${it.name}`, 'white');
        }
      }
      // 边界限制
      h.x = Math.max(0, Math.min(this.mapWidth - h.width, h.x));
      h.y = Math.max(0, Math.min(this.mapHeight - h.height, h.y));
    }
  }

  /**
   * 人类敌人寻路：尝试找到能攻击目标的位置
   * @param {object} h - 人类敌人
   */
  humanFindAttackPosition(h) {
    if (!h.target) return;
    
    const hcx = h.x + h.width / 2;
    const hcy = h.y + h.height / 2;
    const tcx = h.target.x + (h.target.width || 0) / 2;
    const tcy = h.target.y + (h.target.height || 0) / 2;
    
    // 尝试在目标周围找一个能看到的位置
    const attackRange = h.attackRange + (h.weapon.bulletRange || 0);
    const checkRadius = attackRange + 50;
    const attempts = 8;
    
    for (let i = 0; i < attempts; i++) {
      const angle = (i / attempts) * Math.PI * 2;
      const dist = attackRange + Math.random() * 30;
      const px = tcx + Math.cos(angle) * dist;
      const py = tcy + Math.sin(angle) * dist;
      
      // 检查位置是否有效（在地图内且不与障碍物重叠）
      if (px < 0 || py < 0 || px > this.mapWidth || py > this.mapHeight) continue;
      
      const canStand = !this.obstacles.some(o => 
        this.isBlockingObstacle(o) && this.rectsOverlap({ x: px - h.width/2, y: py - h.height/2, width: h.width, height: h.height }, o)
      );
      
      if (canStand && this.canSee(px, py, tcx, tcy)) {
        // 找到合适位置，设置移动目标
        h.state = 'chase_player';
        h.target = this.player;
        // 临时设置移动目标为这个位置
        h.moveToX = px - h.width / 2;
        h.moveToY = py - h.height / 2;
        return;
      }
    }
    
    // 如果没找到，继续向目标方向移动
    h.state = 'chase_player';
    h.target = this.player;
  }

  humanAIDecide(h) {
    const distPlayer = this.distance(h.x, h.y, this.player.x, this.player.y);
    // 血量低则逃跑
    if (h.health < h.maxHealth * 0.25 && distPlayer < 500) {
      h.state = 'flee';
      h.target = null;
      return;
    }
    // 玩家在仇恨范围内 → 追击玩家
    if (distPlayer < h.aggroRangePlayer) {
      h.state = 'chase_player';
      h.target = this.player;
      return;
    }
    // 没有仇恨时：全地图游荡，顺路拾取附近掉落（不再主动追怪物）
    if (h.inventory.length < h.inventoryCap && this.items && this.items.length > 0) {
      let nearest = null, nearD = 200;
      for (const it of this.items) {
        if (!it || it.isCollectible || it.isContainer) continue;
        const d = this.distance(h.x, h.y, it.x, it.y);
        if (d < nearD) { nearD = d; nearest = it; }
      }
      if (nearest) {
        h.state = 'loot';
        h.target = nearest;
        return;
      }
    }
    // 全地图漫游
    h.state = 'wander';
    h.target = null;
    // 随机转向，偶尔朝地图远处的随机点移动
    if (Math.random() < 0.6) {
      const randX = Math.random() * this.mapWidth;
      const randY = Math.random() * this.mapHeight;
      h.facing = Math.atan2(randY - h.y, randX - h.x);
    }
  }

  humanFireRanged(h, weapon) {
    const fc = Math.cos(h.facing), fs = Math.sin(h.facing);
    const sx = h.x + h.width/2 + fc * 20;
    const sy = h.y + h.height/2 + fs * 20;
    const bulletCount = weapon.bulletCount || 1;
    const spread = weapon.bulletSpread || 0;
    const speed = weapon.bulletSpeed || 8;
    const range = weapon.bulletRange || 400;
    // 子弹数量上限
    const maxAllowed = GameConfig.MAX_BULLETS - this.bullets.length;
    const actualCount = Math.min(bulletCount, maxAllowed);
    for (let i = 0; i < actualCount; i++) {
      const angle = h.facing + (Math.random() - 0.5) * spread * 2;
      this.bullets.push({
        x: sx, y: sy,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        width: 8, height: 8,
        damage: weapon.damage || 10,
        lifetime: (range / speed) * 16,
        owner: 'human', ownerRef: h,
        color: weapon.particleColor || '#fbbf24'
      });
    }
  }

  humanMelee(h, weapon) {
    if (!h || !weapon || !h.target) return;
    // 在 h.facing 方向的扇形/突刺
    const px = h.x + h.width/2, py = h.y + h.height/2;
    const target = h.target;
    if (!target) return;
    // 复用玩家挥砍检测
    if (target === this.player) {
      // 攻击玩家
      const tdx = target.x + target.width/2 - px;
      const tdy = target.y + target.height/2 - py;
      const dist = Math.sqrt(tdx*tdx + tdy*tdy);
      const facing = h.facing;
      const isThrust = !!weapon.thrustWidth;
      let hit = false;
      if (isThrust) {
        const projLen = tdx * Math.cos(facing) + tdy * Math.sin(facing);
        const projDist = Math.abs(-tdx * Math.sin(facing) + tdy * Math.cos(facing));
        hit = projLen > 5 && projLen < (weapon.range || 100) && projDist < (weapon.thrustWidth || 40) / 2;
      } else {
        const sweep = weapon.sweepAngle || Math.PI * 0.5;
        const ang = Math.atan2(tdy, tdx);
        let diff = ang - facing;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        hit = dist < (weapon.range || 100) && Math.abs(diff) < sweep / 2;
      }
      if (hit) {
        this.damagePlayer(weapon.damage || 10, px, py);
        this.showLog(`⚔️ ${h.name} 用 ${weapon.name} 击中了你`, 'red');
      }
    } else {
      // 攻击怪物
      const tdx = target.x + target.width/2 - px;
      const tdy = target.y + target.height/2 - py;
      const dist = Math.sqrt(tdx*tdx + tdy*tdy) || 1;
      const facing = h.facing;
      const isThrust = !!weapon.thrustWidth;
      let hit = false;
      if (isThrust) {
        const projLen = tdx * Math.cos(facing) + tdy * Math.sin(facing);
        const projDist = Math.abs(-tdx * Math.sin(facing) + tdy * Math.cos(facing));
        hit = projLen > 5 && projLen < (weapon.range || 100) && projDist < (weapon.thrustWidth || 40) / 2;
      } else {
        const sweep = weapon.sweepAngle || Math.PI * 0.5;
        const ang = Math.atan2(tdy, tdx);
        let diff = ang - facing;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        hit = dist < (weapon.range || 100) && Math.abs(diff) < sweep / 2;
      }
      if (hit) {
        const dmg = Math.max(1, (weapon.damage || 10) - (target.defense || 0));
        target.health -= dmg;
        target.invulnerable = true;
        target.invulnerabilityTimer = 300;
        if (weapon.knockback) {
          const kx = (tdx/dist) * (weapon.knockback || 5);
          const ky = (tdy/dist) * (weapon.knockback || 5);
          target.knockbackX = (target.knockbackX || 0) + kx;
          target.knockbackY = (target.knockbackY || 0) + ky;
        }
      }
    }
    // 添加挥砍特效
    this.swingEffects.push({
      cx: px, cy: py, facing: h.facing,
      range: weapon.range || 100,
      sweep: weapon.sweepAngle || Math.PI * 0.5,
      color: weapon.particleColor || '#fbbf24',
      life: 200, maxLife: 200,
      isThrust: !!weapon.thrustWidth,
      thrustLength: weapon.range || 100,
      thrustWidth: weapon.thrustWidth || 0
    });
  }

  dropHumanLoot(h) {
    // 按装备价值计算掉落：总价值 = weaponValue + armorValue
    const totalValue = (h.weaponValue || 0) + (h.armorValue || 0);
    
    // 掉落人类敌人收集的物品
    if (h.inventory && h.inventory.length > 0) {
      for (const item of h.inventory) {
        this.items.push({
          ...item,
          x: h.x + h.width/2 + (Math.random() - 0.5) * 40,
          y: h.y + h.height/2 + (Math.random() - 0.5) * 40,
          width: 20, height: 20
        });
        this.showLog(`📦 ${h.name} 掉落了收集的物品: ${item.icon} ${item.name}`, 'white');
      }
    }
    
    if (totalValue < 50) {
      this.showLog(`💀 ${h.name} 被击败，掉落少量金币`, 'white');
      this.goldFound += 30;
      return;
    }

    // 超高爆率模式 —— 从图鉴中所有金/红色物品随机掉落
    if (this.highDropMode) {
      const forcedRarity = Math.random() < 0.5 ? 'gold' : 'red';
      const pool = Game.getCollectionPoolByRarity(forcedRarity);
      const pick = pool[Math.floor(Math.random() * pool.length)];
      this.items.push({
        ...pick, rarity: forcedRarity,
        x: h.x + h.width / 2, y: h.y + h.height / 2,
        width: 20, height: 20
      });
      this.kills += 1;
      this.showLog(`💀 高爆率模式：击败 ${h.name}！掉落 ${pick.icon} ${pick.name}`, forcedRarity);
      this.createParticles(h.x + h.width / 2, h.y + h.height / 2, forcedRarity === 'red' ? '#ff0000' : '#ffd700', 16);
      return;
    }

    // 调高掉落品质：价值 -> 品质（阈值降低，更容易掉高品质）
    // < 150 white, < 300 green, < 450 blue, < 600 purple, < 800 gold, >= 800 red
    let rarity = 'white';
    if (totalValue >= 800) rarity = 'red';
    else if (totalValue >= 600) rarity = 'gold';
    else if (totalValue >= 450) rarity = 'purple';
    else if (totalValue >= 300) rarity = 'blue';
    else if (totalValue >= 150) rarity = 'green';
    const pool = Game.getCollectionPoolByRarity(rarity);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    // 掉落地面
    this.items.push({
      ...pick, rarity,
      x: h.x + h.width/2, y: h.y + h.height/2,
      width: 20, height: 20
    });
    this.kills += 1;
    this.showLog(`💀 击败 ${h.name}！装备价值 ${totalValue}，掉落 ${pick.icon} ${pick.name}`, rarity);
    this.createParticles(h.x + h.width/2, h.y + h.height/2, '#ffaa00', 16);
  }

  // 更新飞行中的手雷
  updateGrenades(delta) {
    this.items = this.items.filter(item => {
      if (!item.isGrenade || !item.grenade) return true;
      
      const g = item.grenade;
      
      // 倒计时
      g.timer -= delta;
      if (g.timer <= 0) {
        // 爆炸！
        this.explodeGrenade(g);
        return false;
      }
      
      // 向目标移动
      const dx = g.targetX - g.x;
      const dy = g.targetY - g.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 5) {
        g.x += (dx / dist) * g.speed;
        g.y += (dy / dist) * g.speed;
      }
      
      item.x = g.x;
      item.y = g.y;
      return true;
    });
  }

  // 手雷爆炸
  explodeGrenade(grenade) {
    const cx = grenade.targetX;
    const cy = grenade.targetY;
    
    // 伤害怪物
    if (this.monsters) {
      const px = this.player.x + this.player.width / 2;
      const py = this.player.y + this.player.height / 2;
      this.monsters.forEach(m => {
        if (!m) return;
        const d = this.distance(m.x + m.width / 2, m.y + m.height / 2, cx, cy);
        if (d < grenade.radius) {
          m.health -= grenade.damage;
          m.knockbackX = (m.x + m.width / 2 - cx) * 0.15;
          m.knockbackY = (m.y + m.height / 2 - cy) * 0.15;
          // 被玩家攻击：若玩家不在仇恨范围内，则仇恨范围翻倍
          if (!m.aggroDoubled) {
            const distToPlayer = this.distance(m.x + m.width / 2, m.y + m.height / 2, px, py);
            if (distToPlayer >= m.alertRange) {
              m.alertRange = m.baseAlertRange * 2;
              m.territoryRange = m.baseTerritoryRange * 2;
              m.aggroDoubled = true;
              m.state = 'chase';
            }
          }
          if (m.health <= 0) {
            this.kills++;
            this.spawnLoot(m.x, m.y, m.loot || 'green');
          }
        }
      });
    }
    // 伤害人类敌人
    if (this.humanEnemies) {
      const px = this.player.x + this.player.width / 2;
      const py = this.player.y + this.player.height / 2;
      this.humanEnemies.forEach(h => {
        if (!h || h.health <= 0) return;
        const d = this.distance(h.x + h.width / 2, h.y + h.height / 2, cx, cy);
        if (d < grenade.radius) {
          let dmg = grenade.damage;
          if (h.armorItem && h.armorItem.currentDurability > 0 && h.armorItem.maxDurability > 0) {
            const mitigation = h.armorItem.defense / (h.armorItem.defense + 40);
            const absorbed = Math.min(h.armorItem.currentDurability, dmg * mitigation * 1.4);
            h.armorItem.currentDurability = Math.max(0, h.armorItem.currentDurability - absorbed);
            dmg = dmg - absorbed;
            if (h.armorItem.currentDurability <= 0) h.armorItem = null;
          }
          h.health -= Math.max(1, dmg);
          h.knockbackX = (h.x + h.width / 2 - cx) * 0.15;
          h.knockbackY = (h.y + h.height / 2 - cy) * 0.15;
          if (!h.aggroDoubled) {
            const distToPlayer = this.distance(h.x + h.width / 2, h.y + h.height / 2, px, py);
            if (distToPlayer >= h.aggroRangePlayer) {
              h.aggroRangePlayer = h.baseAggroRangePlayer * 2;
              h.aggroDoubled = true;
              h.state = 'chase_player';
              h.target = this.player;
            }
          }
        }
      });
    }
    
    // 伤害Boss
    if (this.boss) {
      const d = this.distance(this.boss.x + this.boss.width / 2, this.boss.y + this.boss.height / 2, cx, cy);
      if (d < grenade.radius) {
        this.boss.health -= grenade.damage;
        this.boss.knockbackX = (this.boss.x + this.boss.width / 2 - cx) * 0.1;
        this.boss.knockbackY = (this.boss.y + this.boss.height / 2 - cy) * 0.1;
      }
    }
    
    // 伤害玩家（自伤）
    const playerDist = this.distance(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, cx, cy);
    if (playerDist < grenade.radius * 0.6) {
      this.player.health -= Math.floor(grenade.damage * 0.3); // 30% 自伤
    }
    
    // 爆炸特效
    this.createParticles(cx, cy, '#ff6b35', 25);
    this.createParticles(cx, cy, '#ffd700', 15);
    this.showLog(`💥 手雷爆炸！范围 ${grenade.radius}`, 'green');
  }

  escape() {
    // —— 撤离成功：武器 + 护甲 + 背包物品 + 地图掉落物 全部带回仓库 ——
    if (this.player.weapon) {
      this.warehouse.push({ ...this.player.weapon });
    }
    if (this.player.armorItem) {
      // 把 armorItem 原样存回仓库，保留耐久状态
      this.warehouse.push({ ...this.player.armorItem });
    }
    this.player.inventory.forEach(item => this.warehouse.push({ ...item }));
    this.items.forEach(item => this.warehouse.push({ ...item }));
    this.escapes++;
    this.saveData();
    this.gameOver(true);
  }

  gameOver(success) {
    this.gameState = 'menu';
    if (success) {
      this.ui.gameOverModal.classList.remove('hidden');
      const itemsEl = document.getElementById('finalItems');
      const killsEl = document.getElementById('finalKills');
      const timeEl = document.getElementById('finalTime');
      if (itemsEl) itemsEl.textContent = this.player.inventory.length + this.items.length;
      if (killsEl) killsEl.textContent = this.kills;
      if (timeEl) timeEl.textContent = Math.floor(this.survivalTime / 1000) + 's';
    } else {
      this.ui.deathModal.classList.remove('hidden');
    }
  }

  showMonsterDialog(m) {
    this.ui.monsterDialog.classList.remove('hidden');
    const x = (m.x || 0) - this.camera.x;
    const y = (m.y || 0) - this.camera.y - 50;
    this.ui.monsterDialog.style.left = x + 'px';
    this.ui.monsterDialog.style.top = y + 'px';
    this.ui.dialogContent.textContent = m.taunt || m.name;
    clearTimeout(this._dialogTimer);
    this._dialogTimer = setTimeout(() => this.ui.monsterDialog.classList.add('hidden'), 3500);
  }

  updateCamera() {
    const targetX = this.player.x - this.canvas.width / 2 + this.player.width / 2;
    const targetY = this.player.y - this.canvas.height / 2 + this.player.height / 2;
    this.camera.x += (targetX - this.camera.x) * 0.12;
    this.camera.y += (targetY - this.camera.y) * 0.12;
    this.camera.x = Math.max(0, Math.min(this.camera.x, this.mapWidth - this.canvas.width));
    this.camera.y = Math.max(0, Math.min(this.camera.y, this.mapHeight - this.canvas.height));
  }

  updateHUD() {
    const el = id => document.getElementById(id);
    if (el('health')) el('health').textContent = Math.max(0, Math.floor(this.player.health));
    // 护甲显示：如装备了 armorItem 就显示 "当前耐久/上限"，否则显示 0
    if (el('armor')) {
      if (this.player.armorItem) {
        const cur = Math.floor(this.player.armorItem.currentDurability);
        const mx = this.player.armorItem.maxDurability;
        el('armor').textContent = cur + '/' + mx;
      } else {
        el('armor').textContent = '0';
      }
    }
    if (el('weapon')) el('weapon').textContent = this.player.weapon ? this.player.weapon.name : '无';
    if (el('kills')) el('kills').textContent = this.kills;
    if (el('survivalTime')) el('survivalTime').textContent = Math.floor(this.survivalTime / 1000) + 's';
    if (el('inventoryCount')) el('inventoryCount').textContent = this.player.inventory.length + '/' + this.bagCapacity;
    if (el('goldFound')) el('goldFound').textContent = this.goldFound;
    // 补给品数量
    const supplyCounts = { smallHealth: 0, bigHealth: 0, armorRepair: 0, grenade: 0 };
    this.player.inventory.forEach(item => {
      if (item && item.isSupply) {
        if (item.id === 'smallHealth') supplyCounts.smallHealth++;
        else if (item.id === 'bigHealth') supplyCounts.bigHealth++;
        else if (item.id === 'armorRepair') supplyCounts.armorRepair++;
        else if (item.id === 'grenade') supplyCounts.grenade++;
      }
    });
    if (el('supplyCount1')) el('supplyCount1').textContent = supplyCounts.smallHealth;
    if (el('supplyCount2')) el('supplyCount2').textContent = supplyCounts.bigHealth;
    if (el('supplyCount3')) el('supplyCount3').textContent = supplyCounts.armorRepair;
    if (el('supplyCount4')) el('supplyCount4').textContent = supplyCounts.grenade;
  }

  toggleInventory() {
    const panel = this.ui.inventoryPanel;
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) this.renderInventory();
  }

  renderInventory() {
    const grid = document.getElementById('inventoryGrid');
    const totalEl = document.getElementById('inventoryValue');
    if (!grid) return;
    grid.innerHTML = '';
    let total = 0;
    // —— 物品列表视图：显示图标/名称/品质/价值，每行一个，带丢弃按钮 ——
    if (this.player.inventory.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'inv-empty-hint';
      empty.textContent = '（背包为空 —— 去搜刮战利品吧！）';
      grid.appendChild(empty);
    } else {
      for (let i = 0; i < this.player.inventory.length; i++) {
        const item = this.player.inventory[i];
        const price = this.getItemPrice(item);
        total += price;
        const row = document.createElement('div');
        row.className = 'inv-item-row rarity-' + (item.rarity || 'white');
        const rarityLabel = GameConfig.RARITY_NAMES[item.rarity] || '普通';
        const iconHtml = this.getIconHtml(item.icon, 'inv-img-icon');
          row.innerHTML = `
            <div class="inv-ic">${iconHtml}</div>
            <div class="inv-info">
              <div class="inv-name">${item.name || '未命名物品'}</div>
              <div class="inv-sub">品质：<span class="inv-rarity">${rarityLabel}</span> · 价值：<span class="inv-price">💰 ${price}</span></div>
            </div>
          `;
        const discardBtn = document.createElement('button');
        discardBtn.className = 'inv-discard-btn';
        discardBtn.textContent = '丢弃';
        discardBtn.addEventListener('click', () => this.discardItem(i));
        row.appendChild(discardBtn);
        grid.appendChild(row);
      }
    }
    if (totalEl) totalEl.textContent = total;
  }

  discardItem(index) {
    if (index < 0 || index >= this.player.inventory.length) return;
    const item = this.player.inventory[index];
    this.showLog(`🗑️ 丢弃 ${item.icon || '📦'} ${item.name}（价值 ${this.getItemPrice(item)}）`, item.rarity || 'white');
    this.player.inventory.splice(index, 1);
    this.renderInventory();
    this.updateHUD();
  }

  isImagePath(str) {
    if (!str || typeof str !== 'string') return false;
    const ext = str.toLowerCase();
    return ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.gif') || ext.endsWith('.webp');
  }

  getIconHtml(icon, className = 'item-img-icon') {
    if (!icon) return '📦';
    if (this.isImagePath(icon)) {
      return `<img src="${icon}" class="${className}" onerror="this.style.display='none'; this.parentElement.innerHTML='📦';" />`;
    }
    return icon;
  }

  // ============================================================
  // 📦 图片资源系统（ImageAsset System）
  // ============================================================
  // 用途：统一管理游戏中所有图片资源（武器贴图、UI图标、敌人装备等）
  //
  // 【图片约定】（重要！所有调用方都必须遵守）
  //   1. 武器图片素材的原始朝向："枪口在图片左侧、枪托在图片右侧"
  //      （这是 CS / 主流素材图的标准朝向）
  //   2. UI 图标（商店、仓库、装备选择）保持原图正立显示
  //
  // 【支持的场景】
  //   ✅ 武器手持渲染（自动翻转 + 自动适应所有 facing 角度）
  //   ✅ 敌人武器显示
  //   ✅ 物品/UI 缩略图（HTML + Canvas）
  //   ✅ 预加载（启动时批量加载）
  //
  // 【使用流程】
  //   1. 在 preloadGameImages() 中注册图片路径
  //   2. 在 game.html 中添加 <link rel="preload" as="image" href="...">
  //   3. 武器定义中 model 字段写图片路径
  //   4. 调用方用本系统的方法渲染
  // ============================================================

  /**
   * 加载并缓存图片（带重试机制）
   * @param {string} src - 图片路径（支持 png/jpg/jpeg/gif/webp）
   * @param {number} maxRetries - 最大重试次数，默认 2
   * @returns {HTMLImageElement|null} 加载完成或加载中的 img 元素
   */
  loadImage(src, maxRetries = 2) {
    if (!src || !this.isImagePath(src)) return null;
    if (this.preloadedImages[src]) {
      const p = this.preloadedImages[src];
      if (p.complete && p.naturalWidth > 0) return p;
    }
    if (this.imageCache[src]) {
      const cached = this.imageCache[src];
      if (cached.error && cached.retries < maxRetries) {
        this.retryLoadImage(src, maxRetries);
      }
      return cached.img || null;
    }

    const img = new Image();
    const entry = {
      img,
      loaded: false,
      error: false,
      retries: 0
    };
    this.imageCache[src] = entry;

    img.onload = () => {
      entry.loaded = true;
      entry.error = false;
      console.log(`✅ 图片加载完成: ${src} (尺寸: ${img.naturalWidth}x${img.naturalHeight})`);
    };

    img.onerror = (e) => {
      entry.error = true;
      console.error(`❌ 图片加载失败 (${src}): ${e.message || '未知错误'}`);
      if (entry.retries < maxRetries) {
        setTimeout(() => this.retryLoadImage(src, maxRetries), 1000 * (entry.retries + 1));
      }
    };

    img.src = src;
    return img;
  }

  /**
   * 重试加载失败的图片
   * @private
   */
  retryLoadImage(src, maxRetries) {
    const entry = this.imageCache[src];
    if (!entry) return;

    entry.retries++;
    console.log(`🔄 重试加载图片 (${entry.retries}/${maxRetries}): ${src}`);

    const img = new Image();
    entry.img = img;
    entry.loaded = false;
    entry.error = false;

    img.onload = () => {
      entry.loaded = true;
      entry.error = false;
      console.log(`✅ 图片加载成功 (重试 ${entry.retries} 次): ${src}`);
    };

    img.onerror = (e) => {
      entry.error = true;
      console.error(`❌ 图片加载失败 (重试 ${entry.retries} 次): ${src}`);
      if (entry.retries < maxRetries) {
        setTimeout(() => this.retryLoadImage(src, maxRetries), 1000 * (entry.retries + 1));
      }
    };

    img.src = src;
  }

  /**
   * 批量预加载图片（游戏启动时调用）
   * @param {string[]} filenames - 图片路径数组
   * @returns {Promise} 所有图片加载完成（或失败）的 Promise 数组
   */
  preloadImages(filenames) {
    const promises = [];
    filenames.forEach(name => {
      promises.push(new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          this.preloadedImages[name] = img;
          console.log(`✅ 预加载完成: ${name}`);
          resolve(name);
        };
        img.onerror = (e) => {
          console.error(`❌ 预加载失败: ${name} - ${e.message || '未知错误'}`);
          reject(new Error(`Failed to preload ${name}`));
        };
        img.src = name;
      }));
    });
    return Promise.allSettled(promises);
  }

  /**
   * 预加载游戏内用到的所有图片资源（在 Game 构造函数中调用）
   * 子类或扩展时可重写此方法添加更多图片
   */
  preloadGameImages() {
    // 武器贴图
    this.preloadImages(['weapon/hql.png', 'weapon/yydj.png', 'weapon/sq.png', 'weapon/tjbq.png', 'weapon/wsd.png', 'weapon/xdq.png']);
    // 容器贴图
    this.preloadImages(['folder/mx.png', 'folder/mt.png', 'folder/ljt.png', 'folder/stb.png', 'folder/dyx.png']);
    // 地图地板瓦片（草地1-8）
    this.preloadImages([
      'floor/草地1.png', 'floor/草地2.png', 'floor/草地3.png', 'floor/草地4.png',
      'floor/草地5.png', 'floor/草地6.png', 'floor/草地7.png', 'floor/草地8.png'
    ]);
    // 地图地板瓦片（FieldsTile Wang Tileset 边匹配瓦片）
    this.preloadImages([
      'floor/FieldsTile_01.png', 'floor/FieldsTile_02.png', 'floor/FieldsTile_03.png',
      'floor/FieldsTile_04.png', 'floor/FieldsTile_05.png', 'floor/FieldsTile_06.png',
      'floor/FieldsTile_07.png', 'floor/FieldsTile_08.png', 'floor/FieldsTile_09.png',
      'floor/FieldsTile_10.png', 'floor/FieldsTile_12.png', 'floor/FieldsTile_13.png',
      'floor/FieldsTile_14.png', 'floor/FieldsTile_15.png', 'floor/FieldsTile_16.png',
      'floor/FieldsTile_18.png', 'floor/FieldsTile_20.png', 'floor/FieldsTile_21.png',
      'floor/FieldsTile_22.png', 'floor/FieldsTile_24.png', 'floor/FieldsTile_25.png',
      'floor/FieldsTile_26.png', 'floor/FieldsTile_28.png', 'floor/FieldsTile_29.png',
      'floor/FieldsTile_30.png'
    ]);
    // 建筑物素材（帐篷1-4 + 房子1-4）
    this.preloadImages([
      'building/帐篷.png', 'building/帐篷2.png', 'building/帐篷3.png', 'building/帐篷4.png',
      'building/房子1.png', 'building/房子2.png', 'building/房子3.png', 'building/房子4.png'
    ]);
    // 障碍物素材（小推车、水井、铁砧、小车）
    this.preloadImages([
      'building/小推车.png', 'building/小车2.png', 'building/水井.png', 'building/铁毡.png'
    ]);
  }

  /**
   * 获取/创建水平翻转版本的 Canvas
   * 用于武器图片：原始"枪口朝左"，翻转后"枪口朝右"（+X 方向）
   * @private
   */
  _getFlippedImage(img) {
    if (!this._flippedImageCache) this._flippedImageCache = new WeakMap();
    if (this._flippedImageCache.has(img)) return this._flippedImageCache.get(img);

    try {
      const off = document.createElement('canvas');
      off.width = img.naturalWidth;
      off.height = img.naturalHeight;
      const offCtx = off.getContext('2d');
      offCtx.save();
      offCtx.scale(-1, 1);
      offCtx.drawImage(img, -img.naturalWidth, 0);
      offCtx.restore();
      this._flippedImageCache.set(img, off);
      return off;
    } catch (e) {
      console.error('[图片资产] 离屏翻转失败:', e);
      return null;
    }
  }

  /**
   * 渲染武器图片到 Canvas（手持/局内）
   *
   * 【调用前置条件】
   *   调用方需先 ctx.save() / translate(手部位置) / rotate(facing)，
   *   此时 ctx 当前坐标系的 +X 方向 = 玩家面对方向 = 枪口目标方向
   *
   * 【自动处理】
   *   ✅ 水平翻转图片（枪口朝左 → 枪口朝右）
   *   ✅ 按 targetLength 等比缩放
   *   ✅ 垂直居中
   *   ✅ 适应所有 facing 角度（无上下颠倒）
   *   ✅ 离屏 Canvas 缓存，每个 Image 只翻转一次
   *   ✅ 加载失败时回退到直接绘制
   *
   * @param {CanvasRenderingContext2D} ctx - 已完成 save/translate/rotate
   * @param {Object} weapon - 武器对象（需含 model 字段）
   * @param {number} targetLength - 目标显示长度（像素），默认 64
   * @returns {boolean} 是否成功绘制
   */
  drawWeaponImageModel(ctx, weapon, targetLength = 64) {
    if (!weapon || !weapon.model || !this.isImagePath(weapon.model)) return false;
    const img = this.loadImage(weapon.model);
    if (!img || !img.complete || img.naturalWidth <= 0) return false;

    // 等比缩放到指定长度
    const scale = targetLength / img.naturalWidth;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;

    // 获取离屏翻转 Canvas
    const flipped = this._getFlippedImage(img);
    if (!flipped) {
      // 离屏失败时回退：直接绘制原图（朝向可能反）
      ctx.drawImage(img, 0, -drawH / 2, drawW, drawH);
      return true;
    }

    // 自动适应 facing 角度：左半圆时额外垂直翻转
    // ctx.rotate(facing) 后，ctx 的 +Y 轴会随 facing 反转
    //   - facing 在 [-π/2, π/2]（右半圆）：图片正立
    //   - facing 在 [π/2, 3π/2]（左半圆）：ctx +Y 反向，图片倒立
    // 通过 ctx.getTransform().a 判断（m.a = cos(facing)）
    const m = ctx.getTransform();
    const needFlipY = m.a < 0;

    if (needFlipY) {
      ctx.save();
      ctx.scale(1, -1);
      ctx.drawImage(flipped, 0, -drawH / 2, drawW, drawH);
      ctx.restore();
    } else {
      ctx.drawImage(flipped, 0, -drawH / 2, drawW, drawH);
    }
    return true;
  }

  /**
   * 绘制地图素材图片
   * 支持等比缩放到目标尺寸，自动居中
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} src - 图片相对路径（支持子目录如 'floor/草地1.png'）
   * @param {number} x - 目标区域左上角 X
   * @param {number} y - 目标区域左上角 Y
   * @param {number} width - 目标宽度
   * @param {number} height - 目标高度
   * @returns {boolean} 是否成功绘制
   */
  drawMapImage(ctx, src, x, y, width, height) {
    if (!src || typeof src !== 'string') return false;
    const img = this.loadImage(src);
    if (!img || !img.complete || img.naturalWidth <= 0) return false;

    // 等比缩放到目标尺寸（保持宽高比）
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const targetRatio = width / height;
    let drawW, drawH, drawX, drawY;

    if (imgRatio > targetRatio) {
      // 图片更宽，以宽度为基准
      drawW = width;
      drawH = width / imgRatio;
    } else {
      // 图片更高，以高度为基准
      drawH = height;
      drawW = height * imgRatio;
    }
    drawX = x + (width - drawW) / 2;
    drawY = y + (height - drawH) / 2;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    return true;
  }

  /**
   * 渲染物品/图标（emoji 或图片均可）到 Canvas
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} icon - emoji 文本 或 图片路径
   * @param {number} x - 中心点 X
   * @param {number} y - 中心点 Y
   * @param {number} size - 目标显示尺寸（像素），默认 24
   * @returns {boolean} 是否成功渲染
   */
  drawIconOrText(ctx, icon, x, y, size = 24) {
    if (!icon) {
      ctx.font = size + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('📦', x, y);
      return true;
    }
    if (this.isImagePath(icon)) {
      const img = this.loadImage(icon);
      if (img && img.complete && img.naturalWidth > 0) {
        const scale = size / Math.max(img.naturalWidth, img.naturalHeight);
        ctx.drawImage(img, x - size / 2, y - size / 2, img.naturalWidth * scale, img.naturalHeight * scale);
        return true;
      } else {
        // 图片还在加载：先绘制 emoji 占位
        ctx.font = size + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📦', x, y);
        return false;
      }
    } else {
      ctx.font = size + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, x, y);
      return true;
    }
  }

  // ============================================================
  // 📦 图片资产系统 结束
  // ============================================================

  drawHealthBar(ctx, x, y, width, height, ratio, offsetY = -8) {
    const barW = width, barH = height;
    const barX = x - barW / 2, barY = y + offsetY;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = ratio > 0.5 ? '#4ade80' : ratio > 0.25 ? '#facc15' : '#ef4444';
    ctx.fillRect(barX, barY, barW * ratio, barH);
  }

  drawArmorBar(ctx, x, y, width, height, ratio, offsetY = -3) {
    const barW = width, barH = height;
    const barX = x - barW / 2, barY = y + offsetY;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(barX, barY, barW * ratio, barH);
  }

  drawDefaultGunShape(ctx, weapon, wcol) {
    // 枪身后部（木质握柄）
    ctx.fillStyle = '#5a3a1a';
    ctx.strokeStyle = '#2a1a0a';
    ctx.lineWidth = 1;
    ctx.fillRect(-8, -5, 10, 10);
    ctx.strokeRect(-8, -5, 10, 10);
    // 枪身主体（金属）
    ctx.fillStyle = '#3a3a3a';
    ctx.strokeStyle = '#111';
    const gunLen = (weapon.id === 'rifle') ? 26 : (weapon.id === 'shotgun' ? 22 : 18);
    ctx.fillRect(2, -4, gunLen, 8);
    ctx.strokeRect(2, -4, gunLen, 8);
    // 枪口发光
    ctx.fillStyle = wcol;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(2 + gunLen - 2, -3, 4, 6);
    ctx.globalAlpha = 1;
    // 瞄准器
    ctx.fillStyle = '#f5a623';
    ctx.fillRect(8, -7, 5, 3);
  }

  /**
   * 通用武器图片渲染（手持/缩略图通用）
   *
   * 坐标约定（重要！所有调用方都必须遵守）：
   *   1. 武器图片素材的原始朝向："枪口在图片左侧、枪托在图片右侧"
   *      （这是 CS / 主流素材图的标准朝向）
   *   2. 调用方需先 ctx.save() / translate(手部位置) / rotate(facing)，
   *      此时 ctx 当前坐标系的 +X 方向 = 玩家面对方向 = 枪口目标方向
   *   3. 本方法不修改 ctx 的变换矩阵（不调用 scale/rotate），
   *      通过缓存的"水平翻转版 ImageData/Canvas"实现翻转
   *
   * 关键：为什么不用 ctx.scale(-1, 1)？
   *   - scale 是相对当前坐标系的，ctx.rotate(facing) 之后再 scale
   *     在 facing=π/2、π 等角度时会出现"上下颠倒"或"反向"
   *   - 9 参数 drawImage 的负 sWidth 在某些浏览器实现里行为不一致
   *   - 用缓存的离屏翻转 canvas 最可靠：行为对所有 facing 角度都一致
   *
   * @param {CanvasRenderingContext2D} ctx - 调用方已完成 save/translate/rotate
   * @param {Object} weapon - 武器对象，需含 model 字段（图片路径）
   * @param {number} targetLength - 目标显示长度（像素），高度按比例自适应
   * @returns {boolean} 是否成功绘制
   */
  drawWeaponImageModel(ctx, weapon, targetLength = 64) {
    if (!weapon || !weapon.model || !this.isImagePath(weapon.model)) return false;
    const img = this.loadImage(weapon.model);
    if (!img || !img.complete || img.naturalWidth <= 0) return false;

    // 等比缩放到指定长度
    const scale = targetLength / img.naturalWidth;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;

    // 获取/创建水平翻转的离屏 canvas
    const flipped = this._getFlippedImage(img);
    if (!flipped) {
      // 离屏 canvas 不可用时回退到直接绘制（枪口朝向反但至少能显示）
      ctx.drawImage(img, 0, -drawH / 2, drawW, drawH);
      return true;
    }

    // 关键：ctx.rotate(facing) 后，ctx 的 +Y 方向会随 facing 反转
    //   - facing 在 [-π/2, π/2]（右半圆）：ctx +Y = 世界 -X（向上），图片正立
    //   - facing 在 [π/2, 3π/2]（左半圆）：ctx +Y = 世界 +X（向下），图片倒立
    // 调用方传入的 ctx 已经 rotate(facing)，所以通过 ctx 当前变换矩阵判断
    //   - ctx 的 (0, 1) 向量在世界中的 (sin, -cos) 方向
    //   - 当 cos(facing) < 0 时（即 facing 在左半圆），需要垂直翻转
    // 这里用 ctx.getTransform() 获取当前矩阵
    const m = ctx.getTransform();
    // m.a = cos(facing), m.c = -sin(facing) (假设没有 scale)
    // facing 在左半圆时 cos(facing) < 0，即 m.a < 0
    const needFlipY = m.a < 0;

    if (needFlipY) {
      // 垂直翻转：在 ctx 坐标系内 scale(1, -1)
      ctx.save();
      ctx.scale(1, -1);
      ctx.drawImage(flipped, 0, -drawH / 2, drawW, drawH);
      ctx.restore();
    } else {
      ctx.drawImage(flipped, 0, -drawH / 2, drawW, drawH);
    }
    return true;
  }

  /**
   * 获取/创建水平翻转版本的 Image 元素
   * 使用离屏 Canvas 做翻转后转 Image，所有 facing 角度行为一致
   * @private
   */
  _getFlippedImage(img) {
    if (!this._flippedImageCache) this._flippedImageCache = new WeakMap();
    if (this._flippedImageCache.has(img)) return this._flippedImageCache.get(img);

    try {
      const off = document.createElement('canvas');
      off.width = img.naturalWidth;
      off.height = img.naturalHeight;
      const offCtx = off.getContext('2d');
      offCtx.save();
      offCtx.scale(-1, 1);
      offCtx.drawImage(img, -img.naturalWidth, 0);
      offCtx.restore();
      this._flippedImageCache.set(img, off);
      return off;
    } catch (e) {
      console.error('[武器渲染] 离屏翻转失败:', e);
      return null;
    }
  }

  openLootModal(items, sourceName) {
    this.pickedLootFlags = items.map(() => false);
    this.currentLootItems = items;
    if (this.ui.lootModalTitle) this.ui.lootModalTitle.textContent = `📦 ${sourceName} · ${items.length}件`;
    if (this.ui.lootModalInfo) this.ui.lootModalInfo.textContent = '点击物品拾取，再次点击取消';
    this.renderLootModal();
    this.ui.lootModal.classList.remove('hidden');
  }

  closeLootModal() {
    // 先将选中的物品添加到背包
    this.currentLootItems.forEach((item, idx) => {
      if (this.pickedLootFlags[idx] && !item.isEmpty) {
        if (this.player.inventory.length < this.bagCapacity) {
          const copy = { ...item };
          // 补全 isSupply 标记（防止被 strip 掉）
          if (!copy.isSupply && (copy.id === 'smallHealth' || copy.id === 'bigHealth' || copy.id === 'armorRepair' || copy.id === 'grenade' || copy.effect)) {
            copy.isSupply = true;
          }
          this.player.inventory.push(copy);
          this.showLog(`✅ 拾取 ${copy.icon} ${copy.name}`, copy.rarity || 'white');
        }
      }
    });
    this.updateHUD();
    this.ui.lootModal.classList.add('hidden');
  }

  renderLootModal() {
    const list = this.ui.lootItemsList;
    list.innerHTML = '';
    this.currentLootItems.forEach((item, idx) => {
      const card = document.createElement('div');
      const rarity = item.rarity || 'white';
      card.className = 'loot-pick-card rarity-' + rarity + (this.pickedLootFlags[idx] ? ' picked' : '');
      const price = this.getItemPrice(item);
      const iconHtml = this.getIconHtml(item.icon, 'loot-img-icon');
      card.innerHTML = `
        <div class="loot-pick-icon">${iconHtml}</div>
        <div class="loot-pick-name">${item.name}</div>
        <div class="loot-pick-rarity">${GameConfig.RARITY_NAMES[rarity]}</div>
        <div class="loot-pick-price">💰 ${price}</div>
      `;
      card.addEventListener('click', () => {
        if (item.isEmpty) return;
        if (this.pickedLootFlags[idx]) { this.pickedLootFlags[idx] = false; }
        else {
          const pickedCount = this.pickedLootFlags.filter(Boolean).length;
          if (this.player.inventory.length + pickedCount >= this.bagCapacity) {
            this.showLog('❌ 背包已满', 'red');
            return;
          }
          this.pickedLootFlags[idx] = true;
        }
        this.renderLootModal();
      });
      list.appendChild(card);
    });
    const totalEl = document.getElementById('lootBagUsed');
    const maxEl = document.getElementById('lootBagMax');
    if (totalEl) totalEl.textContent = this.player.inventory.length + this.pickedLootFlags.filter(Boolean).length;
    if (maxEl) maxEl.textContent = this.bagCapacity;
  }

  lootPickAll() {
    let picked = 0;
    for (let i = 0; i < this.currentLootItems.length; i++) {
      const item = this.currentLootItems[i];
      if (item.isEmpty) continue;
      if (this.player.inventory.length + picked >= this.bagCapacity) break;
      if (!this.pickedLootFlags[i]) {
        this.pickedLootFlags[i] = true;
        picked++;
        if (this.player.inventory.length + picked >= this.bagCapacity) break;
      }
    }
    this.renderLootModal();
  }

  isOnScreen(x, y, width = 30, height = 30, margin = 60) {
    const screenX = x - this.camera.x;
    const screenY = y - this.camera.y;
    return screenX + width + margin > 0 &&
           screenY + height + margin > 0 &&
           screenX - margin < this.canvas.width &&
           screenY - margin < this.canvas.height;
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;

    if (this.gameState !== 'playing' || !this.escapePoint) {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, w, h);
      return;
    }
    ctx.fillStyle = '#2d5a3d';
    ctx.fillRect(0, 0, w, h);

    // ========================================
    // 🌍 地面渲染 - Wang Tileset 边匹配系统
    // ========================================
    const tileSize = this.terrainTileSize || 60;
    const startX = Math.floor(this.camera.x / tileSize);
    const endX = Math.min(startX + Math.ceil(w / tileSize) + 2, Math.ceil(this.mapWidth / tileSize));
    const startY = Math.floor(this.camera.y / tileSize);
    const endY = Math.min(startY + Math.ceil(h / tileSize) + 2, Math.ceil(this.mapHeight / tileSize));

    for (let tx = startX; tx < endX; tx++) {
      for (let ty = startY; ty < endY; ty++) {
        const screenX = tx * tileSize - this.camera.x;
        const screenY = ty * tileSize - this.camera.y;
        // 根据地形网格 + 4 邻边，选出最匹配的 Wang Tileset 瓦片
        const tilePath = this.getWangTilePath(tx, ty);
        if (!this.drawMapImage(ctx, tilePath, screenX, screenY, tileSize, tileSize)) {
          // 图片加载失败时回退到程序化绘制
          if (this.terrainGrid && this.terrainGrid[ty] && this.terrainGrid[ty][tx]) {
            // 草地
            ctx.fillStyle = '#4a9a6d';
            ctx.fillRect(screenX, screenY, tileSize, tileSize);
          } else {
            // 泥土
            ctx.fillStyle = '#8b5a3c';
            ctx.fillRect(screenX, screenY, tileSize, tileSize);
          }
        }
      }
    }
    // ========================================

    this.obstacles.forEach(o => {
      const x = o.x - this.camera.x, y = o.y - this.camera.y;
      if (x + o.width < 0 || y + o.height < 0 || x > w || y > h) return;
      if (o.type === 'building') {
        // 建筑物素材映射（8种变体对应8张图片）
        const buildingSprites = [
          'building/帐篷.png', 'building/帐篷2.png', 'building/帐篷3.png', 'building/帐篷4.png',
          'building/房子1.png', 'building/房子2.png', 'building/房子3.png', 'building/房子4.png'
        ];
        const sprite = buildingSprites[o.variant || 0];
        // 绘制建筑物图片（留底部空间给阴影）
        if (!this.drawMapImage(ctx, sprite, x, y, o.width, o.height)) {
          // 图片加载失败时回退到程序化绘制
          const variants = [
            { main: '#8b4513', base: '#654321', roof: '#c0392b', win: '#f4d35e', pattern: 'wood' },
            { main: '#5a4a3a', base: '#3a2a1a', roof: '#6c757d', win: '#a0c4d4', pattern: 'stone' },
            { main: '#4a6a4a', base: '#2a4a2a', roof: '#7a8a4a', win: '#c8d9a0', pattern: 'ivy' },
            { main: '#a04040', base: '#701f1f', roof: '#8b2c2c', win: '#fde2a6', pattern: 'brick' },
            { main: '#3a6a9a', base: '#2a4a7a', roof: '#1f3a5f', win: '#e0eaff', pattern: 'tile' },
            { main: '#b8926a', base: '#8a6b4a', roof: '#6a4a2a', win: '#d4c28a', pattern: 'tall' },
            { main: '#c9b89a', base: '#a89678', roof: '#8a6a4a', win: '#fff1b0', pattern: 'courtyard' },
            { main: '#d97a3a', base: '#a85a1a', roof: '#f4c78a', win: '#ffe8a8', pattern: 'shop' }
          ];
          const v = variants[o.variant || 0];
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(x + 3, y + o.height - 4, o.width, 6);
          ctx.fillStyle = v.main;
          ctx.fillRect(x, y + 8, o.width, o.height - 8);
          ctx.fillStyle = v.roof;
          if (v.pattern === 'tall') {
            ctx.beginPath();
            ctx.moveTo(x - 4, y + 14);
            ctx.lineTo(x + o.width / 2, y - 8);
            ctx.lineTo(x + o.width + 4, y + 14);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.fillRect(x - 3, y, o.width + 6, 12);
          }
          if (v.pattern === 'wood') {
            ctx.strokeStyle = 'rgba(60,30,10,0.35)';
            ctx.lineWidth = 1;
            for (let py = y + 20; py < y + o.height - 4; py += 10) {
              ctx.beginPath(); ctx.moveTo(x + 2, py); ctx.lineTo(x + o.width - 2, py); ctx.stroke();
            }
          } else if (v.pattern === 'brick' || v.pattern === 'stone') {
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 1;
            for (let py = y + 16; py < y + o.height - 4; py += 8) {
              ctx.beginPath(); ctx.moveTo(x + 2, py); ctx.lineTo(x + o.width - 2, py); ctx.stroke();
            }
          }
          const wWin = 10, hWin = 12;
          for (let wx = x + 8; wx < x + o.width - wWin - 4; wx += wWin + 10) {
            for (let wy = y + 18; wy < y + o.height - hWin - 10; wy += hWin + 10) {
              ctx.fillStyle = v.win;
              ctx.fillRect(wx, wy, wWin, hWin);
              ctx.strokeStyle = 'rgba(0,0,0,0.5)';
              ctx.strokeRect(wx, wy, wWin, hWin);
              ctx.beginPath(); ctx.moveTo(wx + wWin / 2, wy); ctx.lineTo(wx + wWin / 2, wy + hWin);
              ctx.moveTo(wx, wy + hWin / 2); ctx.lineTo(wx + wWin, wy + hWin / 2); ctx.stroke();
            }
          }
          if (o.width > 50 && o.height > 50) {
            ctx.fillStyle = v.base;
            ctx.fillRect(x + o.width / 2 - 8, y + o.height - 20, 16, 20);
            ctx.fillStyle = 'rgba(255,215,120,0.6)';
            ctx.fillRect(x + o.width / 2 + 4, y + o.height - 10, 2, 2);
          }
        }
      } else if (o.type === 'rock') {
        // 障碍物素材映射（4种变体对应4张小型物件）
        const propSprites = [
          'building/小推车.png', 'building/小车2.png', 'building/水井.png', 'building/铁毡.png'
        ];
        const sprite = propSprites[o.variant || 0];
        if (!this.drawMapImage(ctx, sprite, x, y, o.width, o.height)) {
          // 图片加载失败时回退到程序化绘制
          const v = ['#6b6b6b', '#7a6a5a', '#5a6a7a', '#8a7a6a'][o.variant || 0];
          ctx.fillStyle = v;
          ctx.beginPath();
          ctx.ellipse(x + o.width / 2, y + o.height / 2, o.width / 2, o.height / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.beginPath();
          ctx.ellipse(x + o.width / 2 - 3, y + o.height / 2 - 4, o.width / 4, o.height / 6, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (o.type === 'tree') {
        // 树：深绿色圆圈 + 树干
        ctx.fillStyle = '#6a4a2a';
        ctx.fillRect(x + o.width / 2 - 3, y + o.height - 6, 6, 8);
        const greens = ['#2d6a3a', '#3a7a4a', '#4a8a4a'];
        ctx.fillStyle = greens[o.variant || 0];
        ctx.beginPath();
        ctx.arc(x + o.width / 2, y + o.height / 2, o.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(100,200,100,0.35)';
        ctx.beginPath();
        ctx.arc(x + o.width / 2 - 3, y + o.height / 2 - 3, o.width / 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (o.type === 'pond') {
        // 水池：蓝绿色椭圆
        ctx.fillStyle = 'rgba(60,130,170,0.65)';
        ctx.beginPath();
        ctx.ellipse(x + o.width / 2, y + o.height / 2, o.width / 2, o.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(140,200,230,0.5)';
        ctx.beginPath();
        ctx.ellipse(x + o.width / 2 - 6, y + o.height / 2 - 4, o.width / 3, o.height / 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    this.containers.forEach(c => {
      if (!this.isOnScreen(c.x, c.y, c.width, c.height)) return;
      const x = c.x - this.camera.x, y = c.y - this.camera.y;
      const cx = x + c.width / 2;
      const cy = y + c.height / 2;

      if (c.searched) {
        // 已搜索：淡化显示 + 重新刷新进度条
        ctx.globalAlpha = 0.35;
        this.drawIconOrText(ctx, c.icon, cx, cy, 32);
        ctx.globalAlpha = 1;
        // 底部细小进度（表示刷新倒计时）
        const refreshRemaining = Math.max(0, c.refreshTimer || 0);
        const totalRefresh = c.refreshTotal || 20000;
        const progress = 1 - Math.min(1, refreshRemaining / totalRefresh);
        if (refreshRemaining > 0) {
          // 圆圈进度（非常小）
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, 16, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
          ctx.stroke();
        } else {
          // 倒计时结束，圆圈提示已可再次搜索（淡化的感叹号）
          ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(cx, cy, 14, 0, Math.PI * 2);
          ctx.stroke();
        }
        return;
      }

      // 未搜索：醒目光晕（更醒目：更强的光晕
      const pulse = 22 + Math.sin(performance.now() / 180 + c.x * 0.03) * 4;
      const g2 = ctx.createRadialGradient(cx, cy, 4, cx, cy, pulse);
      g2.addColorStop(0, 'rgba(255, 215, 0, 0.55)');
      g2.addColorStop(0.6, 'rgba(255, 215, 0, 0.2)');
      g2.addColorStop(1, 'rgba(255, 215, 0, 0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(cx, cy, pulse, 0, Math.PI * 2); ctx.fill();
      // 外圈脉动
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 16 + Math.sin(performance.now() / 250) * 2, 0, Math.PI * 2);
      ctx.stroke();
      this.drawIconOrText(ctx, c.icon, cx, cy, 40);
    });

    this.items.forEach(item => {
      if (!this.isOnScreen(item.x, item.y, item.width || 20, item.height || 20, 50)) return;
      const x = item.x - this.camera.x, y = item.y - this.camera.y;
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // 品质底色
      const rarityColors = { white: 'rgba(200,200,200,0.25)', green: 'rgba(74,222,128,0.3)', blue: 'rgba(96,165,250,0.3)',
        purple: 'rgba(192,132,252,0.35)', gold: 'rgba(255,215,0,0.4)', red: 'rgba(239,68,68,0.45)' };
      ctx.fillStyle = rarityColors[item.rarity || 'white'] || rarityColors.white;
      const pulse = 18 + Math.sin(performance.now() / 200 + item.x) * 3;
      ctx.beginPath();
      ctx.arc(x + 10, y + 10, pulse, 0, Math.PI * 2);
      ctx.fill();
      this.drawIconOrText(ctx, item.icon, x + 10, y + 10, 22);
    });

    // 撤离点
    const ex = this.escapePoint.x - this.camera.x, ey = this.escapePoint.y - this.camera.y;
    const ecx = ex + this.escapePoint.width / 2, ecy = ey + this.escapePoint.height / 2;
    const pulse = 28 + Math.sin(performance.now() / 200) * 6;
    ctx.fillStyle = 'rgba(0, 206, 201, 0.35)';
    ctx.beginPath(); ctx.arc(ecx, ecy, pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#00cec9';
    ctx.beginPath(); ctx.arc(ecx, ecy, 22, 0, Math.PI * 2); ctx.fill();
    ctx.font = '30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚪', ecx, ecy);

    if (this.monsters) {
      this.monsters.forEach(m => {
        if (!m) return;
        if (!this.isOnScreen(m.x, m.y, m.width, m.height)) return;
      const x = m.x - this.camera.x, y = m.y - this.camera.y;
      const hpRatio = Math.max(0, m.health / m.maxHealth);
      ctx.font = '30px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.icon, x + m.width / 2, y + m.height / 2);
      this.drawHealthBar(ctx, x + m.width / 2, y, 30, 3, hpRatio);
    });
    }

    // 人类敌人（寻金者/探险家）
    if (this.humanEnemies && this.humanEnemies.length > 0) {
      this.humanEnemies.forEach(he => {
        if (!he || !this.isOnScreen(he.x, he.y, he.width, he.height)) return;
        const x = he.x - this.camera.x, y = he.y - this.camera.y;
        const hpRatio = Math.max(0, he.health / he.maxHealth);
        const cx = x + he.width / 2, cy = y + he.height / 2;
        const stateColors = {
          wander: '#888', chase_player: '#ff4d4d', chase_monster: '#ffaa00',
          combat: '#ff8800', flee: '#4ade80', loot: '#60a5fa'
        };
        ctx.fillStyle = stateColors[he.state] || '#888';
        ctx.beginPath(); ctx.arc(cx, cy + 22, 3, 0, Math.PI * 2); ctx.fill();
        ctx.font = '30px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(he.icon || '🧑', cx, cy);
        
        this.drawHealthBar(ctx, cx, y, 30, 3, hpRatio);
        if (he.weapon && he.weapon.icon) {
          this.drawIconOrText(ctx, he.weapon.icon, cx, cy - 22, 16);
        }
        if (he.armorItem && he.armorItem.maxDurability > 0 && he.armorItem.currentDurability !== undefined) {
          const armorRatio = Math.max(0, Math.min(1, he.armorItem.currentDurability / he.armorItem.maxDurability));
          this.drawArmorBar(ctx, cx, y, 30, 2, armorRatio);
        }
      });
    }

    if (this.boss) {
      const b = this.boss;
      const x = b.x - this.camera.x, y = b.y - this.camera.y;
      const hpRatio = Math.max(0, b.health / b.maxHealth);
      const bcx = x + b.width / 2;
      const bcy = y + b.height / 2;

      // BOSS光环：鲜艳的多层圆形
      ctx.fillStyle = 'rgba(255, 20, 20, 0.45)';
      ctx.beginPath(); ctx.arc(bcx, bcy, 55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255, 80, 80, 0.35)';
      ctx.beginPath(); ctx.arc(bcx, bcy, 40, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255, 50, 50, 1)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(bcx, bcy, 42, 0, Math.PI * 2); ctx.stroke();

      // BOSS emoji：一次绘制，不使用 shadowBlur
      ctx.font = '52px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.icon, bcx, bcy);

      // —— Boss 技能可视化（鲜艳版）——
      if (b.skillState === 'warning') {
        if (b.skillLabel === '冲撞') {
          ctx.strokeStyle = 'rgba(0, 170, 255, 0.9)';
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          const dashLen = 600;
          ctx.beginPath();
          ctx.moveTo(bcx, bcy);
          ctx.lineTo(bcx + (b.skillDx || 1) * dashLen, bcy + (b.skillDy || 0) * dashLen);
          ctx.stroke();
        } else if (b.skillLabel === '挥砍') {
          const facing = Math.atan2(b.skillDy || 0, b.skillDx || 1);
          ctx.fillStyle = 'rgba(255, 30, 30, 0.45)';
          ctx.beginPath();
          ctx.moveTo(bcx, bcy);
          ctx.arc(bcx, bcy, 120, facing - Math.PI * 0.4, facing + Math.PI * 0.4);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
          ctx.lineWidth = 3;
          ctx.stroke();
        } else if (b.skillLabel === '火焰弹') {
          const facing = Math.atan2(b.skillDy || 0, b.skillDx || 1);
          ctx.strokeStyle = 'rgba(255, 100, 0, 0.95)';
          ctx.lineWidth = 4;
          for (let i = -1; i <= 1; i++) {
            const ang = facing + i * 0.18;
            ctx.beginPath();
            ctx.moveTo(bcx, bcy);
            ctx.lineTo(bcx + Math.cos(ang) * 400, bcy + Math.sin(ang) * 400);
            ctx.stroke();
          }
        } else if (b.skillLabel === '根须缠绕') {
          if (b._rootMarkers) {
            for (let i = 0; i < b._rootMarkers.length; i++) {
              const r = b._rootMarkers[i];
              const rx = r.x - this.camera.x;
              const ry = r.y - this.camera.y;
              ctx.fillStyle = 'rgba(50, 200, 70, 0.3)';
              ctx.beginPath();
              ctx.arc(rx, ry, r.radius, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = 'rgba(30, 180, 50, 1)';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(rx, ry, r.radius, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        } else {
          // 默认炮击
          ctx.fillStyle = 'rgba(190, 70, 220, 0.3)';
          ctx.beginPath();
          ctx.arc(bcx, bcy, 80, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(220, 60, 255, 1)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(bcx, bcy, 80, 0, Math.PI * 2);
          ctx.stroke();
        }
        // 中心蓄力圆圈
        ctx.fillStyle = 'rgba(255, 230, 0, 0.9)';
        ctx.beginPath();
        ctx.arc(bcx, bcy, 20, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.skillState === 'active') {
        if (b.skillLabel === '冲撞') {
          const ang = Math.atan2(b.skillDy || 0, b.skillDx || 1);
          ctx.save();
          ctx.translate(bcx, bcy);
          ctx.rotate(ang);
          ctx.fillStyle = 'rgba(0, 200, 255, 0.75)';
          ctx.fillRect(-120, -22, 120, 44);
          ctx.restore();
        } else if (b.skillLabel === '根须缠绕' && b._rootMarkers) {
          for (let i = 0; i < b._rootMarkers.length; i++) {
            const r = b._rootMarkers[i];
            const rx = r.x - this.camera.x;
            const ry = r.y - this.camera.y;
            ctx.fillStyle = r.hit ? 'rgba(60, 220, 80, 0.5)' : 'rgba(255, 130, 0, 0.7)';
            ctx.beginPath();
            ctx.arc(rx, ry, r.radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // boss 血条
      const barW = 80, barH = 6;
      const barX = x + b.width / 2 - barW / 2, barY = y - 14;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, x + b.width / 2, barY - 6);
    }

    this.bullets.forEach(b => {
      const x = b.x - this.camera.x, y = b.y - this.camera.y;
      ctx.fillStyle = b.isBoss ? '#ff4444' : '#ffffff';
      ctx.beginPath();
      ctx.arc(x + b.width / 2, y + b.height / 2, b.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = b.isBoss ? '#ffcccc' : '#ffff00';
      ctx.beginPath();
      ctx.arc(x + b.width / 2, y + b.height / 2, b.width / 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // 玩家
    const p = this.player;
    const px = p.x - this.camera.x, py = p.y - this.camera.y;
    const cx = px + p.width / 2;
    const cy = py + p.height / 2;

    // 背景大光圈（脉动更醒目）
    const haloPulse = 32 + Math.sin(performance.now() / 250) * 4;
    const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, haloPulse);
    grad.addColorStop(0, 'rgba(0, 206, 201, 0.65)');
    grad.addColorStop(0.55, 'rgba(0, 206, 201, 0.25)');
    grad.addColorStop(1, 'rgba(0, 206, 201, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, haloPulse, 0, Math.PI * 2); ctx.fill();

    // 外层白色描边圆圈
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.stroke();

    // 无敌状态闪烁
    if (p.invulnerable && Math.floor(performance.now() / 100) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    // 玩家图形（更大 + 阴影）
    ctx.font = '34px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillText('🧑', cx + 1, cy + 2); // 阴影
    ctx.fillText('🧑', cx, cy);

    // 方向三角指示（玩家朝向）
    const dirX = cx + Math.cos(p.facing) * 26;
    const dirY = cy + Math.sin(p.facing) * 26;
    ctx.fillStyle = '#ffeb3b';
    ctx.strokeStyle = '#ff6f00';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(dirX, dirY);
    ctx.lineTo(dirX - Math.cos(p.facing) * 10 + Math.sin(p.facing) * 6,
               dirY - Math.sin(p.facing) * 10 - Math.cos(p.facing) * 6);
    ctx.lineTo(dirX - Math.cos(p.facing) * 10 - Math.sin(p.facing) * 6,
               dirY - Math.sin(p.facing) * 10 + Math.cos(p.facing) * 6);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.globalAlpha = 1;

    // 手持武器（根据武器类型绘制，更明显可见）
    if (p.weapon) {
      const weapon = p.weapon;
      const wcol = weapon.particleColor || '#888';
      // 武器握柄位置（玩家前方一点）
      const handX = cx + Math.cos(p.facing) * 14;
      const handY = cy + Math.sin(p.facing) * 14;
      const perpX = -Math.sin(p.facing);
      const perpY = Math.cos(p.facing);

      if (weapon.type === 'melee') {
        // 近战武器：优先用图片，否则用默认绘制
        if (weapon.model && this.isImagePath(weapon.model)) {
          ctx.save();
          ctx.translate(handX, handY);
          ctx.rotate(p.facing);
          this.drawWeaponImageModel(ctx, weapon, 60);
          ctx.restore();
        } else {
          // 近战武器默认绘制：大剑（发光剑身 + 握柄 + 护手）
          const bladeLen = weapon.range > 70 ? 42 : 30;
          const tipEndX = handX + Math.cos(p.facing) * bladeLen;
          const tipEndY = handY + Math.sin(p.facing) * bladeLen;

          // 剑身外发光
          ctx.strokeStyle = wcol;
          ctx.lineWidth = 8;
          ctx.globalAlpha = 0.35;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(handX, handY);
          ctx.lineTo(tipEndX, tipEndY);
          ctx.stroke();
          ctx.globalAlpha = 1;
          // 剑身主体
          ctx.strokeStyle = '#f5f5f5';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(handX, handY);
          ctx.lineTo(tipEndX, tipEndY);
          ctx.stroke();
          // 剑身高光
          ctx.strokeStyle = wcol;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(handX, handY);
          ctx.lineTo(tipEndX, tipEndY);
          ctx.stroke();
          // 护手（垂直于剑身）
          const guardX1 = handX + Math.cos(p.facing) * 3 + perpX * 10;
          const guardY1 = handY + Math.sin(p.facing) * 3 + perpY * 10;
          const guardX2 = handX + Math.cos(p.facing) * 3 - perpX * 10;
          const guardY2 = handY + Math.sin(p.facing) * 3 - perpY * 10;
          ctx.strokeStyle = '#c9a227';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(guardX1, guardY1);
          ctx.lineTo(guardX2, guardY2);
          ctx.stroke();
          // 剑柄（玩家侧）
          ctx.strokeStyle = '#5a3a1a';
          ctx.lineWidth = 4;
          const handleEndX = handX - Math.cos(p.facing) * 8;
          const handleEndY = handY - Math.sin(p.facing) * 8;
          ctx.beginPath();
          ctx.moveTo(handX, handY);
          ctx.lineTo(handleEndX, handleEndY);
          ctx.stroke();
        }
      } else {
        // 远程武器：图片武器模型（hql.png 等）
        ctx.save();
        ctx.translate(handX, handY);
        ctx.rotate(p.facing);

        // 通用武器图片渲染：自动反转 + 居中向前
        const drawn = this.drawWeaponImageModel(ctx, weapon, 64);
        if (!drawn) {
          this.drawDefaultGunShape(ctx, weapon, wcol);
        }
        ctx.restore();
      }
    }

    // 挥砍特效（扇形）
    this.swingEffects.forEach(sw => {
      const x = sw.cx - this.camera.x;
      const y = sw.cy - this.camera.y;
      const t = sw.life / sw.maxLife;
      const alpha = t * 0.55;
      ctx.globalAlpha = alpha;

      if (sw.isThrust) {
        // 突刺特效：长条矩形
        const len = sw.thrustLength * (0.6 + 0.4 * t);
        const hw = sw.thrustWidth / 2;
        const fx = Math.cos(sw.facing), fy = Math.sin(sw.facing);
        const px2 = -fy, py2 = fx; // 垂直方向
        // 矩形四个角点
        const p1x = x + px2 * hw, p1y = y + py2 * hw;
        const p2x = x - px2 * hw, p2y = y - py2 * hw;
        const p3x = x + fx * len - px2 * hw * t, p3y = y + fy * len - py2 * hw * t;
        const p4x = x + fx * len + px2 * hw * t, p4y = y + fy * len + py2 * hw * t;

        ctx.fillStyle = sw.color;
        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.lineTo(p3x, p3y);
        ctx.lineTo(p4x, p4y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // 扇形挥砍
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, sw.range, sw.facing - sw.sweep / 2, sw.facing + sw.sweep / 2);
        ctx.stroke();
        ctx.fillStyle = sw.color;
        ctx.globalAlpha = alpha * 0.3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, sw.range * (0.7 + 0.3 * t), sw.facing - sw.sweep / 2, sw.facing + sw.sweep / 2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });

    this.particles.forEach(pt => {
      const x = pt.x - this.camera.x, y = pt.y - this.camera.y;
      ctx.globalAlpha = pt.alpha;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(x, y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
  showLog(text, rarity, level = 'info') {
    const el = document.createElement('div');
    el.className = 'log-entry rarity-' + (rarity || 'white') + ' log-level-' + level;
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    el.innerHTML = `<span class="log-timestamp">[${timestamp}]</span> ${text}`;
    this.ui.lootLog.appendChild(el);
    el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    setTimeout(() => {
      if (el.parentNode) {
        el.classList.add('log-fadeout');
        setTimeout(() => {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 300);
      }
    }, 4000);

    if (level === 'error') {
      console.error('[Game Error]', text);
    } else if (level === 'warn') {
      console.warn('[Game Warning]', text);
    }
  }

  logError(error, context = '') {
    const message = error.message || error.toString();
    const fullMessage = context ? `${context}: ${message}` : message;
    console.error(`[Game Error] ${fullMessage}`, error.stack);
    if (this.gameState === 'playing') {
      this.showLog(`❌ 游戏错误: ${message}`, 'red', 'error');
    }
  }

  logWarning(message) {
    console.warn('[Game Warning]', message);
    if (this.gameState === 'playing') {
      this.showLog(`⚠️ ${message}`, 'orange', 'warn');
    }
  }
}

if (!window.game) window.game = new Game();

