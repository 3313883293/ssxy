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
    p.textContent = msg;
    logPanel.appendChild(p);
    logPanel.scrollTop = logPanel.scrollHeight;
    battleLog.push(msg);
}

// ==================== 选角状态 ====================
const AVAILABLE_CHARS = ['模板一', '鲁盼旋'];
let selectedSlots = [];
let pendingSlotIndex = -1;
let pendingRole = null;

// ==================== 自选敌人状态 ====================
const AVAILABLE_ENEMIES = ['纸糊稻草人', '铁皮稻草人', '标准稻草人', '灵敏稻草人', '再生稻草人'];
let enemySlots = [];
let pendingEnemyIndex = -1;
