// charSelect.js - 选角色界面 + 角色详情预览

function initCharSelection() {
    selectedSlots = [null, null, null];
    pendingSlotIndex = -1;
    pendingRole = null;
    document.getElementById('roleDetailPanel').style.display = 'none';
    renderCharSlots();
    renderRoster();
}

function clickSlot(index) {
    if (selectedSlots[index] !== null) {
        selectedSlots[index] = null;
        pendingSlotIndex = -1;
        pendingRole = null;
    } else if (pendingRole !== null) {
        selectedSlots[index] = pendingRole;
        pendingRole = null;
        pendingSlotIndex = -1;
    } else {
        pendingSlotIndex = index;
    }
    renderCharSlots();
    renderRoster();
}

function selectRosterChar(roleName) {
    if (pendingSlotIndex !== -1) {
        selectedSlots[pendingSlotIndex] = roleName;
        pendingSlotIndex = -1;
    } else {
        if (pendingRole === roleName) {
            pendingRole = null;
        } else {
            pendingRole = roleName;
        }
    }
    renderCharSlots();
    renderRoster();
}

function renderCharSlots() {
    const container = document.getElementById('charSlots');
    container.innerHTML = '';
    selectedSlots.forEach((role, idx) => {
        const div = document.createElement('div');
        div.className = 'char-slot';
        if (role === null) {
            const isPendingSlot = (idx === pendingSlotIndex);
            const hasPendingRole = (pendingRole !== null);
            div.style.borderColor = (isPendingSlot || hasPendingRole) ? '#f9ca24' : '#555';
            if (isPendingSlot || hasPendingRole) div.style.boxShadow = '0 0 10px #f9ca24';
            const desc = hasPendingRole ? `准备填充：${pendingRole}` : (isPendingSlot ? '点击选人' : '点击空格选人');
            div.innerHTML = `<div class="name">空位</div><div class="desc">${desc}</div>`;
        } else {
            div.style.borderColor = '#2ecc71';
            div.innerHTML = `<div class="name">${role}</div><div class="desc">站位${idx + 1}</div>`;
        }
        div.onclick = () => clickSlot(idx);
        container.appendChild(div);
    });
}

function renderRoster() {
    const container = document.getElementById('charRoster');
    container.innerHTML = '';
    AVAILABLE_CHARS.forEach(roleName => {
        const div = document.createElement('div');
        div.className = 'roster-card';
        const count = selectedSlots.filter(r => r === roleName).length;
        const isPending = (pendingRole === roleName);
        if (isPending) {
            div.style.borderColor = '#f9ca24';
            div.style.boxShadow = '0 0 10px #f9ca24';
        }
        div.innerHTML = `
            <div class="name">${isPending ? '⬆ ' : ''}${roleName}</div>
            <div class="desc">${isPending ? '请点击上方空格上阵' : (count > 0 ? `已上场×${count}` : '点击查看详情')}</div>
        `;
        div.onclick = () => { selectRosterChar(roleName); showRoleInfo(roleName); };
        container.appendChild(div);
    });
}

function startLevelSelect() {
    const count = selectedSlots.filter(r => r !== null).length;
    if (count === 0) { alert('至少选择一个角色出战！'); return; }
    if (currentSelectedLevel === -1) {
        initEnemySelection();
        showPage('pageSelectEnemy');
    } else {
        startBattle(currentSelectedLevel);
    }
}

// ==================== 关卡选择 → 介绍 ====================
// enemies：出场敌方（可点击查看详情，含被动/技能/属性）；intro 只写打法要点，机制细节见敌方详情
const LEVEL_INFO = [
    { title: '关卡0 · 测试场', desc: '纸糊稻草人 ×1　铁皮稻草人 ×1　标准稻草人 ×1', enemies: ['纸糊稻草人', '铁皮稻草人', '标准稻草人'], intro: '三种稻草人，均不回复算力，适合测试伤害与技能机制。' },
    { title: '第一关', desc: '持盾警察 ×1　持棍警察 ×1　持枪警察 ×1', enemies: ['持盾警察', '持棍警察', '持枪警察'], intro: '持棍警察【一秒18棍】为18段多段攻击，持枪警察【开火】远程高伤，建议优先集火持枪警察。' },
    { title: '第二关', desc: '持盾警察 ×1　持棍警察 ×1　持枪警察 ×1 ＋ 开车警察待命', enemies: ['持盾警察', '持棍警察', '持枪警察', '开车警察'], intro: '开车警察【加油】后防御-100、速度+2，是其最脆的窗口期，建议趁此时集火；【刹车】后防御+200更难打，且速度差拉大令【开创】伤害更高。' },
    { title: '第三关', desc: '李雅礼 ×1　持枪警察 ×2 ＋ 开车警察待命', enemies: ['李雅礼', '持枪警察', '开车警察'], intro: '李雅礼死后会倒戈为我方（详见其被动），持枪警察远程高伤，前排阵亡后开车警察入场补位。' },
    { title: '☠️ 第四关 · Boss', desc: '云长郡 ×1（亡灵怨恨）', enemies: ['云长郡'], intro: '受击减伤100%且随阵亡递减，减伤跌破0%后转加伤；注意【催眠气体释放】会使目标「暂时昏迷」。机制细节见其被动。' },
    { title: '🎯 自选敌人测试', desc: '自由搭配敌人阵容', enemies: [], intro: '自由搭配稻草人与开车警察，测试技能与机制，没有固定关卡配置。' }
];

function selectLevel(level) {
    currentSelectedLevel = level;
    const info = LEVEL_INFO[level === -1 ? 5 : level];
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
    initCharSelection();
    showPage('pageSelectChar');
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

function getRoleDefRange(roleName) {
    const defMap = {
        '模板一': 200, '模板二': 100, '模板三': 300, '鲁盼旋': 200,
        '持盾警察': 300, '持棍警察': 200, '持枪警察': 100,
        '开车警察': 400, '李雅礼': 0, '云长郡': 200,
        '纸糊稻草人': 0, '铁皮稻草人': 999, '标准稻草人': 200,
        '灵敏稻草人': 50, '再生稻草人': 100
    };
    return defMap[roleName] || '?';
}

function getRoleSpeedRange(roleName) {
    const spdMap = {
        '模板一': '2~6', '模板二': '4~7', '模板三': '1~4', '鲁盼旋': '4~6',
        '持盾警察': '1~3', '持棍警察': '2~5', '持枪警察': '3~7',
        '开车警察': '3~7', '李雅礼': '1~7', '云长郡': '2~6',
        '纸糊稻草人': '1', '铁皮稻草人': '1', '标准稻草人': '1~2',
        '灵敏稻草人': '8~10', '再生稻草人': '1~2'
    };
    return spdMap[roleName] || '?';
}
