// battleActions.js - 玩家回合操作 + 敌方AI

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
        消耗算力：${skill.spCost}　攻击距离：${skill.attackRange}<br>
        伤害公式：${skill.baseDamage} + ${skill.bonusDamage} × 硬币(${skill.coinCount})<br>
        ${skill.buff ? `<span style="color:#f9ca24">效果：防御${skill.buff.value > 0 ? '+' : ''}${skill.buff.value}（持续至下一次受击）</span>` : ''}
        ${skill.special && skill.special.type === 'burn' ? `<span style="color:#f9ca24">命中：施加${skill.special.stacks}层【燃烧】</span>` : ''}
        ${skill.special && skill.special.type === 'ignoreDef' ? `<span style="color:#f9ca24">特效：无视${skill.special.value}防御</span>` : ''}
        ${skill.special && skill.special.type === 'evilDrain' ? `<span style="color:#f9ca24">特效：目标每层【恶】+${skill.special.bonus}伤害，清零【恶】</span>` : ''}
    `;
    const targetHint = document.getElementById('targetHint');
    const enemiesInRange = battleState.getAliveEnemies().filter(e =>
        Math.abs(actor.position - e.position) <= skill.attackRange
    );
    if (enemiesInRange.length === 0) {
        targetHint.textContent = '该技能范围内无可用目标！请重新选择技能。';
        battleState.selectedSkill = null;
        skillDetailDiv.classList.remove('active');
        return;
    }
    targetHint.textContent = '请点击攻击范围内的敌方角色（可多选），再按确认或取消。';
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
    renderCharacters();
    processNextAction();
}

// ==================== 敌方 AI ====================
function enemyTurn(actor) {
    actionContent.innerHTML = '<p style="color:#aaa;">敌方行动中...</p>';
    const availableSkills = actor.skills.filter(s => actor.sp >= s.spCost);
    if (availableSkills.length === 0) {
        log(`${actor.name} 算力不足，跳过`);
        setTimeout(() => { battleState.currentActor = null; renderCharacters(); processNextAction(); }, 900);
        return;
    }
    const sortedSkills = [...availableSkills].sort((a, b) => b.spCost - a.spCost);
    let chosenSkill = null, targets = [];
    for (let sk of sortedSkills) {
        const candidates = battleState.getAlivePlayers().filter(p =>
            Math.abs(actor.position - p.position) <= sk.attackRange
        );
        if (candidates.length > 0) { chosenSkill = sk; targets = candidates; break; }
    }
    if (!chosenSkill) {
        log(`${actor.name} 没有可攻击目标，跳过`);
        setTimeout(() => { battleState.currentActor = null; renderCharacters(); processNextAction(); }, 900);
        return;
    }
    log(`${actor.name} 使用 ${chosenSkill.name}，目标：${targets.map(t => t.name + '(' + t.position + ')').join(', ')}`);
    setTimeout(() => {
        SkillSystem.executeSkill(actor, chosenSkill, targets, battleState, allCharsDiv, log);
        battleState.currentActor = null;
        renderCharacters();
        processNextAction();
    }, 900);
}
