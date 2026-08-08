// enemySelect.js - 自选敌人界面
// v0.309：选角逻辑委托给 selection.js 的通用选取模块（敌我共用同一套，模式由设置界面切换）

const enemySelection = createSelectionModule({
    slotsId: 'enemySlots',
    rosterId: 'enemyRoster',
    detailPanelId: 'enemyDetailPanel',
    rosterSource: AVAILABLE_ENEMIES,
    getSlots: () => enemySlots,
    setSlots: (arr) => { enemySlots = arr; },
    slotCount: 6,
    slotGroups: [
        { label: '出场', count: 3 },
        { label: '后备', count: 3 }
    ],
    fillColor: '#e74c3c',
    emptyPendingDesc: '点击选敌',
    emptyDesc: '点击空格选敌',
    rosterClickExtra: (roleName) => renderRoleDetail(roleName, 'enemyDetailPanel')
});

// —— 薄封装：保留既有函数名/导出 ——
function initEnemySelection()    { enemySelection.init(); }
function clickEnemySlot(index)   { enemySelection.clickSlot(index); }
function selectRosterEnemy(name) { enemySelection.selectRole(name); }
function renderEnemySlots()      { enemySelection.renderSlots(); }
function renderEnemyRoster()     { enemySelection.renderRoster(); }
