// battleActions.js - 玩家回合操作 + 敌方AI

// v0.288：预测 AI 单位本回合将使用的技能（AI 逻辑确定性：aiCycle 循环 / 算力降序），
// 回合开始时展示给玩家，供决策参考；预测失败（无可用技能/无目标）返回 null
function predictIntent(char) {
    const targetPool = char.team === 'player' ? battleState.getAliveEnemies() : battleState.getAlivePlayers();
    const inRangeOf = sk => targetPool.filter(p => Math.abs(char.position - p.position) <= sk.attackRange);
    if (char.aiCycle) {
        const cycleSkills = char.aiCycle.map(name => char.skills.find(s => s.name === name)).filter(Boolean);
        for (let step = 0; step < cycleSkills.length; step++) {
            const idx = (char.aiIndex + step) % cycleSkills.length;
            const sk = cycleSkills[idx];
            if (char.sp >= sk.spCost && inRangeOf(sk).length > 0) return sk.name;
        }
        return null;
    }
    const available = char.skills.filter(s => char.sp >= s.spCost);
    const sorted = [...available].sort((a, b) => b.spCost - a.spCost);
    for (const sk of sorted) {
        if (inRangeOf(sk).length > 0) return sk.name;
    }
    return null;
}

function playerTurn(actor) {
    const canAnySkillHit = actor.skills.some(skill =>
        battleState.getAliveEnemies().some(enemy => Math.abs(actor.position - enemy.position) <= skill.attackRange)
    );
    if (!canAnySkillHit) {
        log(`${actor.name}(位置${actor.position}) 所有技能均无法攻击到目标，自动跳过`);
        actor.actedThisTurn = false;
        battleState.currentActor = null;
        battleState.selectedSkill = null;
        renderCharacters();
        setTimeout(() => processNextAction(), 500);
        return;
    }
    battleState.waitingForPlayer = true;
    battleState.selectedSkill = null;
    skillDetailDiv.classList.remove('active');
    resetActionUI();
    drawPlayerActions(actor);
}

function resetActionUI() {
    const oldConfirm = document.getElementById('confirmTargetBtn');
    if (oldConfirm) oldConfirm.remove();
    const oldCancel = document.getElementById('cancelTargetBtn');
    if (oldCancel) oldCancel.remove();
}

function drawPlayerActions(actor) {
    let html = `<p><strong>${actor.name}(位置${actor.position})</strong> 的回合，选择技能：</p><div class="skill-buttons">`;
    actor.skills.forEach((skill, index) => {
        const disabled = actor.sp < skill.spCost ? 'disabled' : '';
        html += `<button class="skill-btn" data-skill-index="${index}" ${disabled}>${skill.name} (${skill.spCost}算力)</button>`;
    });
    html += `</div><div style="margin-top:10px;"><button class="skill-btn" id="skipTurnBtn" style="background:#555;">⏭ 跳过本回合</button></div>`;
    html += `<div class="target-hint" id="targetHint"></div>`;
    actionContent.innerHTML = html;

    document.querySelectorAll('.skill-btn[data-skill-index]').forEach(btn => {
        btn.addEventListener('click', (e) => selectPlayerSkill(actor, parseInt(e.target.dataset.skillIndex)));
    });
    document.getElementById('skipTurnBtn').addEventListener('click', () => {
        log(`${actor.name} 跳过本回合`);
        actor.actedThisTurn = false;
        battleState.currentActor = null;
        battleState.selectedSkill = null;
        skillDetailDiv.classList.remove('active');
        resetActionUI();
        renderCharacters();
        processNextAction();
    });
}

function selectPlayerSkill(actor, skillIndex) {
    const skill = actor.skills[skillIndex];
    if (actor.sp < skill.spCost) { log('算力不足！'); return; }
    battleState.selectedSkill = skill;
    resetActionUI();
    skillDetailDiv.classList.add('active');
    skillDetailDiv.innerHTML = `
        <strong>${skill.name}</strong><br>
        ${renderGlossaryText(`消耗算力：${skill.spCost}　攻击距离：${skill.attackRange}`)}<br>
        ${renderGlossaryText(`伤害公式：${skill.baseDamage} + ${skill.bonusDamage} × 硬币(${skill.coinCount})`)}<br>
        ${skillEffectLines(skill).map(l => `<span style="color:#f9ca24">${renderGlossaryText(l)}</span>`).join('<br>')}
    `;
    const targetHint = document.getElementById('targetHint');
    const enemiesInRange = battleState.getAliveEnemies().filter(e =>
        Math.abs(actor.position - e.position) <= skill.attackRange
    );
    if (enemiesInRange.length === 0) {
        targetHint.innerHTML = renderGlossaryText('该技能攻击距离范围内无可用目标！请重新选择技能。');
        battleState.selectedSkill = null;
        skillDetailDiv.classList.remove('active');
        return;
    }
    targetHint.innerHTML = renderGlossaryText(`请点击攻击距离范围内的敌方角色（最多${skill.coinCount}个，与硬币数一致），再按确认或取消。`);
    const allCards = allCharsDiv.querySelectorAll('.character-card');
    battleState.currentSelectedTargets = new Set();
    allCards.forEach(card => {
        const charId = parseInt(card.dataset.characterId);
        const char = battleState.findCharacterById(charId);
        if (!char || char.team !== 'enemy' || !char.alive) { card.classList.remove('selectable'); return; }
        if (enemiesInRange.includes(char)) {
            card.classList.add('selectable');
            card.style.borderColor = '#e74c3c';
        } else {
            card.classList.remove('selectable');
        }
    });
    const btnContainer = document.createElement('div');
    btnContainer.className = 'action-controls';
    const confirmBtn = document.createElement('button');
    confirmBtn.id = 'confirmTargetBtn';
    confirmBtn.textContent = '✅ 确认';
    confirmBtn.style.cssText = 'background:#2ecc71; color:white; padding:8px 16px; border:none; border-radius:20px; cursor:pointer;';
    confirmBtn.onclick = () => {
        if (battleState.currentSelectedTargets.size === 0) { alert('请至少选择一个目标'); return; }
        const selectedTargets = Array.from(battleState.currentSelectedTargets);
        cleanupTargetSelection(allCards);
        resetActionUI();
        skillDetailDiv.classList.remove('active');
        executePlayerAction(actor, selectedTargets);
    };
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'cancelTargetBtn';
    cancelBtn.textContent = '❌ 取消';
    cancelBtn.style.cssText = 'background:#e94560; color:white; padding:8px 16px; border:none; border-radius:20px; cursor:pointer;';
    cancelBtn.onclick = () => {
        cleanupTargetSelection(allCards);
        resetActionUI();
        skillDetailDiv.classList.remove('active');
        battleState.selectedSkill = null;
        targetHint.textContent = '';
        drawPlayerActions(actor);
    };
    btnContainer.appendChild(confirmBtn);
    btnContainer.appendChild(cancelBtn);
    actionContent.appendChild(btnContainer);
}

function cleanupTargetSelection(allCards) {
    allCards.forEach(card => { card.classList.remove('selectable'); card.style.borderColor = ''; });
    battleState.currentSelectedTargets.clear();
}

function executePlayerAction(actor, targets) {
    battleState.waitingForPlayer = false;
    SkillSystem.executeSkill(actor, battleState.selectedSkill, targets, battleState, allCharsDiv, log);
    battleState.currentActor = null;
    battleState.selectedSkill = null;
    // 延迟重渲染：让前冲/受击/死亡动画完整播放（v0.285；v0.291 时长由 executeSkill 按技能动画设定）
    const delay = window._actionAnimDelay || 800;
    setTimeout(() => { renderCharacters(); processNextAction(); }, delay);
}

// ==================== 敌方 AI ====================
function enemyTurn(actor) {
    clearIntent(actor);   // 轮到自己行动：收起回合开始的预测徽章（v0.288）
    actor.intentSkill = null;
    actionContent.innerHTML = `<p style="color:#aaa;">${actor.team === 'player' ? `${actor.name} 自动行动中...` : '敌方行动中...'}</p>`;
    let chosenSkill = null, targets = [];
    // 目标池按敌对阵营取：普通敌人打玩家；倒戈单位（如李雅礼）打敌方
    const targetPool = actor.team === 'player' ? battleState.getAliveEnemies() : battleState.getAlivePlayers();
    const inRangeOf = sk => targetPool.filter(p => Math.abs(actor.position - p.position) <= sk.attackRange);

    // 固定技能循环（开车警察：两次加油→一次开创→一次刹车）
    if (actor.aiCycle) {
        const cycleSkills = actor.aiCycle.map(name => actor.skills.find(s => s.name === name)).filter(Boolean);
        for (let step = 0; step < cycleSkills.length; step++) {
            const idx = (actor.aiIndex + step) % cycleSkills.length;
            const sk = cycleSkills[idx];
            if (actor.sp < sk.spCost) continue;
            const candidates = inRangeOf(sk);
            if (candidates.length > 0) {
                chosenSkill = sk;
                targets = candidates;
                actor.aiIndex = (idx + 1) % cycleSkills.length;
                break;
            }
        }
        if (!chosenSkill) {
            log(`${actor.name} 算力不足或没有可攻击目标，跳过`);
            setTimeout(() => { battleState.currentActor = null; renderCharacters(); processNextAction(); }, 900);
            return;
        }
    } else {
        const availableSkills = actor.skills.filter(s => actor.sp >= s.spCost);
        if (availableSkills.length === 0) {
            log(`${actor.name} 算力不足，跳过`);
            setTimeout(() => { battleState.currentActor = null; renderCharacters(); processNextAction(); }, 900);
            return;
        }
        const sortedSkills = [...availableSkills].sort((a, b) => b.spCost - a.spCost);
        for (let sk of sortedSkills) {
            const candidates = inRangeOf(sk);
            if (candidates.length > 0) { chosenSkill = sk; targets = candidates; break; }
        }
        if (!chosenSkill) {
            log(`${actor.name} 没有可攻击目标，跳过`);
            setTimeout(() => { battleState.currentActor = null; renderCharacters(); processNextAction(); }, 900);
            return;
        }
    }
    // 催眠气体释放：随机指定1个目标
    if (chosenSkill.special && chosenSkill.special.type === 'stun') {
        targets = [targets[Math.floor(Math.random() * targets.length)]];
    }
    log(`${actor.name} 使用 ${chosenSkill.name}，目标：${targets.map(t => t.name + '(' + t.position + ')').join(', ')}`);
    setTimeout(() => {
        SkillSystem.executeSkill(actor, chosenSkill, targets, battleState, allCharsDiv, log);
        battleState.currentActor = null;
        // 延迟重渲染：让动画完整播放（v0.285；v0.291 时长由 executeSkill 按技能动画设定）
        const delay = window._actionAnimDelay || 800;
        setTimeout(() => { renderCharacters(); processNextAction(); }, delay);
    }, 900);
}
