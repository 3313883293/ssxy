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
            else if (s.special && s.special.type === 'burnLv') extra = s.special.level * 50;   // v0.669 纵焚烈火：4级燃烧≈200/回合/目标
            // TODO(用户后补)：张子曦「混乱」类技能收益估算——(受击反噬真伤≈ 期望命中次数×级×20 折算)（等 special 类型确定）
            const perTarget = inRange.map(e => {
                if (e.getHateReduction() > 0 && hasOtherEnemies) return { target: e, exp: -1 };   // 减伤墙最后处理
                // v0.62 情感激荡：期望伤害加情感基础伤害加成（当前等级档位，覆盖式）
                let exp = s.baseDamage + (actor.getEmotionDamageBonus ? actor.getEmotionDamageBonus() : 0) + coinsEach * 0.5 * s.bonusDamage + extra - defOf(e);
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

// v0.683 敌方/AI 技能选择（predictIntent 与 enemyTurn 共用同一函数，预判与实际行为必然一致）：
// aiCycle 循环 → 按循环序选第一个「算力够且射程内有目标」的技能；无循环 → 算力降序选。
// advanceIndex=true 时推进 aiCycle 指针（实机行动用）；预测传 false 只读不推进。
// 返回 { skill, targets } 或 null（放不起或射程内无目标）
function pickEnemySkill(actor, advanceIndex) {
    const targetPool = actor.team === 'player' ? battleState.getAliveEnemies() : battleState.getAlivePlayers();
    const inRangeOf = sk => targetPool.filter(p => Math.abs(actor.position - p.position) <= sk.attackRange);
    if (actor.aiCycle) {
        const cycleSkills = actor.aiCycle.map(name => actor.skills.find(s => s.name === name)).filter(Boolean);
        for (let step = 0; step < cycleSkills.length; step++) {
            const idx = (actor.aiIndex + step) % cycleSkills.length;
            const sk = cycleSkills[idx];
            if (actor.sp < sk.spCost) continue;
            const candidates = inRangeOf(sk);
            if (candidates.length > 0) {
                if (advanceIndex) actor.aiIndex = (idx + 1) % cycleSkills.length;
                return { skill: sk, targets: candidates };
            }
        }
        return null;
    }
    const available = actor.skills.filter(s => actor.sp >= s.spCost);
    if (available.length === 0) return null;
    const sorted = [...available].sort((a, b) => b.spCost - a.spCost);
    for (const sk of sorted) {
        const candidates = inRangeOf(sk);
        if (candidates.length > 0) return { skill: sk, targets: candidates };
    }
    return null;
}

// v0.288：预测 AI 单位本回合将使用的技能（AI 逻辑确定性：aiCycle 循环 / 算力降序），
// 回合开始时展示给玩家，供决策参考；预测失败（无可用技能/无目标）返回 null
function predictIntent(char) {
    // v0.310：我方 AI 角色走智能决策预测（与 enemyTurn 实际行为同一函数，保证一致）
    if (char.team === 'player' && char.aiControlled) {
        const plan = decidePlayerAI(char);
        return plan ? plan.skill.name : null;
    }
    const plan = pickEnemySkill(char, false);   // v0.683 与 enemyTurn 共用同一决策函数（预测不推进 aiCycle 指针）
    return plan ? plan.skill.name : null;
}

function playerTurn(actor) {
    const canAnySkillHit = actor.skills.some(skill =>
        battleState.getAliveEnemies().some(enemy => Math.abs(actor.position - enemy.position) <= skill.attackRange)
    );
    if (!canAnySkillHit) {
        log(`${actor.name}（位置${actor.position}）所有技能均无法攻击到目标，自动跳过`);
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
    clearAttackRangeBox();   // v0.681：结束目标选择阶段（开始/取消/确认/跳过）时收起范围提示框
}

// ==================== 攻击范围提示框（v0.681） ====================
// 玩家选中技能后，在战场画出攻击距离覆盖区间的高亮框：半透明金色虚线框 + 框顶标注「攻击范围 N」。
// 覆盖区间 = 攻击者位置 ± 攻击距离 内的全部站位；区间两端取射程内卡片（含攻击者自身）的外缘，
// 中间即使有阵亡空缺（无卡片）也被整框包含——玩家一眼可见本次技能能打到哪些站位。
let _rangeZoneEl = null;

function showAttackRangeBox(actor, skill) {
    clearAttackRangeBox();
    const arena = document.querySelector('.arena');
    if (!arena) return;
    const arenaRect = arena.getBoundingClientRect();
    // 收集场上存活卡片相对 arena 的边界（renderCharacters 只渲染存活单位，死位不产生卡片）
    const cards = [];
    allCharsDiv.querySelectorAll('.character-card').forEach(card => {
        const c = battleState.findCharacterById(parseInt(card.dataset.characterId));
        if (!c || !c.alive) return;
        const r = card.getBoundingClientRect();
        cards.push({ c, left: r.left - arenaRect.left, right: r.right - arenaRect.left, top: r.top - arenaRect.top, bottom: r.bottom - arenaRect.top });
    });
    const actorRect = cards.find(x => x.c === actor);
    if (!actorRect) return;
    // 射程内卡片；极端情况（射程内无任何卡片）时退化为只框攻击者自身
    const inRange = cards.filter(x => Math.abs(x.c.position - actor.position) <= skill.attackRange);
    const base = inRange.length ? inRange : [actorRect];
    const left = Math.min(...base.map(x => x.left));
    const right = Math.max(...base.map(x => x.right));
    const top = Math.min(...base.map(x => x.top));
    const bottom = Math.max(...base.map(x => x.bottom));
    const zone = document.createElement('div');
    zone.className = 'range-zone';
    zone.style.left = left + 'px';
    zone.style.width = (right - left) + 'px';
    zone.style.top = (top - 6) + 'px';
    zone.style.height = (bottom - top + 12) + 'px';
    const label = document.createElement('div');
    label.className = 'range-zone-label';
    label.textContent = `⚔️ 攻击范围 ${skill.attackRange}`;
    zone.appendChild(label);
    arena.appendChild(zone);
    _rangeZoneEl = zone;
}

function clearAttackRangeBox() {
    if (_rangeZoneEl) { _rangeZoneEl.remove(); _rangeZoneEl = null; }
    const leftover = document.querySelector('.range-zone');
    if (leftover) leftover.remove();
}

function drawPlayerActions(actor) {
    let html = `<p><strong>${actor.name}（位置${actor.position}）</strong>的回合，选择技能：</p><div class="skill-buttons">`;
    actor.skills.forEach((skill, index) => {
        const disabled = actor.sp < skill.spCost ? 'disabled' : '';
        html += `<button class="skill-btn" data-skill-index="${index}" ${disabled}>${skill.name}（${skill.spCost}算力）</button>`;
    });
    html += `</div>`;
    // v0.310：跳过回合 = 教学步骤之一——强制教学阶段隐藏按钮，轮到⑩「跳过本回合」步才显示，自由练习起可正常跳过
    // v0.694：显隐改由步骤表声明的 gate 决定（本文件不再认步骤 id）
    const showSkip = (typeof Tutorial !== 'undefined') ? Tutorial.gate('skipTurn') : true;
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
        // v0.310：教学步骤⑩「跳过回合」——点跳过即完成该步；v0.694：改为事件通知
        tutNotify(TUT_EVENTS.TURN_SKIPPED);
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
    // v0.684 交叉火力（连携技）：目标 = 射程内全体敌方，自动选中直接施放（无需手动选目标）
    if (skill.special && skill.special.type === 'crossfire') {
        if (enemiesInRange.length === 0) {
            targetHint.innerHTML = renderGlossaryText('射程内无目标，无法使用【交叉火力】！');
            battleState.selectedSkill = null;
            skillDetailDiv.classList.remove('active');
            return;
        }
        log(`${actor.name} 发起【交叉火力】连携申请…`);
        resetActionUI();
        skillDetailDiv.classList.remove('active');
        executePlayerAction(actor, enemiesInRange);
        return;
    }
    if (enemiesInRange.length === 0) {
        targetHint.innerHTML = renderGlossaryText('该技能攻击距离范围内无可用目标！请重新选择技能。');
        battleState.selectedSkill = null;
        skillDetailDiv.classList.remove('active');
        return;
    }
    targetHint.innerHTML = renderGlossaryText(`请点击攻击距离范围内的敌方角色（最多${skill.coinCount}个，与硬币数一致），再按确认或取消。`);
    showAttackRangeBox(actor, skill);   // v0.681：在战场画出攻击距离覆盖区间的高亮框
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
    // v0.310：教程关选定技能 → 教学步骤④→⑤；v0.694：改为事件通知
    tutNotify(TUT_EVENTS.SKILL_PICKED);
}

function cleanupTargetSelection(allCards) {
    allCards.forEach(card => { card.classList.remove('selectable'); card.style.borderColor = ''; });
    battleState.currentSelectedTargets.clear();
}

function executePlayerAction(actor, targets) {
    battleState.waitingForPlayer = false;
    // v0.310：教程关确认行动 → 教学步骤⑥→⑦（⑦防御机制弹窗在敌方出手前展示）；v0.694：改为事件通知
    tutNotify(TUT_EVENTS.ACTION_CONFIRMED);
    SkillSystem.executeSkill(actor, battleState.selectedSkill, targets, battleState, allCharsDiv, log);
    battleState.currentActor = null;
    battleState.selectedSkill = null;
    // 延迟重渲染：让前冲/受击/死亡动画完整播放（v0.285；v0.291 时长由 executeSkill 按技能动画设定）
    const delay = window._actionAnimDelay || 800;
    scheduleProcessNext(delay);
}

// v0.684 目标优先级（多能战警三技能「优先指定」）：敌方 AI 选目标时按技能 special.pick 排序取前 coinCount 个；
// noSubdued=优先未被制服（全被制服时退化为最低血量）、lowestDef=防御最低、lowestHp=血量最低；未标记则原样返回
function applyTargetPriority(skill, candidates) {
    const pick = skill.special && skill.special.pick;
    if (!pick || !candidates || candidates.length === 0) return candidates;
    const arr = [...candidates];
    if (pick === 'noSubdued') {
        const clean = arr.filter(t => t.getBuffStack('subdued') === 0);
        const pool = clean.length ? clean : arr;
        pool.sort((a, b) => a.hp - b.hp);
        return pool.slice(0, Math.max(1, skill.coinCount));
    }
    if (pick === 'lowestDef') arr.sort((a, b) => a.getTotalDef() - b.getTotalDef());
    else if (pick === 'lowestHp') arr.sort((a, b) => a.hp - b.hp);
    return arr.slice(0, Math.max(1, skill.coinCount));
}

// ==================== 敌方 AI ====================
function enemyTurn(actor) {
    clearIntent(actor);   // 轮到自己行动：收起回合开始的预测徽章（v0.288）
    actor.intentSkill = null;
    actionContent.innerHTML = `<p style="color:#aaa;">${actor.team === 'player' ? `${actor.name} 自动行动中...` : '敌方行动中...'}</p>`;
    let chosenSkill = null, targets = [];

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
    } else {
        // v0.683 与 predictIntent 共用同一决策函数（实机推进 aiCycle 指针，预判只读不推进）
        const plan = pickEnemySkill(actor, true);
        if (!plan) {
            // 保留原日志区分：aiCycle 循环 → 算力不足或没有可攻击目标；无循环 → 按算力是否够区分
            const msg = actor.aiCycle
                ? '算力不足或没有可攻击目标，跳过'
                : (actor.skills.some(s => actor.sp >= s.spCost) ? '没有可攻击目标，跳过' : '算力不足，跳过');
            log(`${actor.name} ${msg}`);
            scheduleProcessNext(900);
            return;
        }
        chosenSkill = plan.skill;
        targets = applyTargetPriority(plan.skill, plan.targets);   // v0.684 优先指定（未被制服/防御最低/血量最低）
    }
    // 催眠气体释放：随机指定1个目标
    if (chosenSkill.special && chosenSkill.special.type === 'stun') {
        targets = [targets[Math.floor(Math.random() * targets.length)]];
    }
    log(`${actor.name} 使用 ${chosenSkill.name}，目标：${targets.map(t => t.name + '（' + t.position + '）').join(', ')}`);
    const epoch = battleEpoch;
    setTimeout(() => {
        if (epoch !== battleEpoch) return;   // v0.313：读档/重开后丢弃旧回合回调
        SkillSystem.executeSkill(actor, chosenSkill, targets, battleState, allCharsDiv, log);
        // v0.310：教程关敌方出手后 → 教学步骤⑦→⑧；v0.694：改为事件通知
        tutNotify(TUT_EVENTS.ENEMY_ACTED);
        battleState.currentActor = null;
        // 延迟重渲染：让动画完整播放（v0.285；v0.291 时长由 executeSkill 按技能动画设定）
        const delay = window._actionAnimDelay || 800;
        scheduleProcessNext(delay);
    }, 900);
}
