// battleActions.js - 玩家回合操作 + 敌方AI

// ==================== 我方 AI 智能决策（v0.310，移植 play.js planNextAction） ====================
// 供所有 aiControlled 的我方角色使用（倒戈李雅礼、第四关锁定鲁盼旋等）。
// 逻辑：期望伤害评估（硬币均分·50%命中·扣防御·燃烧折算）+ 减伤墙最后处理 + SP 攒大招前瞻 + 目标优先级。
// 全部确定性计算（无随机）→ 与 predictIntent 预判一致。
// 返回 { skill, targets } 或 null（跳过本回合攒算力）。
function decidePlayerAI(actor) {
    const enemies = battleState.getAliveEnemies();
    const defOf = e => e.getTotalDef();
    // 场上还有非减伤墙敌人时，先不打减伤墙（如云长郡）
    const hasOtherEnemies = enemies.some(e => !e.defector && !e.getHateReduction() && e.alive);
    // 评估：对每个技能、射程内每个目标算期望值，取总期望最高的技能
    const evalAt = (skills, sp) => {
        let best = null;
        for (const s of skills) {
            if (sp < s.spCost) continue;
            const inRange = enemies.filter(e => Math.abs(actor.position - e.position) <= s.attackRange);
            if (!inRange.length) continue;
            const coinsEach = Math.floor(s.coinCount / inRange.length);
            let extra = 0;
            if (s.special && s.special.type === 'burn') extra = s.coinCount * 50 * 1.5;   // 燃烧≈50/级/回合
            else if (s.special && s.special.type === 'burnUp') extra = s.special.levels * 50;   // 升火收益≈每级50/回合
            // TODO(用户后补)：张子曦「混乱」类技能收益估算——(受击反噬真伤≈ 期望命中次数×级×20 折算)（等 special 类型确定）
            const perTarget = inRange.map(e => {
                if (e.getHateReduction() > 0 && hasOtherEnemies) return { target: e, exp: -1 };   // 减伤墙最后处理
                let exp = s.baseDamage + coinsEach * 0.5 * s.bonusDamage + extra - defOf(e);
                if (s.special && s.special.type === 'detonate') exp += e.getBuffLevel('burn') * 50 * (s.special.ratio || 2);   // 引爆收益取决于目标当前火势
                if (e.getHateReduction() > 0) exp = exp * (100 - e.getHateReduction()) / 100;
                return { target: e, exp: Math.max(0, exp) };
            });
            const total = perTarget.reduce((a, b) => a + b.exp, 0);
            if (!best || total > best.total) best = { s, total, perTarget };
        }
        return best;
    };
    const cap = sp => Math.min(actor.maxSP, sp);
    const now = evalAt(actor.skills, actor.sp);
    if (!now || now.total <= 0) return null;   // 放不起或只能打减伤墙，跳过
    const highestCost = Math.max(...actor.skills.map(s => s.spCost));
    const pickTargets = (plan) => {
        const sorted = plan.perTarget.filter(t => t.exp > 0).sort((a, b) => b.exp - a.exp);
        const picks = sorted.slice(0, plan.s.coinCount).map(t => t.target);   // 期望最高的目标优先，不超过硬币数
        if (picks.length) return picks;
        return [plan.perTarget.reduce((a, b) => b.exp > a.exp ? b : a).target];   // 全期望≤0：硬打期望最大者
    };
    if (now.s.spCost >= highestCost) {
        // 已是顶级大招：直接打
        return { skill: now.s, targets: pickTargets(now) };
    }
    // 前瞻 1 回合：放完 vs 跳过后，下回合的最佳期望；跳过攒大明显更优则跳过
    const afterAct = evalAt(actor.skills, cap(actor.sp - now.s.spCost + actor.spRegen));
    const afterSkip = evalAt(actor.skills, cap(actor.sp + actor.spRegen));
    const actTotal = afterAct ? afterAct.total : 0;
    const skipTotal = afterSkip ? afterSkip.total : 0;
    if (skipTotal > actTotal * 1.3) return null;
    return { skill: now.s, targets: pickTargets(now) };
}

// v0.288：预测 AI 单位本回合将使用的技能（AI 逻辑确定性：aiCycle 循环 / 算力降序），
// 回合开始时展示给玩家，供决策参考；预测失败（无可用技能/无目标）返回 null
function predictIntent(char) {
    // v0.310：我方 AI 角色走智能决策预测（与 enemyTurn 实际行为同一函数，保证一致）
    if (char.team === 'player' && char.aiControlled) {
        const plan = decidePlayerAI(char);
        return plan ? plan.skill.name : null;
    }
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
        scheduleProcessNext(500);
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
    html += `</div>`;
    // v0.310：跳过回合 = 教学步骤⑧之一——强制教学阶段(④⑤⑥⑦)隐藏按钮，⑧起作为教学步骤显示，⑨自由练习起可正常跳过
    let showSkip = true;
    if (typeof Tutorial !== 'undefined' && Tutorial.isTutorial()) {
        showSkip = !Tutorial.active || Tutorial.step === 'skip-turn';
    }
    if (showSkip) {
        html += `<div style="margin-top:10px;"><button class="skill-btn" id="skipTurnBtn" style="background:#555;">⏭ 跳过本回合</button></div>`;
    }
    html += `<div class="target-hint" id="targetHint"></div>`;
    actionContent.innerHTML = html;

    document.querySelectorAll('.skill-btn[data-skill-index]').forEach(btn => {
        btn.addEventListener('click', (e) => selectPlayerSkill(actor, parseInt(e.target.dataset.skillIndex)));
    });
    const skipBtn = document.getElementById('skipTurnBtn');
    if (skipBtn) skipBtn.addEventListener('click', () => {
        // v0.310：教学步骤⑧「跳过回合」——点跳过即完成该步
        if (typeof Tutorial !== 'undefined' && Tutorial.active && Tutorial.step === 'skip-turn') Tutorial.advance('skip-turn');
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
        if (battleState.currentSelectedTargets.size === 0) { showModal({ title: '提示', message: '请至少选择一个目标' }); return; }
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
    // v0.310：教程关选定技能 → 推进教学步骤④→⑤
    if (typeof Tutorial !== 'undefined' && Tutorial.active && Tutorial.step === 'pick-skill') Tutorial.advance('pick-skill');
}

function cleanupTargetSelection(allCards) {
    allCards.forEach(card => { card.classList.remove('selectable'); card.style.borderColor = ''; });
    battleState.currentSelectedTargets.clear();
}

function executePlayerAction(actor, targets) {
    battleState.waitingForPlayer = false;
    // v0.310：教程关确认行动 → 推进教学步骤⑥→⑦（⑦防御机制弹窗在敌方出手前展示）
    if (typeof Tutorial !== 'undefined' && Tutorial.active && Tutorial.step === 'confirm-action') Tutorial.advance('confirm-action');
    SkillSystem.executeSkill(actor, battleState.selectedSkill, targets, battleState, allCharsDiv, log);
    battleState.currentActor = null;
    battleState.selectedSkill = null;
    // 延迟重渲染：让前冲/受击/死亡动画完整播放（v0.285；v0.291 时长由 executeSkill 按技能动画设定）
    const delay = window._actionAnimDelay || 800;
    scheduleProcessNext(delay);
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

    // v0.310：我方 AI 角色走智能决策（期望伤害 + 攒大招前瞻 + 目标优先级）
    if (actor.team === 'player' && actor.aiControlled) {
        const plan = decidePlayerAI(actor);
        if (!plan) {
            log(`${actor.name} 选择跳过本回合（攒算力）`);
            scheduleProcessNext(900);
            return;
        }
        chosenSkill = plan.skill;
        targets = plan.targets;
    } else if (actor.aiCycle) {
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
            scheduleProcessNext(900);
            return;
        }
    } else {
        const availableSkills = actor.skills.filter(s => actor.sp >= s.spCost);
        if (availableSkills.length === 0) {
            log(`${actor.name} 算力不足，跳过`);
            scheduleProcessNext(900);
            return;
        }
        const sortedSkills = [...availableSkills].sort((a, b) => b.spCost - a.spCost);
        for (let sk of sortedSkills) {
            const candidates = inRangeOf(sk);
            if (candidates.length > 0) { chosenSkill = sk; targets = candidates; break; }
        }
        if (!chosenSkill) {
            log(`${actor.name} 没有可攻击目标，跳过`);
            scheduleProcessNext(900);
            return;
        }
    }
    // 催眠气体释放：随机指定1个目标
    if (chosenSkill.special && chosenSkill.special.type === 'stun') {
        targets = [targets[Math.floor(Math.random() * targets.length)]];
    }
    log(`${actor.name} 使用 ${chosenSkill.name}，目标：${targets.map(t => t.name + '(' + t.position + ')').join(', ')}`);
    const epoch = battleEpoch;
    setTimeout(() => {
        if (epoch !== battleEpoch) return;   // v0.313：读档/重开后丢弃旧回合回调
        SkillSystem.executeSkill(actor, chosenSkill, targets, battleState, allCharsDiv, log);
        // v0.310：教程关敌方出手后 → 推进教学步骤⑦→⑧（自由练习）
        if (typeof Tutorial !== 'undefined' && Tutorial.active && Tutorial.step === 'defense') Tutorial.advance('defense');
        battleState.currentActor = null;
        // 延迟重渲染：让动画完整播放（v0.285；v0.291 时长由 executeSkill 按技能动画设定）
        const delay = window._actionAnimDelay || 800;
        scheduleProcessNext(delay);
    }, 900);
}
