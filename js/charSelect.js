// charSelect.js - 选角色界面 + 角色详情预览
// v0.309：选角逻辑委托给 selection.js 的通用选取模块（敌我共用同一套，模式由设置界面切换）

const charSelection = createSelectionModule({
    slotsId: 'charSlots',
    rosterId: 'charRoster',
    detailPanelId: 'roleDetailPanel',
    rosterSource: getAvailableChars(),
    getSlots: () => selectedSlots,
    setSlots: (arr) => { selectedSlots = arr; },
    slotCount: 3,
    fillColor: '#2ecc71',
    emptyPendingDesc: '点击选人',
    emptyDesc: '点击空格选人',
    rosterClickExtra: (roleName) => showRoleInfo(roleName),
    // v0.310：教程关首次放入角色 → 推进教学步骤①→②（DOM 直接调用模块闭包，钩子须挂模块层）
    onSlotsChange: (slots) => {
        if (typeof Tutorial !== 'undefined' && Tutorial.active && Tutorial.step === 'char-select' && slots.some(r => r !== null)) {
            Tutorial.advance('char-select');
        }
    }
});

// —— 薄封装：保留既有函数名/导出，避免破坏其它引用 ——
function initCharSelection() {
    charSelection.setRosterSource(getAvailableChars());   // v0.316：现取解锁状态，鲁盼旋解锁后同会话立即可选
    charSelection.init();
}
function clickSlot(index)       { charSelection.clickSlot(index); }
function selectRosterChar(name) { charSelection.selectRole(name); }
function renderCharSlots()      { charSelection.renderSlots(); }
function renderRoster()         { charSelection.renderRoster(); }

function startLevelSelect() {
    const count = selectedSlots.filter(r => r !== null).length;
    if (count === 0) { showModal({ title: '提示', message: '至少选择一个角色出战！' }); return; }
    if (currentSelectedLevel === -1) {
        initEnemySelection();
        showPage('pageSelectEnemy');
    } else {
        // v0.310：教程关推进教学步骤②→③（确认出战），随后进入战斗
        if (typeof Tutorial !== 'undefined') {
            if (Tutorial.active && Tutorial.step === 'confirm') Tutorial.advance('confirm');
        }
        startBattle(currentSelectedLevel);
    }
}

// ==================== 关卡选择 → 介绍 ====================
// enemies：出场敌方（可点击查看详情，含被动/技能/属性）；intro 只写打法要点，机制细节见敌方详情
const LEVEL_INFO = [
    { title: '第一关', desc: '持盾警察 ×1　持棍警察 ×1　持枪警察 ×1', enemies: ['持盾警察', '持棍警察', '持枪警察'], intro: '持棍警察【一秒18棍】为18段多段攻击，持枪警察【开火】远程高伤，建议优先集火持枪警察。' },
    { title: '第二关', desc: '持盾警察 ×1　持棍警察 ×1　持枪警察 ×1 ＋ 开车警察待命', enemies: ['持盾警察', '持棍警察', '持枪警察', '开车警察'], intro: '开车警察【加油】后防御-100、速度+2，是其最脆的窗口期，建议趁此时集火；【刹车】后防御+200更难打，且速度差拉大令【开创】伤害更高。' },
    { title: '第三关', desc: '李雅礼 ×1　持枪警察 ×2 ＋ 开车警察待命', enemies: ['李雅礼', '持枪警察', '开车警察'], intro: '李雅礼死后会倒戈为我方（详见其被动），持枪警察远程高伤，前排阵亡后开车警察入场补位。' },
    { title: '☠️ 第四关 · Boss', desc: '云长郡 ×1（亡灵怨恨）', enemies: ['云长郡'], intro: '鲁盼旋将与你们并肩作战（锁定 1 号位，由 AI 操控），再选 2 名上场 + 1 名待命。受击减伤100%且随阵亡递减，减伤跌破0%后转加伤；注意【催眠气体释放】会使目标「暂时昏迷」。机制细节见其被动。' },
    { title: '🎯 测试关 · 自选任意角色', desc: '自由搭配全部角色', enemies: [], intro: '自由搭配全部角色（含我方角色），测试技能与机制，没有固定关卡配置。' },
    { title: '🎓 新手教程', desc: '训练木偶 ×1', enemies: ['训练木偶'], intro: '本关将引导你：①选角与站位 ②技能与算力 ③目标选择 ④防御机制。只需选择 1 名角色出战，前半段有教学引导，后半段自由练习。' }
];

function selectLevel(level) {
    currentSelectedLevel = level;
    // v0.310：-2 教程关取索引 5（-1 测试关取索引 4，0~3 正式关取自身）
    const info = LEVEL_INFO[level === -1 ? 4 : level === -2 ? 5 : level];
    document.getElementById('introTitle').textContent = info.title;
    // 出场敌方卡（可点击查看详情，去重显示）
    const enemyCards = (info.enemies || []).filter((v, i, a) => a.indexOf(v) === i)
        .map(name => `<div class="level-intro-enemy" onclick="renderRoleDetail('${name}', 'introDetailPanel')">${name}</div>`).join('');
    document.getElementById('introContent').innerHTML = `
        <div class="level-intro-desc">敌方配置：${renderGlossaryText(info.desc)}</div>
        ${enemyCards ? `<div class="level-intro-enemies">出场敌方（点击查看详情）：</div><div class="level-intro-enemy-row">${enemyCards}</div>` : ''}
        <div class="level-intro-text">${renderGlossaryText(info.intro)}</div>`;
    showPage('pageLevelIntro');
}

function confirmLevel() {
    // v0.311：第四关 = 出战3（1 号锁定鲁盼旋 AI）+ 待命1；教程关 1 槽；其余 3 槽
    if (currentSelectedLevel === 3) {
        charSelection.setSlotGroups([{ label: '出战', count: 3 }, { label: '待命', count: 1 }]);
        charSelection.setLockedSlot(0, '鲁盼旋');
    } else {
        charSelection.setSlotGroups(null);
        charSelection.setLockedSlot(null, null);
        if (currentSelectedLevel === -2) charSelection.setSlotCount(1);
    }
    initCharSelection();
    showPage('pageSelectChar');
    // v0.310：教程关进入选角页即启动教学引导（步骤①）
    if (currentSelectedLevel === -2 && typeof Tutorial !== 'undefined') Tutorial.begin();
}

// ==================== 角色详情预览（敌我通用：被动/机制在前，技能在后，特殊效果按触发时点写在技能末尾） ====================
function renderRoleDetail(roleName, panelId) {
    const panel = document.getElementById(panelId);
    const header = panel.querySelector('.role-detail-header');
    const body = panel.querySelector('.role-detail-body');
    const tmpChar = createRoleInstance(roleName, 'player', 0);
    if (!tmpChar) { panel.style.display = 'none'; return; }

    const defVal = getRoleDefRange(roleName);
    const spdRange = getRoleSpeedRange(roleName);
    header.innerHTML = `
        <span class="role-detail-icon">📋</span>
        <span class="role-detail-name">${roleName}</span>
        <span class="role-detail-stats">${renderGlossaryText(`HP ${tmpChar.maxHp} ｜ SP ${tmpChar.maxSP}+${tmpChar.spRegen}/回 ｜ 防${defVal} ｜ 速${spdRange}`)}</span>
    `;

    let html = '';
    // 🔰 被动/机制（标在技能之前）
    const passives = PASSIVE_INFO[roleName] || [];
    html += '<div class="rd-section"><div class="rd-section-title">🔰 被动 / 机制</div>';
    if (passives.length === 0) {
        html += '<div class="rd-passive" style="color:#888;">' + renderGlossaryText('无特殊被动') + '</div>';
    } else {
        html += passives.map(p => '<div class="rd-passive">' + renderGlossaryText(p) + '</div>').join('');
    }
    html += '</div>';

    // ⚡ 技能（特殊效果按触发时点写在末尾）
    html += '<div class="rd-section"><div class="rd-section-title">⚡ 技能</div>';
    tmpChar.skills.forEach(skill => {
        const formula = `${skill.baseDamage} + ${skill.bonusDamage}×硬币(${skill.coinCount})`;
        html += `<div class="rd-skill">
            <div class="rd-skill-name">【${skill.name}】</div>
            <div class="rd-skill-info">${renderGlossaryText(`消耗${skill.spCost}算力 ｜ 距离${skill.attackRange} ｜ ${formula}`)}</div>
            ${skillEffectLines(skill).map(l => `<div class="rd-skill-effect">${renderGlossaryText(l)}</div>`).join('')}
        </div>`;
    });
    html += '</div>';

    body.innerHTML = html;
    panel.style.display = 'block';
}

function showRoleInfo(roleName) {
    renderRoleDetail(roleName, 'roleDetailPanel');
}

// ==================== 鲁盼旋篇：可收纳版块 + 逐关解锁（v0.311）+ ⭐ 星级解锁（v0.316） ====================
function toggleLuSection() {
    const body = document.getElementById('luSectionBody');
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    if (!open) updateLevelLocks();   // 展开时刷新解锁状态
    updateLuStars();                 // v0.316：星数 + 解锁区随展开/收起刷新
}

// v0.316：⭐ 星数显示 + 鲁盼旋解锁入口（三态：未满6星 / 可解锁 / 已解锁）
function updateLuStars() {
    const title = document.getElementById('luSectionTitle');
    const body = document.getElementById('luSectionBody');
    if (title) {
        const open = body && body.style.display !== 'none';
        title.textContent = '📖 鲁盼旋篇 ⭐ ' + getStarCount() + '/8 ' + (open ? '▾' : '▸');
    }
    const area = document.getElementById('luUnlockArea');
    if (!area) return;
    const n = getStarCount();
    if (getLuUnlocked()) {
        area.innerHTML = '<div style="margin:10px 2px;padding:10px 12px;background:#16213e;border:2px solid #2ecc71;border-radius:8px;color:#2ecc71;font-weight:bold;text-align:center;">✅ 鲁盼旋已解锁</div>';
    } else if (n >= 6) {
        area.innerHTML = '<button class="btn-main" style="width:100%;background:#f9ca24;color:#222;margin:10px 0;" onclick="unlockLu()">🔓 点击解锁鲁盼旋（⭐' + n + '/8）</button>';
    } else {
        area.innerHTML = '<div style="margin:10px 2px;padding:10px 12px;background:#16213e;border:1px dashed #555;border-radius:8px;color:#888;text-align:center;">🔒 集齐 6 星解锁鲁盼旋（当前 ⭐' + n + '/8）</div>';
    }
}

function unlockLu() {
    // v0.319：全部弹窗改为游戏内自定义弹窗（替代浏览器原生 alert/confirm）
    if (getStarCount() < 6) { showModal({ title: '提示', message: '还需集齐 6 颗星（当前 ' + getStarCount() + '/8）！' }); return; }
    showModal({
        title: '解锁鲁盼旋',
        message: '集齐 ' + getStarCount() + '/8 星，确定解锁鲁盼旋吗？',
        type: 'confirm',
        onConfirm: () => {
            setLuUnlocked();
            updateLuStars();
            showModal({ title: '🎉 解锁成功', message: '鲁盼旋已解锁！现在可在选角界面使用她了。' });
        }
    });
}

function getCleared() {
    try { return JSON.parse(localStorage.getItem('pwgame_cleared') || '[]'); }
    catch (e) { return []; }
}
// 正式关 n（0~3）解锁：第一关恒解锁，其余需通关上一关（复用 pwgame_cleared）
function isLevelUnlocked(n) {
    if (n === 0) return true;
    return getCleared().includes(n - 1);
}
function updateLevelLocks() {
    const cleared = getCleared();
    for (let n = 0; n <= 3; n++) {
        const card = document.getElementById('levelCard' + n);
        if (!card) continue;
        const h3 = card.querySelector('h3');
        if (!h3.dataset.orig) h3.dataset.orig = h3.textContent;
        const unlocked = isLevelUnlocked(n);
        const done = cleared.includes(n);
        card.classList.toggle('level-locked', !unlocked);
        card.onclick = unlocked ? () => selectLevel(n) : () => showModal({ title: '提示', message: '🔒 通关上一关后解锁本关！' });
        h3.textContent = (unlocked ? (done ? '✅ ' : '') : '🔒 ') + h3.dataset.orig;
    }
}

function getRoleDefRange(roleName) {
    const defMap = {
        '模板一': 200, '模板二': 100, '模板三': 300, '鲁盼旋': 200, '灼华': 150,
        '持盾警察': 300, '持棍警察': 200, '持枪警察': 100,
        '开车警察': 400, '李雅礼': 0, '云长郡': 200,
        '纸糊稻草人': 0, '铁皮稻草人': 999, '标准稻草人': 200,
        '灵敏稻草人': 50, '再生稻草人': 100, '训练木偶': 0
    };
    return defMap[roleName] || '?';
}

function getRoleSpeedRange(roleName) {
    const spdMap = {
        '模板一': '2~6', '模板二': '4~7', '模板三': '1~4', '鲁盼旋': '4~6', '灼华': '3~6',
        '持盾警察': '1~3', '持棍警察': '2~5', '持枪警察': '3~7',
        '开车警察': '3~7', '李雅礼': '1~7', '云长郡': '2~6',
        '纸糊稻草人': '1', '铁皮稻草人': '1', '标准稻草人': '1~2',
        '灵敏稻草人': '8~10', '再生稻草人': '1~2', '训练木偶': '1'
    };
    return spdMap[roleName] || '?';
}

updateLuStars();   // v0.316：页面加载即显示版块标题星数（DOM 已就绪）
