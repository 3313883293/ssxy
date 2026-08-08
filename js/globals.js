// globals.js - 全局变量、DOM引用、工具函数

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
const AVAILABLE_CHARS = ['模板一', '模板二', '模板三'];
let selectedSlots = [];

function getAvailableChars() {
    // v0.316：解锁只认星级——鲁盼旋篇版块点击解锁后写 pwgame_lu_unlocked；不再看 pwgame_cleared.includes(3)
    if (getLuUnlocked()) return ['模板一', '模板二', '模板三', '鲁盼旋'];
    return ['模板一', '模板二', '模板三'];
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
                if (level >= 0 && level <= 3) {
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
    for (const level in map) {
        if (map[level] && map[level].base) n++;
        if (map[level] && map[level].special) n++;
    }
    return n;
}

// 加星（去重：同关同类型已拿则 no-op），写回 localStorage
function addStar(level, type) {
    if (level < 0 || level > 3 || (type !== 'base' && type !== 'special')) return;
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

// ==================== 自选敌人状态 ====================
// v0.309：测试关可自选全部角色（含我方角色）
const AVAILABLE_ENEMIES = ['模板一', '模板二', '模板三', '鲁盼旋', '纸糊稻草人', '铁皮稻草人', '标准稻草人', '灵敏稻草人', '再生稻草人', '持盾警察', '持棍警察', '持枪警察', '开车警察', '李雅礼', '云长郡'];

// ==================== 当前选中关卡（0/1/2，-1=自选敌人） ====================
let currentSelectedLevel = 0;
// v0.309：敌方 6 槽 = 前 3 出场 + 后 3 后备（后备经 benchEnemy 补位机制入场）
let enemySlots = [];

// ==================== 角色被动/固有机制文案（角色介绍中显示在技能之前，敌我通用） ====================
const PASSIVE_INFO = {
    '鲁盼旋': [
        '黎明级先天能力者：回合结束时，若本回合未使用技能，则回复200算力',
        '惩恶之火：友方受伤时，伤害来源获得1层「恶」；回合结束时，获得场上总「恶」层数的「愤怒」（上限5层）；友方阵亡时获得3层「愤怒」；技能命中时施加分配硬币数级「燃烧」（目标「燃烧」≤3层且自身有「愤怒」时，消耗1层额外+1层）'
    ],
    '模板一': [], '模板二': [], '模板三': [],
    '持盾警察': [], '持棍警察': [], '持枪警察': [],
    '开车警察': ['技能循环（AI）：【加油】×2 → 【开创】 → 【刹车】'],
    '李雅礼': ['倒戈：阵亡后在我方队伍最右方（紧挨敌人）复活，仍由AI操控'],
    '云长郡': [
        '部下亡灵之怨恨：受击减伤100%，场上每阵亡1名角色减伤-15%；减伤跌破0%转为受到伤害加成；减伤每回合开始判定，回合内死亡下回合生效；每回合开始时若场上只剩自己且召唤池非空，召唤2个警察怨灵（池：2持盾2持棍4持枪2车，怨灵为原单位一半HP与初始算力，怨灵车为25%HP）'
    ],
    '纸糊稻草人': [], '铁皮稻草人': [], '标准稻草人': [], '灵敏稻草人': [],
    '再生稻草人': ['再生：回合结束时回复500HP'],
    '训练木偶': ['教程专用演示木偶：两个技能分别演示普通防御与破防（无视防御）']
};
