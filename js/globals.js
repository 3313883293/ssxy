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
const AVAILABLE_CHARS = ['模板一', '模板二', '模板三', '鲁盼旋'];
let selectedSlots = [];
let pendingSlotIndex = -1;
let pendingRole = null;

// ==================== 自选敌人状态 ====================
const AVAILABLE_ENEMIES = ['纸糊稻草人', '铁皮稻草人', '标准稻草人', '灵敏稻草人', '再生稻草人', '开车警察'];

// ==================== 当前选中关卡（0/1/2，-1=自选敌人） ====================
let currentSelectedLevel = 0;
let enemySlots = [];
let pendingEnemyIndex = -1;

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
    '再生稻草人': ['再生：回合结束时回复500HP']
};
