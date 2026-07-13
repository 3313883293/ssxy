// battleUI.js - 战斗渲染、Buff弹窗、结算页

function renderCharacters() {
    allCharsDiv.innerHTML = '';
    const alive = battleState.allCharacters.filter(c => c.alive).sort((a, b) => {
        if (a.team !== b.team) return a.team === 'player' ? -1 : 1;
        return a.order - b.order;
    });
    alive.forEach(char => {
        const card = document.createElement('div');
        card.className = 'character-card ' + (char.team === 'player' ? 'player-card' : 'enemy-card');
        if (char === battleState.currentActor) card.classList.add('current');
        card.dataset.characterId = char.id;
        card.dataset.team = char.team;

        const totalDef = char.getTotalDef();
        let buffTags = [];
        let buffDetailItems = [];
        const buffTypeConfig = {
            'def':  { icon: '🛡️', color: '#4fc3f7' },
            'e':    { icon: '😈',  color: '#ab47bc' },
            'rage': { icon: '💢',  color: '#ff7043' },
            'burn': { icon: '🔥',  color: '#ff5252' }
        };
        char.buffs.forEach(buff => {
            const cfg = buffTypeConfig[buff.type] || { icon: '❓', color: '#aaa' };
            let shortText = '', detailTitle = '', detailDesc = '';
            if (buff.type === 'def') {
                const sign = buff.value > 0 ? '+' : '';
                shortText = `${cfg.icon}${sign}${buff.value}`;
                detailTitle = `${cfg.icon} 【防御临时变动】${sign}${buff.value}`;
                detailDesc = '持续至下一次受击';
            } else if (buff.type === 'e') {
                shortText = `${cfg.icon}×${buff.stack}`;
                detailTitle = `${cfg.icon} 【恶】${buff.stack}层`;
                detailDesc = '每层使鲁盼旋对该目标无视50防御';
            } else if (buff.type === 'rage') {
                shortText = `${cfg.icon}×${buff.stack}`;
                detailTitle = `${cfg.icon} 【愤怒】${buff.stack}层（上限5）`;
                detailDesc = '每2层使技能伤害+50，每2层使防御-50';
            } else if (buff.type === 'burn') {
                shortText = `${cfg.icon}Lv${buff.level}×${buff.stack}`;
                detailTitle = `${cfg.icon} 【燃烧】Lv${buff.level} × ${buff.stack}层`;
                detailDesc = `回合末造成 ${buff.level}×50 = ${buff.level * 50} 真实伤害，层数-1`;
            }
            buffTags.push(`<span class="buff-tag" style="color:${cfg.color}">${shortText}</span>`);
            buffDetailItems.push({ icon: cfg.icon, color: cfg.color, title: detailTitle, desc: detailDesc });
        });

        card.innerHTML = `
            <span class="position-mark">位置${char.position}</span>
            <div class="name">${char.name}</div>
            <div class="bar-container"><div class="hp-bar" style="width:${(char.hp / char.maxHp) * 100}%"></div></div>
            <div style="font-size:0.7em;">HP ${char.hp}/${char.maxHp}</div>
            <div class="bar-container"><div class="sp-bar" style="width:${(char.sp / char.maxSP) * 100}%"></div></div>
            <div style="font-size:0.7em;">算力 ${char.sp}/${char.maxSP}</div>
            <div class="stats">防${totalDef}${totalDef !== char.def ? `(基础${char.def})` : ''} 速${char.speed}</div>
            ${buffDetailItems.length > 0 ? `<div class="buff-indicator" data-buff-char="${char.id}">${buffTags.join('')}</div>` : ''}
        `;

        const buffEl = card.querySelector('.buff-indicator');
        if (buffEl) {
            buffEl.addEventListener('click', function(e) {
                e.stopPropagation();
                showBuffPopup(char, buffDetailItems);
            });
        }

        card.addEventListener('click', function(e) {
            const charId = parseInt(this.dataset.characterId);
            const c = battleState.findCharacterById(charId);
            if (!c || !c.alive) return;
            if (battleState.selectedSkill && c.team === 'enemy' && this.classList.contains('selectable')) {
                if (battleState.currentSelectedTargets.has(c)) {
                    battleState.currentSelectedTargets.delete(c);
                    this.style.borderColor = '#e74c3c';
                } else {
                    battleState.currentSelectedTargets.add(c);
                    this.style.borderColor = '#f9ca24';
                }
                return;
            }
            showSkillInfo(c);
        });

        allCharsDiv.appendChild(card);
        char.cardElement = card;
    });
}

function showBuffPopup(char, buffDetailItems) {
    const overlay = document.getElementById('buffPopupOverlay');
    const title = document.getElementById('buffPopupTitle');
    const body = document.getElementById('buffPopupBody');
    title.textContent = `${char.name} — Buff 详情`;
    if (buffDetailItems.length === 0) {
        body.innerHTML = '<div class="buff-popup-empty">当前无 Buff 效果</div>';
    } else {
        body.innerHTML = buffDetailItems.map(item => `
            <div class="buff-popup-item" style="border-left-color:${item.color}">
                <div class="buff-popup-icon">${item.icon}</div>
                <div class="buff-popup-text">
                    <div class="title" style="color:${item.color}">${item.title}</div>
                    <div class="desc">${item.desc}</div>
                </div>
            </div>
        `).join('');
    }
    overlay.style.display = 'flex';
}

function closeBuffPopup() {
    document.getElementById('buffPopupOverlay').style.display = 'none';
}

function showSkillInfo(char) {
    const skills = char.skills;
    if (!skills || skills.length === 0) return;
    let info = `<strong>${char.name}</strong> 技能组：<br>`;
    skills.forEach(skill => {
        const formula = `${skill.baseDamage} + ${skill.bonusDamage} × 硬币(${skill.coinCount})`;
        info += `【${skill.name}】消耗${skill.spCost}算力，距离${skill.attackRange}，伤害${formula}`;
        if (skill.buff) info += `，效果：防御${skill.buff.value > 0 ? '+' : ''}${skill.buff.value}`;
        if (skill.special) {
            if (skill.special.type === 'burn') info += `，命中：施加${skill.special.stacks}层【燃烧】`;
            else if (skill.special.type === 'ignoreDef') info += `，特效：无视${skill.special.value}防御`;
            else if (skill.special.type === 'evilDrain') info += `，特效：目标每层【恶】+${skill.special.bonus}伤害，清零【恶】`;
        }
        info += '<br>';
    });
    if (char.name === '鲁盼旋') {
        info += '<br><strong>被动技能：</strong><br>' +
            ' 先天能力者：未使用技能时，回合末回复200算力<br>' +
            ' 惩恶：友方受伤时，伤害来源获得1层【恶】<br>' +
            ' 愤怒之火燃起：回合末获得场上【恶】总层数的【愤怒】<br>' +
            '                          友方死亡时获得3层【愤怒】（上限5层）<br>' +
            '                          技能命中后施加分配硬币数级【燃烧】<br>';
    }
    skillDetailDiv.innerHTML = info;
    skillDetailDiv.classList.add('active');
}

function updateTurnDisplay() {
    turnDisplay.textContent = `第 ${battleState.turnCount} 回合`;
}

function showResultPage(result) {
    let html = `<div class="game-over" style="font-size:1.5em;margin-bottom:15px;">战斗${result}！</div>`;
    html += `<table style="width:100%;border-collapse:collapse;background:#16213e;border-radius:8px;overflow:hidden;">
        <tr style="background:#0f3460;color:#f9ca24;">
            <th style="padding:8px;text-align:left;">角色</th>
            <th style="padding:8px;">阵营</th>
            <th style="padding:8px;">造成伤害</th>
            <th style="padding:8px;">受到伤害</th>
            <th style="padding:8px;">状态</th>
        </tr>`;
    const sorted = [...battleState.allCharacters].sort((a, b) => {
        if (a.team !== b.team) return a.team === 'player' ? -1 : 1;
        return a.order - b.order;
    });
    sorted.forEach(c => {
        const teamColor = c.team === 'player' ? '#2ecc71' : '#e74c3c';
        html += `<tr style="border-top:1px solid #333;">
            <td style="padding:8px;text-align:left;font-weight:bold;">${c.name}</td>
            <td style="padding:8px;color:${teamColor};">${c.team === 'player' ? '我方' : '敌方'}</td>
            <td style="padding:8px;color:#ff6b6b;">${c.damageDealt}</td>
            <td style="padding:8px;color:#ffa502;">${c.damageReceived}</td>
            <td style="padding:8px;color:${c.alive ? '#2ecc71' : '#e74c3c'};">${c.alive ? '存活' : '阵亡'}</td>
        </tr>`;
    });
    html += `</table>`;

    html += `<div style="margin-top:12px;background:#16213e;border-radius:8px;overflow:hidden;">
        <div style="padding:8px 12px;background:#0f3460;color:#e056fd;font-weight:bold;">🔥 Dot伤害明细</div>
        <table style="width:100%;border-collapse:collapse;">`;
    const dotRows = [];
    sorted.forEach(c => {
        const dmg = (c.dotDamageMap && c.dotDamageMap['burn']) || 0;
        if (dmg > 0) dotRows.push({ name: c.name, teamColor: c.team === 'player' ? '#2ecc71' : '#e74c3c', dmg });
    });
    if (dotRows.length === 0) {
        html += '<tr><td style="padding:10px;text-align:center;color:#666;">本场战斗无Dot伤害</td></tr>';
    } else {
        html += '<tr style="background:#0f3460;color:#aaa;"><th style="padding:6px 10px;text-align:left;">角色</th><th style="padding:6px 10px;">伤害</th></tr>';
        dotRows.forEach(r => {
            html += `<tr style="border-top:1px solid #333;">
                <td style="padding:6px 10px;color:${r.teamColor};">${r.name}</td>
                <td style="padding:6px 10px;color:#ff6b6b;">${r.dmg}</td>
            </tr>`;
        });
    }
    html += `</table></div>`;

    html += `<div style="margin-top:12px;background:#0a0a1a;border-radius:8px;overflow:hidden;">
        <div id="logToggleBtn" style="padding:8px 12px;background:#0f3460;cursor:pointer;color:#f9ca24;font-weight:bold;user-select:none;"
             onclick="toggleBattleLog()">
            📋 查看战斗日志 (${battleLog.length}条) ▸
        </div>
        <div id="battleLogContent" style="display:none;max-height:300px;overflow-y:auto;padding:8px;font-size:0.78em;color:#ccc;line-height:1.6;">
            ${battleLog.map(msg => `<p style="margin:1px 0;">${msg}</p>`).join('')}
        </div>
    </div>`;

    document.getElementById('resultContent').innerHTML = html;
    showPage('pageResult');
}

function toggleBattleLog() {
    const content = document.getElementById('battleLogContent');
    const btn = document.getElementById('logToggleBtn');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        btn.textContent = '📋 收起战斗日志 ▾';
    } else {
        content.style.display = 'none';
        btn.textContent = `📋 查看战斗日志 (${battleLog.length}条) ▸`;
    }
}
