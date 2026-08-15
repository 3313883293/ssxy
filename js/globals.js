// globals.js - 全局变量、DOM引用、工具函数

// ==================== 版本号（v0.663：主界面显示，单一来源，随版本快照更新） ====================
const GAME_VERSION = 'v0.665';

// ==================== 战斗状态实例 ====================
let battleState = new BattleState();
let battleLog = [];

function repositionAll() { battleState.repositionAll(); }

// ==================== DOM 引用 ====================
const allCharsDiv = document.getElementById('allChars');
const actionContent = document.getElementById('actionContent');
const turnDisplay = document.getElementById('turnDisplay');
const logPanel = document.getElementById('logPanel');
const nextRoundBtn = document.getElementById('nextRoundBtn');
const skillDetailDiv = document.getElementById('skillDetail');

// ==================== 日志 ====================
function log(msg) {
    const p = document.createElement('p');
    p.innerHTML = renderGlossaryText(msg);   // 日志中的特殊词条可点击弹出解释
    logPanel.appendChild(p);
    logPanel.scrollTop = logPanel.scrollHeight;
    battleLog.push(msg);
}

// ==================== 选角状态 ====================
// v0.309：选取逻辑统一由 selection.js 的 createSelectionModule 工厂管理（敌我共用同一套，
//          pending 待选状态在工厂闭包内，不再需要全局变量）
// v0.316：初始我方仅三模板；鲁盼旋篇 ⭐≥6 后可在版块点击解锁「鲁盼旋」（完全替代原通关第四关自动解锁）
// v0.320：新增「灼华」进初始可选池（燃烧 dot 手）
// v0.5 改：灼华不再初始可用——灼华篇 ⭐≥4 后可在灼华篇版块点击解锁（key pwgame_zh_unlocked）；未解锁时
//          仅灼华篇第三关锁槽强制 AI 上场（Boss 关剧情参战），不进初始可选池
const AVAILABLE_CHARS = ['模板一', '模板二', '模板三'];
let selectedSlots = [];

function getAvailableChars() {
    // v0.316：解锁只认星级标记——鲁盼旋/灼华各管各的（pwgame_lu_unlocked / pwgame_zh_unlocked），不再看 pwgame_cleared
    // v0.6：张子曦按张子曦篇 ⭐ 版块点击解锁（pwgame_zhang_unlocked）
    const chars = ['模板一', '模板二', '模板三'];
    if (getLuUnlocked()) chars.push('鲁盼旋');
    if (getZhUnlocked()) chars.push('灼华');
    if (getZhangUnlocked()) chars.push('张子曦');
    return chars;
}

// ==================== ⭐ 星级系统（v0.316：鲁盼旋篇 8 星收集，≥6 星点击解锁鲁盼旋） ====================
// pwgame_stars 结构：{ "0": {"base":true,"special":true}, "2": {"base":true} }（键=关号，两种胜利各 1 星）
// base=基础胜利（全灭），special=特殊胜利（达成即记录）；仅正式关 0~3 发星，教程/测试关不发
function getStarMap() {
    let map = {};
    try { map = JSON.parse(localStorage.getItem('pwgame_stars') || '{}'); } catch (e) {}
    if (typeof map !== 'object' || map === null) map = {};
    // 惰性追溯补星：已通关正式关 → 补 base 星（幂等，老玩家按通关记录自动拿到基础星）
    try {
        const cleared = JSON.parse(localStorage.getItem('pwgame_cleared') || '[]');
        let changed = false;
        if (Array.isArray(cleared)) {
            cleared.forEach(level => {
                if (level >= 0 && level <= 8) {   // v0.6：张子曦篇 7/8 也追溯补星
                    if (!map[level]) map[level] = {};
                    if (!map[level].base) { map[level].base = true; changed = true; }
                }
            });
        }
        if (changed) localStorage.setItem('pwgame_stars', JSON.stringify(map));
    } catch (e) {}
    return map;
}

function getStarCount() {
    const map = getStarMap();
    let n = 0;
    [0, 1, 2, 3].forEach(level => {   // v0.5 fix：仅统计鲁盼旋篇（0~3），勿混入灼华篇（4/5/6）
        if (map[level] && map[level].base) n++;
        if (map[level] && map[level].special) n++;
    });
    return n;
}

// v0.5：灼华篇星数（只统计 4/5/6 关，标题显示「🔥 灼华篇 ⭐ x/6」）
function getStarCountZh() {
    const map = getStarMap();
    let n = 0;
    [4, 5, 6].forEach(lv => {
        if (map[lv] && map[lv].base) n++;
        if (map[lv] && map[lv].special) n++;
    });
    return n;
}

// v0.6：张子曦篇星数（只统计 7/8 关）
function getStarCountZhangZiXi() {
    const map = getStarMap();
    let n = 0;
    [7, 8].forEach(lv => {
        if (map[lv] && map[lv].base) n++;
        if (map[lv] && map[lv].special) n++;
    });
    return n;
}

// 加星（去重：同关同类型已拿则 no-op），写回 localStorage（v0.6：正式关扩到 0~8）
function addStar(level, type) {
    if (level < 0 || level > 8 || (type !== 'base' && type !== 'special')) return;
    const map = getStarMap();
    if (!map[level]) map[level] = {};
    if (map[level][type]) return;   // 已拿过，去重
    map[level][type] = true;
    try { localStorage.setItem('pwgame_stars', JSON.stringify(map)); } catch (e) {}
}

function getLuUnlocked() {
    try { return localStorage.getItem('pwgame_lu_unlocked') === '1'; } catch (e) { return false; }
}
function setLuUnlocked() {
    try { localStorage.setItem('pwgame_lu_unlocked', '1'); } catch (e) {}
}
// v0.5 改：灼华解锁标记（灼华篇 ⭐≥4 版块点击解锁后写 '1'）
function getZhUnlocked() {
    try { return localStorage.getItem('pwgame_zh_unlocked') === '1'; } catch (e) { return false; }
}
function setZhUnlocked() {
    try { localStorage.setItem('pwgame_zh_unlocked', '1'); } catch (e) {}
}
// v0.6：张子曦解锁标记（张子曦篇 ⭐ 达标后版块点击解锁，key pwgame_zhang_unlocked）
function getZhangUnlocked() {
    try { return localStorage.getItem('pwgame_zhang_unlocked') === '1'; } catch (e) { return false; }
}
function setZhangUnlocked() {
    try { localStorage.setItem('pwgame_zhang_unlocked', '1'); } catch (e) {}
}

// ==================== 自选敌人状态 ====================
// v0.309：测试关可自选全部角色（含我方角色）
const AVAILABLE_ENEMIES = ['模板一', '模板二', '模板三', '鲁盼旋', '灼华', '张子曦', '纸糊稻草人', '铁皮稻草人', '标准稻草人', '灵敏稻草人', '再生稻草人', '持盾警察', '持棍警察', '持枪警察', '开车警察', '李雅礼', '云长郡', '烬火信徒', '焦木傀儡', '引火学徒', '焚香祭司', '焚天祭司·烛央'];

// ==================== 当前选中关卡（0/1/2，-1=自选敌人） ====================
let currentSelectedLevel = 0;
// v0.309：敌方 6 槽 = 前 3 出场 + 后 3 后备（后备经 benchEnemy 补位机制入场）
let enemySlots = [];

// ==================== 角色被动/固有机制文案（角色介绍中显示在技能之前，敌我通用） ====================
const PASSIVE_INFO = {
    '鲁盼旋': [
        '黎明级先天能力者：回合结束时，若本回合未使用技能，则回复 200 算力',
        '惩恶之火：友方受伤时，伤害来源获得 1 层「恶」；回合结束时，获得场上总「恶」层数的「愤怒」；友方阵亡时愤怒 +3 级；技能命中时施加分配硬币数级「燃烧」（目标「燃烧」≤3 层且自身「愤怒」≥1 级时，消耗 1 级额外 +1 层）',
        '愤怒（上限 5 级）：每 2 级基础伤害 +100、每 2 级防御 -50；不回复算力（不受通用触发影响）'
    ],
    '模板一': [], '模板二': [], '模板三': [],
    '持盾警察': [], '持棍警察': [], '持枪警察': [],
    '开车警察': ['技能循环（AI）：【加油】×2 → 【开创】 → 【刹车】'],
    '李雅礼': ['倒戈：阵亡后在我方队伍最右方（紧挨敌人）复活，仍由 AI 操控'],
    '云长郡': [
        '「怨恨」（特殊情感激荡，上限 10 级）：受击减伤 = 100% − 怨恨等级×15%，跌破 0% 转为受到伤害加成；每 3 级基础伤害 +50、防御 -50；同阵营（含召唤的警察怨灵）阵亡怨恨 +1 级；不回复算力；减伤每回合开始判定',
        '召唤怨灵：每回合开始时若场上只剩自己且召唤池非空，召唤 2 个警察怨灵（池：2持盾2持棍4持枪2车，怨灵为原单位一半血量与初始算力，怨灵车为 25% 血量）'
    ],
    '灼华': [
        '黎明级后天能力者：受到的直接伤害减免 20%',
        '添薪：技能命中已带「燃烧」的目标时，该目标「燃烧」层数 +1',
        '风助火势：回合结束时，所有带「燃烧」的敌方单位「燃烧」等级 +1'
    ],
    '纸糊稻草人': [], '铁皮稻草人': [], '标准稻草人': [], '灵敏稻草人': [],
    '再生稻草人': ['再生：回合结束时回复 500 血量'],
    '训练木偶': ['教程专用演示木偶：两个技能分别演示普通防御与破防（无视防御）'],
    // v0.5 烬火教团
    '烬火信徒': [],
    '焦木傀儡': ['易燃：受到的「燃烧」dot 伤害×1.5'],
    '引火学徒': [],
    '焚香祭司': ['技能循环（AI）：【焚香】→【祭火】反复；【焚香】给友军「燃烧」等级 +1 并回复自身算力'],
    '焚天祭司·烛央': [
        '薪火不息：回合结束时把场上全体「燃烧」等级之和转为自身「狂炎」层数；每层「狂炎」使【烈焰鞭】/【焚天祭】伤害 +150、防御 -20',
        '焚尽薪火：死亡时把「狂炎」层数转成残余敌方的「燃烧」等级（临死纵火）',
        '技能循环（AI）：【焚天祭】→【烈焰鞭】→【焚天祭】→【火灵召唤】→【烈焰鞭】'
    ],
    // v0.6 张子曦（被动待用户后补）
    '张子曦': []
};

// ==================== 主界面版本号显示（v0.663） ====================
// index.html 主界面标题下预留 #gameVersion 占位元素，此处按 GAME_VERSION 填充；
// globals.js 在 body 末尾加载，DOM 已就绪；无占位元素时静默跳过（不影响其他页面复用）
const gameVersionEl = document.getElementById('gameVersion');
if (gameVersionEl) gameVersionEl.textContent = GAME_VERSION;
