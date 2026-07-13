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
    showPage('pageLevel');
}

// ==================== 选角详情预览 ====================
function showRoleInfo(roleName) {
    const panel = document.getElementById('roleDetailPanel');
    const header = document.getElementById('roleDetailHeader');
    const body = document.getElementById('roleDetailBody');
    const tmpChar = createRoleInstance(roleName, 'player', 0);
    if (!tmpChar) { panel.style.display = 'none'; return; }

    const defVal = getRoleDefRange(roleName);
    const spdRange = getRoleSpeedRange(roleName);
    header.innerHTML = `
        <span class="role-detail-icon">📋</span>
        <span class="role-detail-name">${roleName}</span>
        <span class="role-detail-stats">
            HP ${tmpChar.maxHp} ｜ SP ${tmpChar.maxSP}+${tmpChar.spRegen}/回
            ｜ 防${defVal} ｜ 速${spdRange}
        </span>
    `;

    let html = '<div class="rd-section"><div class="rd-section-title">⚡ 技能</div>';
    tmpChar.skills.forEach(skill => {
        const formula = `${skill.baseDamage} + ${skill.bonusDamage}×硬币(${skill.coinCount})`;
        let extra = '';
        if (skill.buff) extra += ` ｜ 防御${skill.buff.value > 0 ? '+' : ''}${skill.buff.value}`;
        if (skill.special) {
            if (skill.special.type === 'burn') extra += ` ｜ 命中：${skill.special.stacks}层【燃烧】`;
            else if (skill.special.type === 'ignoreDef') extra += ` ｜ 无视${skill.special.value}防御`;
            else if (skill.special.type === 'evilDrain') extra += ` ｜ 目标每层【恶】+${skill.special.bonus}伤害，清零【恶】`;
        }
        html += `<div class="rd-skill">
            <div class="rd-skill-name">【${skill.name}】</div>
            <div class="rd-skill-info">消耗${skill.spCost}算力 ｜ 距离${skill.attackRange} ｜ ${formula}${extra}</div>
        </div>`;
    });
    html += '</div>';

    if (roleName === '鲁盼旋') {
        html += '<div class="rd-section"><div class="rd-section-title">🔰 被动</div>';
        html += '<div class="rd-passive">惩恶之火：友方受伤时，伤害来源获得1层【恶】</div>';
        html += '<div class="rd-passive">未行动回复：未使用技能的回合末回复200算力</div>';
        html += '<div class="rd-passive">恶→愤怒：回合末获得场上总恶层数的【愤怒】（上限5层）</div>';
        html += '<div class="rd-passive">友方死亡：获得3层【愤怒】（上限5层）</div>';
        html += '<div class="rd-passive">命中燃烧：技能命中施加分配硬币数级【燃烧】</div>';
        html += '<div class="rd-passive" style="color:#ff7043;">愤怒效果：每2层技能伤害+50，每2层防御-50</div>';
        html += '</div>';
    } else if (roleName === '模板一') {
        html += '<div class="rd-section"><div class="rd-section-title">🔰 被动</div>';
        html += '<div class="rd-passive" style="color:#888;">无特殊被动</div>';
        html += '</div>';
    }

    body.innerHTML = html;
    panel.style.display = 'block';
}

function getRoleDefRange(roleName) {
    const defMap = {
        '模板一': 200, '鲁盼旋': 200,
        '持盾警察': 300, '持棍警察': 200, '持枪警察': 100,
        '纸糊稻草人': 0, '铁皮稻草人': 999, '标准稻草人': 200,
        '灵敏稻草人': 50, '再生稻草人': 100
    };
    return defMap[roleName] || '?';
}

function getRoleSpeedRange(roleName) {
    const spdMap = {
        '模板一': '3~7', '鲁盼旋': '5~7',
        '持盾警察': '2~4', '持棍警察': '3~6', '持枪警察': '4~8',
        '纸糊稻草人': '1', '铁皮稻草人': '1', '标准稻草人': '1~2',
        '灵敏稻草人': '8~10', '再生稻草人': '1~2'
    };
    return spdMap[roleName] || '?';
}
