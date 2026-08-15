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
    positionFromZero: true,   // v0.5：我方槽标注「待命 / 位置0、1、2」（待命区最左，出战位置从 0 起）
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
// enemies：出场敌方（可点击查看详情，含被动/技能/属性）；intro 只写打法要点与机制特殊点，不写具体数值（v0.666 起），数值细节见敌方详情/词条
const LEVEL_INFO = [
    { title: '第一关', desc: '持盾警察 ×1　持棍警察 ×1　持枪警察 ×1', enemies: ['持盾警察', '持棍警察', '持枪警察'], intro: '持棍警察擅长多段连击，持枪警察远程高伤——建议优先集火持枪警察。' },
    { title: '第二关', desc: '持盾警察 ×1　持棍警察 ×1　持枪警察 ×1 ＋ 开车警察待命', enemies: ['持盾警察', '持棍警察', '持枪警察', '开车警察'], intro: '开车警察【加油】会牺牲防御换取速度，是其最脆的窗口期，建议趁此时集火；【刹车】后防御大增更难打，且速度差拉大令【开创】伤害更高。' },
    { title: '第三关', desc: '李雅礼 ×1　持枪警察 ×2 ＋ 开车警察待命', enemies: ['李雅礼', '持枪警察', '开车警察'], intro: '李雅礼死后会倒戈为我方（详见其被动），持枪警察远程高伤，前排阵亡后开车警察入场补位。' },
    { title: '第四关 · Boss', desc: '云长郡 ×1（亡灵怨恨）', enemies: ['云长郡'], intro: '鲁盼旋将与你们并肩作战（锁定最前排，AI 操控），再选 2 名上场 + 1 名待命。云长郡的「怨恨」随同阵营阵亡升级：怨恨越高减伤越强，过高时转为受击加伤；等级提升还会获得伤害加成与防御削减——越战越强，也会越打越脆。注意【催眠气体释放】会使目标「暂时昏迷」。机制细节见其被动。' },
    // v0.5 灼华篇（level 4/5/6）
    { title: '🔥 第一关', desc: '烬火信徒 ×2　焦木傀儡 ×1', enemies: ['烬火信徒', '焦木傀儡'], intro: '烬火教团的纵火信徒。焦木傀儡「易燃」受燃烧持续伤害加倍，可用灼华烧它，但小心火势蔓延。' },
    { title: '🔥 第二关', desc: '引火学徒 ×2　焚香祭司 ×1 ＋ 烬火信徒待命', enemies: ['引火学徒', '焚香祭司', '烬火信徒'], intro: '焚香祭司【焚香】会给友军挂「燃烧」并回算力——教团在"喂火"，趁它未使出焚香前速战可得特殊胜利。' },
    { title: '🔥 第三关 · Boss', desc: '焚天祭司·烛央 ×1　焦木傀儡 ×2', enemies: ['焚天祭司·烛央', '焦木傀儡'], intro: '灼华将与你们并肩作战（锁定最前排，AI 操控），再选 2 名上场 + 1 名待命。烛央【薪火不息】把场上燃烧吸成【狂炎】而变强：狂炎越多伤害越高、防御越低——烧得越猛它越疯，是双刃剑。机制细节见其被动。' },
    // v0.6 张子曦篇（level 7/8）——关卡配置为占位骨架，敌人/特殊胜利待用户后补
    { title: '🌀 第一关', desc: '烬火信徒 ×2　引火学徒 ×1', enemies: ['烬火信徒', '引火学徒'], intro: '张子曦篇·占位配置（敌人待用户后补）。主题机制「混乱」：目标受击后按分配硬币数触发反噬，每次消耗层数造成真实伤害。' },
    { title: '🌀 第二关 · Boss', desc: '焚天祭司·烛央 ×1　焦木傀儡 ×2', enemies: ['焚天祭司·烛央', '焦木傀儡'], intro: '张子曦篇·占位 Boss 关（配置/特殊胜利待用户后补）。' },
    { title: '🎯 测试关 · 自选任意角色', desc: '自由搭配全部角色', enemies: [], intro: '自由搭配全部角色（含我方角色），测试技能与机制，没有固定关卡配置。' },
    { title: '🎓 新手教程', desc: '训练木偶 ×1', enemies: ['训练木偶'], intro: '本关将引导你：①选角与站位 ②技能与算力 ③目标选择 ④防御机制。只需选择 1 名角色出战，前半段有教学引导，后半段自由练习。' }
];

function selectLevel(level) {
    currentSelectedLevel = level;
    // v0.310+v0.5+v0.6：-2 教程关取索引 10（-1 测试关取索引 9，0~8 正式关取自身；张子曦篇占用索引 7/8 后测试/教程后移）
    const info = LEVEL_INFO[level === -1 ? 9 : level === -2 ? 10 : level];
    document.getElementById('introTitle').textContent = info.title;
    // v0.5+v0.6：关卡介绍显示胜利条件——基础 + 正式关特殊胜利（SPECIAL_CONDITIONS 定义于 battleFlow.js，运行时已全部加载）
    const special = (level >= 0 && level <= 8 && typeof SPECIAL_CONDITIONS !== 'undefined' && SPECIAL_CONDITIONS[level])
        ? `<br>✨ 特殊胜利：${SPECIAL_CONDITIONS[level]}` : '';
    // 出场敌方卡（可点击查看详情，去重显示）
    const enemyCards = (info.enemies || []).filter((v, i, a) => a.indexOf(v) === i)
        .map(name => `<div class="level-intro-enemy" onclick="renderRoleDetail('${name}', 'introDetailPanel')">${name}</div>`).join('');
    document.getElementById('introContent').innerHTML = `
        <div class="level-intro-desc">敌方配置：${renderGlossaryText(info.desc)}</div>
        ${enemyCards ? `<div class="level-intro-enemies">出场敌方（点击查看详情）：</div><div class="level-intro-enemy-row">${enemyCards}</div>` : ''}
        <div class="level-intro-win">🏆 胜利条件：击败敌方全部角色${special}</div>
        <div class="level-intro-text">${renderGlossaryText(info.intro)}</div>`;
    showPage('pageLevelIntro');
}

function confirmLevel() {
    // v0.311+v0.5：第四关/灼华篇第三关 = 待命区（最左）+ 出战3（位置2 锁定 AI 角色 = 战斗最前方）
    // 布局从左到右：待命区、位置0、位置1、位置2（待命槽 index 0，出战槽 index 1/2/3，锁定出战位置2 = 最前方）
    // v0.5：强制上场角色统一用内置我方 AI；教程关 1 槽；其余 3 槽
    if (currentSelectedLevel === 3) {
        charSelection.setSlotGroups([{ label: '待命', count: 1, bench: true }, { label: '出战', count: 3 }]);
        charSelection.setLockedSlot(3, '鲁盼旋');
    } else if (currentSelectedLevel === 6) {
        charSelection.setSlotGroups([{ label: '待命', count: 1, bench: true }, { label: '出战', count: 3 }]);
        charSelection.setLockedSlot(3, '灼华');   // 默认第三参 'AI 操控'（与鲁盼旋第四关一致）
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
        <span class="role-detail-stats">${renderGlossaryText(`血量 ${tmpChar.maxHp} ｜ 算力 ${tmpChar.maxSP} ｜ 算力回复 ${tmpChar.spRegen}/回合 ｜ 防御 ${defVal} ｜ 速度 ${spdRange}`)}</span>
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
    if (n === 0 || n === 4 || n === 7) return true;   // v0.5+v0.6：鲁盼旋篇/灼华篇/张子曦篇第一关恒解锁
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

// ==================== 灼华篇（v0.5）：可收纳版块 + 逐关解锁（复用 pwgame_cleared；灼华 ⭐≥4 版块🔓解锁，仿鲁盼旋） ====================
function toggleZhSection() {
    const body = document.getElementById('zhSectionBody');
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    if (!open) { updateZhLevelLocks(); updateZhUnlock(); }   // 展开时刷新关卡/灼华解锁状态
    updateZhStars();                   // 星数随展开/收起刷新
}

// v0.5：⭐ 灼华篇星数显示（3 关 ×2 = 6 星，只计 4/5/6 关）
function updateZhStars() {
    const title = document.getElementById('zhSectionTitle');
    const body = document.getElementById('zhSectionBody');
    if (title) {
        const open = body && body.style.display !== 'none';
        title.textContent = '🔥 灼华篇 ⭐ ' + getStarCountZh() + '/6 ' + (open ? '▾' : '▸');
    }
}

// v0.5 改：灼华解锁区三态（仿鲁盼旋 updateLuStars，阈值 4/6）——✅已解锁 / 🔓达标可点 / 🔒未达标
function updateZhUnlock() {
    const area = document.getElementById('zhUnlockArea');
    if (!area) return;
    const n = getStarCountZh();
    if (getZhUnlocked()) {
        area.innerHTML = '<div style="margin:10px 2px;padding:10px 12px;background:#16213e;border:2px solid #2ecc71;border-radius:8px;color:#2ecc71;font-weight:bold;text-align:center;">✅ 灼华已解锁</div>';
    } else if (n >= 4) {
        area.innerHTML = '<button class="btn-main" style="width:100%;background:#f9ca24;color:#222;margin:10px 0;" onclick="unlockZh()">🔓 点击解锁灼华（⭐' + n + '/6）</button>';
    } else {
        area.innerHTML = '<div style="margin:10px 2px;padding:10px 12px;background:#16213e;border:1px dashed #555;border-radius:8px;color:#888;text-align:center;">🔒 集齐 4 星解锁灼华（当前 ⭐' + n + '/6）</div>';
    }
}

function unlockZh() {
    if (getStarCountZh() < 4) { showModal({ title: '提示', message: '还需集齐 4 颗星（当前 ' + getStarCountZh() + '/6）！' }); return; }
    showModal({
        title: '解锁灼华',
        message: '集齐 ' + getStarCountZh() + '/6 星，确定解锁灼华吗？',
        type: 'confirm',
        onConfirm: () => {
            setZhUnlocked();
            updateZhUnlock();
            updateZhStars();
            showModal({ title: '🎉 解锁成功', message: '灼华已解锁！现在可在选角界面使用她了。' });
        }
    });
}

// v0.5：灼华篇逐关解锁（level 4/5/6 → zhCard0~2）
function updateZhLevelLocks() {
    const cleared = getCleared();
    for (let n = 0; n < 3; n++) {
        const lv = n + 4;   // 4/5/6
        const card = document.getElementById('zhCard' + n);
        if (!card) continue;
        const h3 = card.querySelector('h3');
        if (!h3.dataset.orig) h3.dataset.orig = h3.textContent;
        const unlocked = isLevelUnlocked(lv);
        const done = cleared.includes(lv);
        card.classList.toggle('level-locked', !unlocked);
        card.onclick = unlocked ? () => selectLevel(lv) : () => showModal({ title: '提示', message: '🔒 通关上一关后解锁本关！' });
        h3.textContent = (unlocked ? (done ? '✅ ' : '') : '🔒 ') + h3.dataset.orig;
    }
}

// ==================== 张子曦篇（v0.6）：可收纳版块 + 逐关解锁 + ⭐ 版块🔓解锁张子曦 ====================
// TODO(用户后补)：ZHANG_UNLOCK_STARS 阈值待定（当前占位 2 星，张子曦篇共 4 星）
const ZHANG_UNLOCK_STARS = 2;
function toggleZhangSection() {
    const body = document.getElementById('zhangSectionBody');
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    if (!open) { updateZhangLevelLocks(); updateZhangUnlock(); }   // 展开时刷新关卡/张子曦解锁状态
    updateZhangStars();
}
function updateZhangStars() {
    const title = document.getElementById('zhangSectionTitle');
    const body = document.getElementById('zhangSectionBody');
    if (title) {
        const open = body && body.style.display !== 'none';
        title.textContent = '🌀 张子曦篇 ⭐ ' + getStarCountZhangZiXi() + '/4 ' + (open ? '▾' : '▸');
    }
}
function updateZhangUnlock() {
    const area = document.getElementById('zhangUnlockArea');
    if (!area) return;
    const n = getStarCountZhangZiXi();
    if (getZhangUnlocked()) {
        area.innerHTML = '<div style="margin:10px 2px;padding:10px 12px;background:#16213e;border:2px solid #2ecc71;border-radius:8px;color:#2ecc71;font-weight:bold;text-align:center;">✅ 张子曦已解锁</div>';
    } else if (n >= ZHANG_UNLOCK_STARS) {
        area.innerHTML = '<button class="btn-main" style="width:100%;background:#f9ca24;color:#222;margin:10px 0;" onclick="unlockZhang()">🔓 点击解锁张子曦（⭐' + n + '/4）</button>';
    } else {
        area.innerHTML = '<div style="margin:10px 2px;padding:10px 12px;background:#16213e;border:1px dashed #555;border-radius:8px;color:#888;text-align:center;">🔒 集齐 ' + ZHANG_UNLOCK_STARS + ' 星解锁张子曦（当前 ⭐' + n + '/4）</div>';
    }
}
function unlockZhang() {
    if (getStarCountZhangZiXi() < ZHANG_UNLOCK_STARS) { showModal({ title: '提示', message: '还需集齐 ' + ZHANG_UNLOCK_STARS + ' 颗星（当前 ' + getStarCountZhangZiXi() + '/4）！' }); return; }
    showModal({
        title: '解锁张子曦',
        message: '集齐 ' + getStarCountZhangZiXi() + '/4 星，确定解锁张子曦吗？',
        type: 'confirm',
        onConfirm: () => {
            setZhangUnlocked();
            updateZhangUnlock();
            updateZhangStars();
            showModal({ title: '🎉 解锁成功', message: '张子曦已解锁！现在可在选角界面使用他了。' });
        }
    });
}
// v0.665：设置弹窗「一键解锁」——解锁全部角色（鲁盼旋/灼华/张子曦）与所有关卡（0~8）。
// 写三个解锁标记 + 全关卡通关记录；纯进度修改不可逆（与既有解锁行为一致），确认后即时刷新当前页 UI
// （关卡页版块三态/关卡锁定、选角页角色池）；通关记录写入后星级追溯机制会自动补全 0~8 基础星（成就星不受影响）
function unlockAllContent() {
    showModal({
        title: '一键解锁',
        message: '确定解锁全部内容吗？将解锁全部角色（鲁盼旋 / 灼华 / 张子曦）与所有关卡。',
        type: 'confirm',
        confirmText: '解锁',
        onConfirm: () => {
            setLuUnlocked();
            setZhUnlocked();
            setZhangUnlocked();
            try { localStorage.setItem('pwgame_cleared', JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7, 8])); } catch (e) {}
            // 即时刷新解锁/星数/关卡锁定 UI
            if (typeof updateLuStars === 'function') updateLuStars();
            if (typeof updateZhStars === 'function') updateZhStars();
            if (typeof updateZhUnlock === 'function') updateZhUnlock();
            if (typeof updateZhangStars === 'function') updateZhangStars();
            if (typeof updateZhangUnlock === 'function') updateZhangUnlock();
            if (typeof updateLevelLocks === 'function') updateLevelLocks();
            if (typeof updateZhLevelLocks === 'function') updateZhLevelLocks();
            if (typeof updateZhangLevelLocks === 'function') updateZhangLevelLocks();
            const selectPage = document.getElementById('pageSelectChar');
            if (selectPage && selectPage.classList.contains('active') && typeof initCharSelection === 'function') initCharSelection();
            showModal({ title: '🎉 解锁成功', message: '全部角色与关卡已解锁！' });
        }
    });
}
// v0.6：张子曦篇逐关解锁（level 7/8 → zhangCard0~1）
function updateZhangLevelLocks() {
    const cleared = getCleared();
    for (let n = 0; n < 2; n++) {
        const lv = n + 7;   // 7/8
        const card = document.getElementById('zhangCard' + n);
        if (!card) continue;
        const h3 = card.querySelector('h3');
        if (!h3.dataset.orig) h3.dataset.orig = h3.textContent;
        const unlocked = isLevelUnlocked(lv);
        const done = cleared.includes(lv);
        card.classList.toggle('level-locked', !unlocked);
        card.onclick = unlocked ? () => selectLevel(lv) : () => showModal({ title: '提示', message: '🔒 通关上一关后解锁本关！' });
        h3.textContent = (unlocked ? (done ? '✅ ' : '') : '🔒 ') + h3.dataset.orig;
    }
}

function getRoleDefRange(roleName) {
    const defMap = {
        '模板一': 200, '模板二': 100, '模板三': 300, '鲁盼旋': 200, '灼华': 150, '张子曦': 150,
        '持盾警察': 300, '持棍警察': 200, '持枪警察': 100,
        '开车警察': 400, '李雅礼': 0, '云长郡': 200,
        '纸糊稻草人': 0, '铁皮稻草人': 999, '标准稻草人': 200,
        '灵敏稻草人': 50, '再生稻草人': 100, '训练木偶': 0,
        '烬火信徒': 100, '焦木傀儡': 250, '引火学徒': 80, '焚香祭司': 150, '焚天祭司·烛央': 180
    };
    return defMap[roleName] || '?';
}

function getRoleSpeedRange(roleName) {
    const spdMap = {
        '模板一': '2~6', '模板二': '4~7', '模板三': '1~4', '鲁盼旋': '4~6', '灼华': '3~6', '张子曦': '3~6',
        '持盾警察': '1~3', '持棍警察': '2~5', '持枪警察': '3~7',
        '开车警察': '3~7', '李雅礼': '1~7', '云长郡': '2~6',
        '纸糊稻草人': '1', '铁皮稻草人': '1', '标准稻草人': '1~2',
        '灵敏稻草人': '8~10', '再生稻草人': '1~2', '训练木偶': '1',
        '烬火信徒': '2~5', '焦木傀儡': '1~3', '引火学徒': '4~8', '焚香祭司': '2~4', '焚天祭司·烛央': '3~6'
    };
    return spdMap[roleName] || '?';
}

updateLuStars();      // v0.316：页面加载即显示版块标题星数（DOM 已就绪）
updateZhStars();      // v0.5：灼华篇标题星数
updateZhUnlock();     // v0.5 改：灼华篇解锁区（⭐≥4 显示🔓）
updateZhangStars();   // v0.6：张子曦篇标题星数
updateZhangUnlock();  // v0.6：张子曦篇解锁区
