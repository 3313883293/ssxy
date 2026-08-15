// battleUI.js - 战斗渲染、Buff弹窗、结算页

// 意图徽章：敌方/AI 单位本回合行动预测，回合开始起展示于卡片上方（v0.287 引入，v0.288 改为回合开始预判）
function showIntent(char, skillName) {
    clearIntent(char);
    if (!char.cardElement) return;
    const badge = document.createElement('div');
    badge.className = 'intent-badge';
    badge.textContent = `🔮 预计使用【${skillName}】`;
    char.cardElement.appendChild(badge);
    char._intentBadge = badge;
}

function clearIntent(char) {
    if (char._intentBadge) {
        char._intentBadge.remove();
        char._intentBadge = null;
    }
}

// 就地更新角色卡片的 HP/SP 条与数字（v0.286：与受击动画同帧，不等重渲染）
function updateCharBars(char) {
    const card = char.cardElement;
    if (!card) return;
    const hpBar = card.querySelector('.hp-bar');
    if (hpBar) {
        hpBar.style.width = Math.max(0, char.hp / char.maxHp * 100) + '%';
        hpBar.classList.toggle('low-hp', char.hp / char.maxHp < 0.3);
    }
    const hpText = card.querySelector('.hp-text');
    if (hpText) hpText.textContent = `血量 ${char.hp}/${char.maxHp}`;
    const spBar = card.querySelector('.sp-bar');
    if (spBar) spBar.style.width = Math.max(0, char.sp / char.maxSP * 100) + '%';
    const spText = card.querySelector('.sp-text');
    if (spText) spText.textContent = `算力 ${char.sp}/${char.maxSP}`;
}

const buffTypeConfig = {
    'def':  { icon: '🛡️', color: '#4fc3f7' },
    'e':    { icon: '😈',  color: '#ab47bc' },
    'burn': { icon: '🔥',  color: '#ff5252' },
    'stun': { icon: '😵',  color: '#fbc02d' },
    'stunPending': { icon: '😵', color: '#fbc02d' },
    'frenzy': { icon: '🔥', color: '#ff6b81' },   // v0.5 狂炎（焚天祭司·烛央）
    'confusion': { icon: '🌀', color: '#9b59b6' },   // v0.6 混乱（张子曦）：受击反噬型 DoT
    'guard': { icon: '🛡️', color: '#f1c40f' },   // v0.669 守护（王庄明）：替队友挡伤害的层数
    'guardShield': { icon: '💠', color: '#2ecc71' }   // v0.669 守护之躯（王庄明）：按消耗算力折算的减伤
};

// 收集角色的 buff 短标签与详情（renderCharacters 与 refreshCardState 共用）
function collectBuffUI(char) {
    const tags = [], details = [];
    char.buffs.forEach(buff => {
        const cfg = buffTypeConfig[buff.type] || { icon: '❓', color: '#aaa' };
        let shortText = '', detailTitle = '', detailDesc = '';
        if (buff.type === 'def') {
            const sign = buff.value > 0 ? '+' : '';
            shortText = `${cfg.icon}${sign}${buff.value}`;
            detailTitle = `${cfg.icon} 【防御临时变动】${sign}${buff.value}`;
            detailDesc = '持续至下次受击时';
        } else if (buff.type === 'e') {
            shortText = `${cfg.icon}×${buff.stack}`;
            detailTitle = `${cfg.icon} 「恶」${buff.stack} 层`;
            detailDesc = '伤害计算时，每层使鲁盼旋对其无视 50 防御';
        } else if (buff.type === 'burn') {
            shortText = `${cfg.icon}Lv${buff.level}×${buff.stack}`;
            detailTitle = `${cfg.icon} 「燃烧」Lv ${buff.level} × ${buff.stack} 层`;
            detailDesc = `回合结束时造成 ${buff.level}×50 = ${buff.level * 50} 真实伤害；每 5 级消耗 1 层，不足按剩余层数×5 级结算`;
        } else if (buff.type === 'stun') {
            shortText = `${cfg.icon}昏迷`;
            detailTitle = `${cfg.icon} 「暂时昏迷」`;
            detailDesc = '轮到行动时无法行动，跳过本次行动后解除';
        } else if (buff.type === 'stunPending') {
            shortText = `${cfg.icon}催眠中`;
            detailTitle = `${cfg.icon} 「催眠气体」待生效`;
            detailDesc = '下一回合陷入「暂时昏迷」，无法行动一回合';
        } else if (buff.type === 'frenzy') {
            shortText = `${cfg.icon}×${buff.stack}`;
            detailTitle = `${cfg.icon} 「狂炎」${buff.stack} 层`;
            detailDesc = '伤害计算时每层使【烈焰鞭】/【焚天祭】伤害+150，防御计算时每层防御-20';
        } else if (buff.type === 'confusion') {
            shortText = `${cfg.icon}Lv${buff.level}×${buff.stack}`;
            detailTitle = `${cfg.icon} 「混乱」Lv ${buff.level} × ${buff.stack} 层`;
            detailDesc = '受到伤害后按本次攻击的分配硬币数触发反噬（次数=硬币数×0.5 向上取整），每次消耗 1 层并造成 级数×20 真实伤害';
        } else if (buff.type === 'guard') {
            shortText = `${cfg.icon}×${buff.stack}`;
            detailTitle = `${cfg.icon} 「守护」${buff.stack} 层`;
            detailDesc = '队友即将失去血量时防止之，改为自身受到对应数值的无来源伤害（再次结算防御与减伤），然后层数减一；一切伤害（普通/真伤/持续伤害）均转移，自己受击不转移';
        } else if (buff.type === 'guardShield') {
            shortText = `${cfg.icon}${buff.value}%`;
            detailTitle = `${cfg.icon} 「守护之躯」${buff.value}% 减伤`;
            detailDesc = '回合结束时按本回合消耗算力折算（每 100 算力 10%，向下取整、无上限），持续到下回合结束';
        }
        tags.push(`<span class="buff-tag" style="color:${cfg.color}">${shortText}</span>`);
        details.push({ icon: cfg.icon, color: cfg.color, title: detailTitle, desc: detailDesc });
    });
    return { tags, details };
}

// 就地刷新卡片全部状态（v0.288：buff 标签/防御速度/血条算力与攻击动画同帧，不再等 450ms 重渲染）
function refreshCardState(char) {
    const card = char.cardElement;
    if (!card) return;
    updateCharBars(char);
    const totalDef = char.getTotalDef();
    const statsEl = card.querySelector('.stats');
    if (statsEl) statsEl.innerHTML = `防御${totalDef}${totalDef !== char.def ? `（基础${char.def}）` : ''} 速度${char.speed}${char.hateReduction ? ` <span style="color:#c0392b;">☠️${char.getHateReduction() > 0 ? `减伤${char.getHateReduction()}%` : `受到伤害+${-char.getHateReduction()}%`}</span>` : ''}`;
    // v0.62 情感等级行（>0 显示「情感名 LvN」；鲁盼旋 emotionDisplayName='愤怒'，其余角色默认「情感激荡」；点击弹窗查看效果）：就地同步增删，与 stats 同帧刷新
    const emoName = char.emotionDisplayName || '情感激荡';
    const oldEmoEl = card.querySelector('.emotion-line');
    if (oldEmoEl) oldEmoEl.remove();
    // v0.651：0 级也显示（弱化类 .emotion-zero）——开战即见情感激荡系统、点击可看机制；>0 级保持粉紫醒目原样式
    const emoEl = document.createElement('div');
    emoEl.className = 'emotion-line' + (char.emotionLevel > 0 ? '' : ' emotion-zero');
    emoEl.textContent = `${emoName} Lv ${char.emotionLevel}`;
    emoEl.title = `点击查看${emoName}效果`;
    emoEl.addEventListener('click', function(e) { e.stopPropagation(); showEmotionInfo(char); });
    if (statsEl) statsEl.insertAdjacentElement('afterend', emoEl);
    else card.appendChild(emoEl);
    const { tags, details } = collectBuffUI(char);
    const oldBuffEl = card.querySelector('.buff-indicator');
    if (oldBuffEl) oldBuffEl.remove();
    if (tags.length > 0) {
        const buffEl = document.createElement('div');
        buffEl.className = 'buff-indicator';
        buffEl.dataset.buffChar = char.id;
        buffEl.innerHTML = tags.join('');
        buffEl.addEventListener('click', function(e) {
            e.stopPropagation();
            showBuffPopup(char, details);
        });
        card.appendChild(buffEl);
    }
}

function renderCharacters() {
    allCharsDiv.innerHTML = '';
    const alive = battleState.allCharacters.filter(c => c.alive && !c.pendingEntry).sort((a, b) => {   // 候补单位下一回合开始才显示（v0.287）
        if (a.team !== b.team) return a.team === 'player' ? -1 : 1;
        return a.order - b.order;
    });
    alive.forEach(char => {
        const card = document.createElement('div');
        card.className = 'character-card ' + (char.team === 'player' ? 'player-card' : 'enemy-card');
        if (char === battleState.currentActor) card.classList.add('current');
        // 入场动画（v0.287）：候补/召唤单位登场时从场外滑入（标记由回合开始逻辑置位）
        // 入场播完（0.5s）移除入场类，恢复静态卡片状态（v0.290：无待机动画，平时静止）
        if (char.entryAnim) {
            card.classList.add('bench-enter');
            if (char.team === 'player') card.classList.add('bench-left');
            char.entryAnim = false;
            setTimeout(() => card.classList.remove('bench-enter', 'bench-left'), 500);
        }
        card.dataset.characterId = char.id;
        card.dataset.team = char.team;
        card.dataset.name = char.name;   // v0.289：角色待机动画按名选择器（.character-card[data-name=…]）

        const totalDef = char.getTotalDef();
        const { tags: buffTags, details: buffDetailItems } = collectBuffUI(char);

        const lowHp = char.hp / char.maxHp < 0.3;
        card.innerHTML = `
            ${char.intentSkill ? `<div class="intent-badge">🔮 预计使用【${char.intentSkill}】</div>` : ''}
            <span class="position-mark">位置${char.position}</span>
            <div class="name">${char.name}</div>
            <div class="bar-container"><div class="hp-bar${lowHp ? ' low-hp' : ''}" style="width:${(char.hp / char.maxHp) * 100}%"></div></div>
            <div class="hp-text">血量 ${char.hp}/${char.maxHp}</div>
            <div class="bar-container"><div class="sp-bar" style="width:${(char.sp / char.maxSP) * 100}%"></div></div>
            <div class="sp-text">算力 ${char.sp}/${char.maxSP}</div>
            <div class="stats">防御${totalDef}${totalDef !== char.def ? `（基础${char.def}）` : ''} 速度${char.speed}${char.hateReduction ? ` <span style="color:#c0392b;">☠️${char.getHateReduction() > 0 ? `减伤${char.getHateReduction()}%` : `受到伤害+${-char.getHateReduction()}%`}</span>` : ''}</div>
            <div class="emotion-line${char.emotionLevel > 0 ? '' : ' emotion-zero'}" title="点击查看${char.emotionDisplayName || '情感激荡'}效果">${char.emotionDisplayName || '情感激荡'} Lv ${char.emotionLevel}</div>
            ${buffDetailItems.length > 0 ? `<div class="buff-indicator" data-buff-char="${char.id}">${buffTags.join('')}</div>` : ''}
        `;

        const intentBadgeEl = card.querySelector('.intent-badge');
        if (intentBadgeEl) char._intentBadge = intentBadgeEl;

        const buffEl = card.querySelector('.buff-indicator');
        if (buffEl) {
            buffEl.addEventListener('click', function(e) {
                e.stopPropagation();
                showBuffPopup(char, buffDetailItems);
            });
        }

        const emoEl = card.querySelector('.emotion-line');
        if (emoEl) {
            emoEl.addEventListener('click', function(e) {
                e.stopPropagation();
                showEmotionInfo(char);
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
                    const hint = document.getElementById('targetHint');
                    if (hint) hint.innerHTML = renderGlossaryText(`请点击攻击距离范围内的敌方角色（最多${battleState.selectedSkill.coinCount}个，与硬币数一致），再按确认或取消。`);
                } else if (battleState.currentSelectedTargets.size >= battleState.selectedSkill.coinCount) {
                    // 选定目标数不能超过硬币数
                    const hint = document.getElementById('targetHint');
                    if (hint) hint.innerHTML = renderGlossaryText(`已达目标上限（${battleState.selectedSkill.coinCount}枚硬币）！点击已选目标可取消`);
                } else {
                    battleState.currentSelectedTargets.add(c);
                    this.style.borderColor = '#f9ca24';
                    // v0.310：教程关首次选目标 → 推进教学步骤⑤→⑥
                    if (typeof Tutorial !== 'undefined' && Tutorial.active && Tutorial.step === 'pick-target') Tutorial.advance('pick-target');
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
                    <div class="desc">${renderGlossaryText(item.desc)}</div>
                </div>
            </div>
        `).join('');
    }
    overlay.style.display = 'flex';
}

function closeBuffPopup() {
    document.getElementById('buffPopupOverlay').style.display = 'none';
}

// v0.62 情感激荡说明弹窗：点卡片上的「情感激荡 LvN」只显示当前等级的实际效果（复用 buff 弹窗样式）
function showEmotionInfo(char) {
    const overlay = document.getElementById('buffPopupOverlay');
    const title = document.getElementById('buffPopupTitle');
    const body = document.getElementById('buffPopupBody');
    const lv = char.emotionLevel;
    const emoName = char.emotionDisplayName || '情感激荡';   // v0.62 鲁盼旋「愤怒」/v0.66 云长郡「怨恨」，仍归属情感激荡机制
    // v0.66：特殊情感（愤怒/怨恨）与普通情感统一一行文本（getEmotionEffectLine）；怨恨显示减伤/加伤曲线
    const effect = char.getEmotionEffectLine();
    title.textContent = `${char.name} — ${emoName}`;
    body.innerHTML = `
        <div class="buff-popup-item" style="border-left-color:#e056fd">
            <div class="buff-popup-text">
                <div class="title" style="color:#e056fd">${emoName} Lv ${lv}</div>
                <div class="desc">${effect}</div>
            </div>
        </div>
    `;
    overlay.style.display = 'flex';
}

function showSkillInfo(char) {
    const skills = char.skills;
    if (!skills || skills.length === 0) return;
    const parts = [];
    // v0.5：基础数值（面板值，与关卡介绍 renderRoleDetail 头部同源格式；战斗中点角色卡即可查看）
    // v0.66：特殊情感（愤怒/怨恨）与普通情感统一一行文本（getEmotionEffectLine）；怨恨显示减伤/加伤曲线
    const emoEffect = char.getEmotionEffectLine();
    parts.push(`📊 基础面板：血量 ${char.maxHp} ｜ 算力 ${char.maxSP} ｜ 算力回复 ${char.spRegen}/回合 ｜ 防御 ${char.def} ｜ 速度 ${char.speedMin}~${char.speedMax} ｜ ${char.emotionDisplayName || '情感激荡'} Lv ${char.emotionLevel}（${emoEffect}）`);
    // 被动/机制（标在技能前）
    const passives = PASSIVE_INFO[char.name] || [];
    if (passives.length > 0) {
        parts.push('🔰 被动 / 机制：');
        passives.forEach(p => parts.push('　· ' + p));
    }
    skills.forEach(skill => {
        parts.push(`【${skill.name}】消耗${skill.spCost}算力，距离${skill.attackRange}，伤害${skill.baseDamage} + ${skill.bonusDamage} × 硬币(${skill.coinCount})`);
        skillEffectLines(skill).forEach(l => parts.push('　' + l));
    });
    skillDetailDiv.innerHTML = `<strong>${char.name}</strong> 角色信息：<br>` + parts.map(p => renderGlossaryText(p)).join('<br>');
    skillDetailDiv.classList.add('active');
}

function updateTurnDisplay() {
    turnDisplay.textContent = `第 ${battleState.turnCount} 回合`;
    turnDisplay.classList.remove('turn-pulse');
    void turnDisplay.offsetWidth;   // 重启动画
    turnDisplay.classList.add('turn-pulse');
}

function showResultPage(result) {
    clearBattleSave();   // v0.313：战斗结束清除自动存档（返回主界面不再显示「继续战斗」）
    let html = `<div class="game-over" style="font-size:1.5em;margin-bottom:15px;">战斗${result}！</div>`;
    // 胜利时检测倒戈单位（李雅礼）是否存活
    if (result === '胜利') {
        // v0.310：通关正式关卡写入 localStorage（level>=0；测试关 -1 / 教程关 -2 不记录）
        if (battleState.currentLevel >= 0) {
            try {
                const arr = JSON.parse(localStorage.getItem('pwgame_cleared') || '[]');
                if (Array.isArray(arr) && !arr.includes(battleState.currentLevel)) {
                    arr.push(battleState.currentLevel);
                    localStorage.setItem('pwgame_cleared', JSON.stringify(arr));
                }
            } catch (e) {}
            addStar(battleState.currentLevel, 'base');   // v0.316：基础胜利 ⭐+1（去重）
        }
        // v0.314：特殊胜利达成 → 金色成就横幅（额外成就，不改变基础胜利/解锁）
        if (battleState.specialState.achieved) {
            html += `<div style="margin-bottom:12px;background:#f9ca24;color:#222;border-radius:8px;padding:12px 14px;font-weight:bold;text-align:center;font-size:1.15em;box-shadow:0 0 12px rgba(249,202,36,0.5);">
                ✨ 特殊胜利达成！本关特殊胜利条件已满足
            </div>`;
        }
        const yali = battleState.playerTeam.find(c => c.defector);
        if (yali) {
            html += `<div style="margin-bottom:12px;background:#16213e;border:2px solid ${yali.alive ? '#2ecc71' : '#e74c3c'};border-radius:8px;padding:10px 14px;color:${yali.alive ? '#2ecc71' : '#e74c3c'};font-weight:bold;">
                🫡 李雅礼${yali.alive ? '存活' : '已阵亡'}${yali.alive ? `（${yali.hp}/${yali.maxHp}）` : ''}
            </div>`;
        }
    }
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
    // v0.6：Dot 明细遍历全部 dotDamageMap key（🔥燃烧 / 🌀混乱），未来新增 DoT 自动分列
    const dotTypeCfg = { 'burn': { icon: '🔥', label: '燃烧' }, 'confusion': { icon: '🌀', label: '混乱' } };
    const dotRows = [];
    sorted.forEach(c => {
        if (!c.dotDamageMap) return;
        Object.keys(dotTypeCfg).forEach(key => {
            const dmg = c.dotDamageMap[key] || 0;
            if (dmg > 0) dotRows.push({ name: c.name, teamColor: c.team === 'player' ? '#2ecc71' : '#e74c3c', dmg, label: `${dotTypeCfg[key].icon} ${dotTypeCfg[key].label}` });
        });
    });
    if (dotRows.length === 0) {
        html += '<tr><td style="padding:10px;text-align:center;color:#666;">本场战斗无Dot伤害</td></tr>';
    } else {
        html += '<tr style="background:#0f3460;color:#aaa;"><th style="padding:6px 10px;text-align:left;">角色</th><th style="padding:6px 10px;">Dot</th><th style="padding:6px 10px;">伤害</th></tr>';
        dotRows.forEach(r => {
            html += `<tr style="border-top:1px solid #333;">
                <td style="padding:6px 10px;color:${r.teamColor};">${r.name}</td>
                <td style="padding:6px 10px;color:#e056fd;">${r.label}</td>
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

    // v0.312：胜利且非最后一关 → 提供「下一关」入口（v0.6：张子曦篇 7→8）
    if (result === '胜利' && battleState.currentLevel >= 0 && (battleState.currentLevel < 3 || (battleState.currentLevel >= 4 && battleState.currentLevel < 6) || (battleState.currentLevel >= 7 && battleState.currentLevel < 8))) {
        html += `<div class="control-buttons" style="margin-top:15px;">
            <button class="btn-main" onclick="nextLevel()" style="background:#f9ca24;color:#222;">➡️ 下一关</button>
        </div>`;
    }

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
