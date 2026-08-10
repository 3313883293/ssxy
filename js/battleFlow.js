// battleFlow.js - 回合流程、开始战斗

// ==================== 战斗自动存档（v0.313） ====================
// 每回合开始（回合初始化完成后、行动开始前）自动存一次；战斗中可一键读档回到「本回合开始」；刷新后可续战
let battleEpoch = 0;   // 战斗纪元：开始战斗/读档时递增，旧的异步推进回调据此丢弃（防读档后旧 setTimeout 干扰）

function hasBattleSave() {
    try { return !!localStorage.getItem('pwgame_battle_save'); } catch (e) { return false; }
}

function clearBattleSave() {
    try { localStorage.removeItem('pwgame_battle_save'); } catch (e) {}
    const btn = document.getElementById('loadSaveBtn');
    if (btn) btn.style.display = 'none';
}

// 角色 → 可 JSON 快照（重建用 createRoleInstance/createPoliceWraith 生成实例后覆盖字段）
function serializeChar(c) {
    return {
        kind: c._wraithType ? 'wraith' : 'char',   // 怨灵经 createPoliceWraith 重建（HP 减半）
        role: c._wraithType || c.name,
        team: c.team,
        hp: c.hp, sp: c.sp, alive: c.alive,
        order: c.order, position: c.position,
        speed: c.speed, speedMin: c.speedMin, speedMax: c.speedMax,
        def: c.def,
        buffs: c.buffs,
        aiControlled: !!c.aiControlled,
        aiCycle: c.aiCycle, aiIndex: c.aiIndex || 0,
        defector: !!c.defector,
        hateReduction: !!c.hateReduction, hateReductionCurrent: c.hateReductionCurrent || 0,
        pendingEntry: !!c.pendingEntry, entryAnim: !!c.entryAnim,
        intentSkill: c.intentSkill || null,
        dotDamageMap: c.dotDamageMap || {},
        damageDealt: c.damageDealt || 0, damageReceived: c.damageReceived || 0,
        actedThisTurn: !!c.actedThisTurn
    };
}

function saveAutoBattle() {
    if (!battleState || battleState.turnCount < 1) return;
    try {
        const data = {
            v: 1,
            level: battleState.currentLevel,
            turnCount: battleState.turnCount,
            totalDeaths: battleState.totalDeaths,
            summonPool: battleState.summonPool,
            playerTeam: battleState.playerTeam.map(serializeChar),
            enemyTeam: battleState.enemyTeam.map(serializeChar),
            benchPlayer: battleState.benchPlayer.map(serializeChar),
            benchEnemy: battleState.benchEnemy.map(serializeChar),
            globalId: globalId,
            specialState: battleState.specialState   // v0.314：特殊胜利达成状态随存档保留
        };
        localStorage.setItem('pwgame_battle_save', JSON.stringify(data));
        const btn = document.getElementById('loadSaveBtn');
        if (btn) btn.style.display = 'block';
    } catch (e) { /* file:// 或隐私模式无 localStorage，跳过存档 */ }
}

// 读档：重建战斗状态并恢复「最近回合开始」的行动流程；成功返回 true
function loadAutoBattle() {
    let raw;
    try { raw = localStorage.getItem('pwgame_battle_save'); } catch (e) { return false; }
    if (!raw) return false;
    let data;
    try { data = JSON.parse(raw); } catch (e) { return false; }
    battleLog = [];
    battleState.reset();
    const rebuild = (snap, team) => {
        let inst;
        try {
            inst = snap.kind === 'wraith'
                ? createPoliceWraith(snap.role, snap.position)
                : createRoleInstance(snap.role, team, snap.position);
        } catch (e) { return null; }
        if (!inst) return null;
        Object.assign(inst, {
            hp: snap.hp, sp: snap.sp, alive: snap.alive,
            order: snap.order, position: snap.position,
            speed: snap.speed, speedMin: snap.speedMin, speedMax: snap.speedMax,
            def: snap.def, buffs: snap.buffs || [],
            aiControlled: !!snap.aiControlled, aiCycle: snap.aiCycle || null, aiIndex: snap.aiIndex || 0,
            defector: !!snap.defector,
            hateReduction: !!snap.hateReduction, hateReductionCurrent: snap.hateReductionCurrent || 0,
            pendingEntry: !!snap.pendingEntry, entryAnim: !!snap.entryAnim,
            intentSkill: snap.intentSkill || null,
            dotDamageMap: snap.dotDamageMap || {},
            damageDealt: snap.damageDealt || 0, damageReceived: snap.damageReceived || 0,
            actedThisTurn: !!snap.actedThisTurn
        });
        return inst;
    };
    // v0.313 fix：重建角色 id 从 0 连续分配（若沿用当前 globalId，重建后再覆盖回存档值，
    // 后续召唤/创建角色的 id 会撞上重建角色，findCharacterById 解析到错误角色 → 点击怨灵卡弹错详情且无法选中）
    globalId = 0;
    battleState.playerTeam = data.playerTeam.map(s => rebuild(s, 'player')).filter(Boolean);
    battleState.enemyTeam = data.enemyTeam.map(s => rebuild(s, 'enemy')).filter(Boolean);
    battleState.benchPlayer = data.benchPlayer.map(s => rebuild(s, 'player')).filter(Boolean);
    battleState.benchEnemy = data.benchEnemy.map(s => rebuild(s, 'enemy')).filter(Boolean);
    battleState.allCharacters = [...battleState.playerTeam, ...battleState.enemyTeam];
    // 重建完成：globalId = 全部已分配 id 数（出场+待命），保证后续召唤/创建 id 唯一（存档时的 globalId 不再适用）
    globalId = battleState.playerTeam.length + battleState.enemyTeam.length
        + battleState.benchPlayer.length + battleState.benchEnemy.length;
    battleState.currentLevel = data.level;
    battleState.turnCount = data.turnCount;
    battleState.totalDeaths = data.totalDeaths || 0;
    battleState.summonPool = data.summonPool || [];
    battleState.specialState = Object.assign({ achieved: false, driverUsedOpen: false, incenseUsed: false, burnKill: false, zhuYangFrenzyAtDeath: 0 }, data.specialState || {});   // v0.314+v0.5：达成状态读档保留
    battleEpoch++;
    buildActionQueue();   // 用存档速度重建行动队列（与 startNewRound 排序一致）
    renderCharacters();
    updateTurnDisplay();
    updateWinCondition();
    logPanel.innerHTML = `<p>↩️ 已读档（第 ${battleState.turnCount} 回合开始）</p>`;
    log(`已从自动存档恢复战斗（第 ${battleState.turnCount} 回合开始）`);
    if (battleState.benchPlayer.length) log(`🛡️ 我方待命区：${battleState.benchPlayer.map(c => c.name).join('、')}`);
    if (battleState.benchEnemy.length) log(`🚑 敌方待命区：${battleState.benchEnemy.map(c => c.name).join('、')}`);
    actionContent.innerHTML = '继续战斗';
    nextRoundBtn.onclick = startNewRound;   // v0.5 fix：读档/续战也绑定「开始回合」——页面刷新后 onclick 为 null，回合结束按钮会显示但点不动
    nextRoundBtn.style.display = 'none';    // 回合进行中隐藏（onTurnEnd 时重新显示）
    processNextAction();
    showPage('pageBattle');
    return true;
}

// 主界面「继续战斗」入口（刷新/重开后恢复未完成的战斗）
function continueBattle() {
    if (!loadAutoBattle()) { clearBattleSave(); refreshContinueBtn(); }
}

// 战斗中「读档」按钮（回到最近回合开始）
function loadSaveFromBattle() {
    if (!hasBattleSave()) return;
    // v0.319：游戏内确认弹窗（替代浏览器原生 confirm）
    showModal({
        title: '读档确认',
        message: '读档将回到最近回合开始的状态，确定继续吗？',
        type: 'confirm',
        onConfirm: () => loadAutoBattle()
    });
}

function refreshContinueBtn() {
    const btn = document.getElementById('continueBtn');
    if (btn) btn.style.display = hasBattleSave() ? 'block' : 'none';
}

// 行动推进的异步调用（读档/重开后丢弃旧纪元回调，防止旧 setTimeout 干扰新流程）
function scheduleProcessNext(delay) {
    const epoch = battleEpoch;
    setTimeout(() => {
        if (epoch !== battleEpoch) return;
        battleState.currentActor = null;
        renderCharacters();
        processNextAction();
    }, delay);
}

// 按本回合速度重建行动队列（startNewRound 与读档共用；速度已在本回合随机定死）
function buildActionQueue() {
    const alive = battleState.allCharacters.filter(c => c.alive);
    alive.sort((a, b) => {
        if (b.speed !== a.speed) return b.speed - a.speed;
        if (a.team === 'player' && b.team === 'enemy') return -1;
        if (a.team === 'enemy' && b.team === 'player') return 1;
        return a.position - b.position;
    });
    battleState.actionQueue = [...alive];
    log(`行动顺序: ${battleState.actionQueue.map(c => c.name + '(' + c.team[0] + c.position + ')').join(' → ')}`);
}

function startNewRound() {
    battleState.turnCount++;
    // v0.310：教程关点击开始回合 → 推进教学步骤③→④
    if (typeof Tutorial !== 'undefined' && Tutorial.active && Tutorial.step === 'start-round') Tutorial.advance('start-round');
    // v0.310：⑧跳过回合步骤——每回合渲染行动面板后刷新弹窗+高亮（跳过按钮按回合重建）
    if (typeof Tutorial !== 'undefined' && Tutorial.active && Tutorial.step === 'skip-turn') Tutorial.showCurrent();
    updateTurnDisplay();
    if (typeof Sfx !== 'undefined') Sfx.play('round');
    log(`══════ 第 ${battleState.turnCount} 回合 ══════`);
    // v0.287：回合开始时候补单位正式入场（隐藏标记转动画标记，渲染时滑入）
    battleState.allCharacters.forEach(c => {
        if (c.pendingEntry) { c.pendingEntry = false; c.entryAnim = true; }
    });
    log(`我方存活：${battleState.getAlivePlayers().length}　敌方存活：${battleState.getAliveEnemies().length}`);
    // 云长郡：每回合开始时若自身无友方单位，召唤2个警察怨灵（先召唤，怨灵同样纳入本回合意图预测）
    const boss = battleState.enemyTeam.find(c => c.hateReduction && c.alive);
    if (boss && battleState.getAliveEnemies().length === 1 && battleState.summonPool.length > 0) {
        battleState.summonWraiths();
    }
    // v0.288：回合开始预测全部敌方/AI 单位的行动意图（玩家决策期即可见，供预判）
    battleState.allCharacters.forEach(c => {
        if (c.alive && !c.pendingEntry && (c.team === 'enemy' || c.aiControlled)) {
            c.intentSkill = predictIntent(c);
        }
    });
    // 部下亡灵之怨恨：减伤在每回合开始时判定（回合内死亡下回合才生效）
    battleState.enemyTeam.forEach(c => c.updateHateReduction());

    // 每回合重随机实际速度（在最小~最大速度区间内），随后按本回合速度排行动顺序；
    // 最小速度（区间下限）才是加油/刹车改变的属性，开创伤害也按它算（用户指定设计）
    battleState.allCharacters.forEach(c => { if (c.alive) c.rerollSpeed(); });

    buildActionQueue();
    nextRoundBtn.style.display = 'none';
    saveAutoBattle();   // v0.313：每回合开始自动存档（回合初始化完成后、行动开始前）
    processNextAction();
}

function processNextAction() {
    if (checkVictory()) return;
    if (battleState.actionQueue.length === 0) {
        onTurnEnd();
        nextRoundBtn.style.display = 'block';
        actionContent.innerHTML = '回合结束，点击按钮继续';
        return;
    }
    battleState.currentActor = battleState.actionQueue.shift();
    if (!battleState.currentActor.alive) { processNextAction(); return; }
    // 暂时昏迷：下一回合无法行动
    if (battleState.currentActor.getBuffStack('stun') > 0) {
        log(`😵 ${battleState.currentActor.name} 因「暂时昏迷」无法行动！`);
        battleState.currentActor.clearBuff('stun');
        battleState.currentActor = null;
        processNextAction();
        return;
    }
    renderCharacters();
    // 玩家操控的单位走玩家回合；敌人与 AI 操控单位（如倒戈的李雅礼）自动行动
    if (battleState.currentActor.team === 'player' && !battleState.currentActor.aiControlled) playerTurn(battleState.currentActor);
    else enemyTurn(battleState.currentActor);
}

function onTurnEnd() {
    Character.invokePassives('onTurnEnd', battleState, log);
    // 催眠：回合结束时将待生效的昏迷转为正式昏迷（下一回合无法行动）
    battleState.allCharacters.forEach(c => {
        if (c.getBuffStack('stunPending') > 0) {
            c.clearBuff('stunPending');
            c.addBuffStack('stun', 1, 1);
        }
    });
    battleState.allCharacters.forEach(c => c.regenSP());   // 算力恢复移至回合结束

    const snapshot = [...battleState.allCharacters];   // 快照：补位/倒戈会增删数组
    snapshot.forEach(c => {
        if (!c.alive) return;
        const burnLevel = c.getBuffLevel('burn');
        const burnStack = c.getBuffStack('burn');
        if (burnStack > 0 && burnLevel > 0) {
            // 每有5级消耗1层（Lv1~4 消耗0层，永不消失）
            const consume = Math.floor(burnLevel / 5);
            let burnDmg;
            if (consume > burnStack) {
                // 层数不足：按剩余层数能供给的等级结算（每层供给5级），燃烧结束
                burnDmg = burnStack * 5 * 50;
                c.clearBuff('burn');
            } else {
                burnDmg = burnLevel * 50;
                c.reduceBuffStack('burn', consume);
                if (c.getBuffStack('burn') <= 0) c.clearBuff('burn');
            }
            // v0.5 易燃（焦木傀儡）：受到的燃烧 dot 伤害×1.5（仅 dot 结算，引爆不乘）
            if (c.burnMultiplier !== 1) burnDmg = Math.floor(burnDmg * c.burnMultiplier);
            const actual = c.takeTrueDamage(burnDmg);
            c.dotDamageMap['burn'] = (c.dotDamageMap['burn'] || 0) + actual;
            log(`🔥 ${c.name} 受到${burnDmg}点「燃烧」伤害（Lv${burnLevel}×${burnStack}层），消耗${consume}层，实际${actual} (血量:${c.hp})`);
            // v0.286：燃烧掉血同帧更新血条并飘伤害数字；v0.288 连 buff 标签一起刷新
            if (window.refreshCardState) refreshCardState(c);
            SkillSystem.showDamageNumber(c, actual, null, allCharsDiv);
            if (!c.alive) {
                log(`💥 ${c.name} 被烧死！`);
                if (c.team === 'enemy') battleState.specialState.burnKill = true;   // v0.5：灼华篇 L0 特殊胜利追踪（敌方被烧死）
                c.handleDeath();   // 待命补位（放在被烧死日志之后）
                Character.invokePassives('onAllyDeath', battleState, c, log);
            }
        }
    });
    renderCharacters();
}

// ==================== 特殊胜利条件（v0.314：每关额外成就，不结束战斗、不写通关记录） ====================
const SPECIAL_CONDITIONS = {
    0: '我方无人阵亡（无损通关）',
    1: '开车警察未使出「开创」即获胜',
    2: '李雅礼倒戈并存活至胜利',
    3: '云长郡减伤仍 ≥10% 时将其击败',
    4: '至少 1 名敌方被「燃烧」烧死',   // v0.5 灼华篇
    5: '焚香祭司未使出「焚香」即获胜', // v0.5 灼华篇
    6: '烛央「狂炎」≥12 层时将其击败'  // v0.5 灼华篇
};

// 当前状态是否满足本关特殊胜利条件（在胜利瞬间判定）
function checkSpecialCondition(level) {
    switch (level) {
        case 0:   // 无损：我方全员存活（死亡角色仍留队且 alive=false，天然反映）
            return battleState.playerTeam.every(c => c.alive);
        case 1:   // 开车警察整场未使出「开创」
            return !battleState.specialState.driverUsedOpen;
        case 2:   // 李雅礼已倒戈为我方且存活
            return battleState.playerTeam.some(c => c.defector && c.alive);
        case 3: { // 云长郡减伤仍 ≥10%（场上累计阵亡 ≤6，亡灵怨恨仍庇护）时将其击败
            // v0.315 放宽：原 ≥50%（阵亡≤3）纯玩家不可达——AI 鲁盼旋只清怨灵（减伤墙 exp=-1）、
            // 玩家又无法手动操作锁定槽 AI 角色；改为 ≥10%（阵亡≤6）后清双怨灵(2)+我方伤亡≤4 仍可达成
            const yun = battleState.enemyTeam.find(c => c.name === '云长郡');
            return !!yun && yun.getHateReduction() >= 10;
        }
        case 4:   // 灼华篇第一关：至少 1 名敌方被「燃烧」dot 烧死
            return battleState.specialState.burnKill === true;
        case 5:   // 灼华篇第二关：焚香祭司整场未使出「焚香」
            return battleState.specialState.incenseUsed === false;
        case 6:   // 灼华篇第三关：烛央「狂炎」≥12 层时将其击败
            return battleState.specialState.zhuYangFrenzyAtDeath >= 12;
    }
    return false;
}

// 战斗页胜利条件栏：正式关显示「基础 + 特殊」两行，其余仅基础
function updateWinCondition() {
    const el = document.getElementById('winCondition');
    if (!el) return;
    const lv = battleState.currentLevel;
    if (lv >= 0 && lv <= 6 && SPECIAL_CONDITIONS[lv]) {
        el.innerHTML = `🏆 胜利条件：击败敌方全部角色<br>✨ 特殊胜利：${SPECIAL_CONDITIONS[lv]}`;
    } else {
        el.innerHTML = '🏆 胜利条件：击败敌方全部角色';
    }
}

function checkVictory() {
    if (battleState.getAlivePlayers().length === 0) {
        log('💀 我方全灭，战斗失败！');
        if (typeof Sfx !== 'undefined') Sfx.play('defeat');
        showResultPage('失败');
        nextRoundBtn.style.display = 'none';
        return true;
    }
    if (battleState.getAliveEnemies().length === 0) {
        // v0.314：胜利瞬间判定特殊胜利条件（额外成就——不结束战斗、不写 pwgame_cleared）
        if (!battleState.specialState.achieved && checkSpecialCondition(battleState.currentLevel)) {
            battleState.specialState.achieved = true;
            log('✨ 特殊胜利条件达成！');
            addStar(battleState.currentLevel, 'special');   // v0.316：特殊胜利 ⭐+1（达成即记录，不依赖最终胜负）
        }
        log('🎉 敌方全灭，我方胜利！');
        if (typeof Sfx !== 'undefined') Sfx.play('victory');
        showResultPage('胜利');
        nextRoundBtn.style.display = 'none';
        return true;
    }
    return false;
}

function restartBattle() {
    const level = battleState.currentLevel;
    battleState.reset();
    if (level === -1) {
        initEnemySelection();
        startCustomBattle();
    } else {
        startBattle(level);
    }
}

function backToTitle() {
    battleState.reset();
    battleEpoch++;   // v0.313：回主界面，丢弃旧纪元异步回调
    refreshContinueBtn();   // v0.313：主界面显示「继续战斗」入口（若有未完成的自动存档）
    initCharSelection();
    showPage('pageTitle');
}

// v0.318：关卡中途退出——确认后回主界面；自动存档保留（主界面「继续战斗」从最近回合开始接着打）
// v0.319：确认框改为游戏内弹窗（替代浏览器原生 confirm）
function exitBattle() {
    showModal({
        title: '退出战斗',
        message: '确定退出当前战斗吗？\n\n退出后回到主界面，主界面「继续战斗」可从最近回合开始继续。',
        type: 'confirm',
        confirmText: '退出',
        onConfirm: () => backToTitle()
    });
}

// ==================== 开始战斗 ====================
function startBattle(level) {
    battleLog = [];
    battleState.reset();
    battleEpoch++;   // v0.313：新战斗开始，丢弃旧纪元异步回调
    battleState.currentLevel = level;
    globalId = 0;

    const playerChars = [];
    const benchPlayers = [];
    let pos = 0;
    // v0.311+v0.5：第四关/灼华第三关 = 待命1（index 0，最左）+ 出战3（index 1/2/3）；其余关卡全上场
    selectedSlots.forEach((role, idx) => {
        if (role === null) return;
        const char = createRoleInstance(role, 'player', idx);
        if (!char) return;
        if ((level === 3 || level === 6) && idx === 0) {
            benchPlayers.push(char);
            return;
        }
        char.order = pos;
        playerChars.push(char);
        pos++;
    });
    playerChars.sort((a, b) => a.order - b.order);
    playerChars.forEach((c, i) => { c.position = i; c.order = i; });
    // v0.312：第四关 AI 鲁盼旋站最前方（玩家 position 最大、紧挨敌方）
    if (level === 3) {
        const luIdx = playerChars.findIndex(c => c.name === '鲁盼旋');
        if (luIdx !== -1) {
            playerChars[luIdx].aiControlled = true;
            const lu = playerChars.splice(luIdx, 1)[0];
            playerChars.push(lu);   // 移到数组末尾 → order/position 最大 → 最前方
            playerChars.forEach((c, i) => { c.position = i; c.order = i; });
        }
    }
    // v0.5：灼华篇第三关（level 6）锁定灼华站最前方；v0.5 改：强制上场角色统一内置我方 AI（与第四关鲁盼旋一致）
    if (level === 6) {
        const zhIdx = playerChars.findIndex(c => c.name === '灼华');
        if (zhIdx !== -1) {
            playerChars[zhIdx].aiControlled = true;
            const zh = playerChars.splice(zhIdx, 1)[0];
            playerChars.push(zh);   // 移到数组末尾 → order/position 最大 → 最前方
            playerChars.forEach((c, i) => { c.position = i; c.order = i; });
        }
    }
    if (benchPlayers.length) {
        // v0.312：我方替补 order 取负 → 入场后排最左（自家后排），从左边补上
        benchPlayers.forEach((c, i) => {
            c.order = -10 - i;
            c.pendingEntry = false;
        });
        battleState.benchPlayer = benchPlayers;
    }

    let enemyChars = [];
    if (level === 0) {
        // 第一关：持盾+持棍+持枪警察
        enemyChars = [
            createPolice('enemy', playerChars.length, 0),
            createStickPolice('enemy', playerChars.length + 1, 100),
            createGunPolice('enemy', playerChars.length + 2, 200)
        ];
    } else if (level === 1) {
        // 第二关：前线复制第一关（持盾+持棍+持枪），开车警察待命
        enemyChars = [
            createPolice('enemy', playerChars.length, 0),
            createStickPolice('enemy', playerChars.length + 1, 100),
            createGunPolice('enemy', playerChars.length + 2, 200)
        ];
        const benchDriver = createDrivingPolice('enemy', 99, 500);   // 待命者满算力入场
        benchDriver.order = playerChars.length + 3;   // 待命者排在最后，入场后依次填补
        battleState.benchEnemy = [benchDriver];
    } else if (level === 2) {
        // 第三关：李雅礼（站最前）+ 持枪警察×2 上场，开车警察待命
        enemyChars = [
            createRoleInstance('李雅礼', 'enemy', playerChars.length),
            createGunPolice('enemy', playerChars.length + 1, 200),
            createGunPolice('enemy', playerChars.length + 2, 200)
        ];
        const benchDriver = createDrivingPolice('enemy', 99, 500);
        benchDriver.order = playerChars.length + 3;
        battleState.benchEnemy = [benchDriver];
    } else if (level === 3) {
        // 第四关：Boss 云长郡（亡灵怨恨减伤 + 召唤怨灵）
        enemyChars = [
            createYunChangjun('enemy', playerChars.length)
        ];
        battleState.summonPool = ['持盾警察', '持盾警察', '持棍警察', '持棍警察', '持枪警察', '持枪警察', '持枪警察', '持枪警察', '开车警察', '开车警察'];
    } else if (level === 4) {
        // 灼华篇第一关：烬火信徒×2 + 焦木傀儡×1
        enemyChars = [
            createAshCultist('enemy', playerChars.length),
            createAshCultist('enemy', playerChars.length + 1),
            createCharredGolem('enemy', playerChars.length + 2)
        ];
    } else if (level === 5) {
        // 灼华篇第二关：引火学徒×2 + 焚香祭司，烬火信徒待命
        enemyChars = [
            createFirestarter('enemy', playerChars.length),
            createFirestarter('enemy', playerChars.length + 1),
            createIncensePriest('enemy', playerChars.length + 2)
        ];
        const benchCultist = createAshCultist('enemy', 99);
        benchCultist.order = playerChars.length + 3;   // 待命者排在最后，入场后依次填补
        battleState.benchEnemy = [benchCultist];
    } else if (level === 6) {
        // 灼华篇第三关：Boss 烛央（狂炎/薪火不息/焚尽薪火）+ 焦木傀儡×2
        // v0.5：Boss 站最后排——焦木傀儡（HP3200 肉盾）挡在前线，烛央殿后（原烛央 order 最小裸奔最前，站位颠倒）
        enemyChars = [
            createCharredGolem('enemy', playerChars.length),
            createCharredGolem('enemy', playerChars.length + 1),
            createZhuYang('enemy', playerChars.length + 2)
        ];
    } else if (level === -2) {
        // 教程关：训练木偶 ×1（演示防御/破防机制）
        enemyChars = [
            createTrainingDummy('enemy', playerChars.length)
        ];
    } else {
        // 兜底：第一关
        enemyChars = [
            createPolice('enemy', playerChars.length, 0),
            createStickPolice('enemy', playerChars.length + 1, 100),
            createGunPolice('enemy', playerChars.length + 2, 200)
        ];
    }
    enemyChars.forEach((c, i) => { c.order = i + playerChars.length; });

    battleState.playerTeam.push(...playerChars);
    battleState.enemyTeam.push(...enemyChars);
    battleState.allCharacters.push(...playerChars, ...enemyChars);

    repositionAll();
    renderCharacters();
    updateTurnDisplay();
    updateWinCondition();
    logPanel.innerHTML = '<p>战斗开始！</p>';
    if (battleState.benchPlayer.length) {
        log(`🛡️ 我方待命区：${battleState.benchPlayer.map(c => c.name).join('、')}（阵亡后入场补位）`);
    }
    if (battleState.benchEnemy.length) {
        log(`🚑 敌方待命区：${battleState.benchEnemy.map(c => c.name).join('、')}（前方阵亡后入场补位）`);
    }
    actionContent.innerHTML = '点击按钮开始第一回合';
    nextRoundBtn.style.display = 'block';
    nextRoundBtn.onclick = startNewRound;
    showPage('pageBattle');
}

// ==================== 自选敌人战斗 ====================
function startCustomBattle() {
    // v0.309：敌方 6 槽 = 前 3 出场 + 后 3 后备（后备经 benchEnemy 补位机制入场）
    const frontRoles = enemySlots.slice(0, 3).filter(r => r !== null);
    if (frontRoles.length === 0) { showModal({ title: '提示', message: '请至少选择一个出场敌人！' }); return; }
    const playerCount = selectedSlots.filter(r => r !== null).length;
    if (playerCount === 0) { showModal({ title: '提示', message: '请先在选角界面选择出战角色！' }); return; }

    battleLog = [];
    battleState.reset();
    battleEpoch++;   // v0.313：新战斗开始，丢弃旧纪元异步回调
    battleState.currentLevel = -1;
    globalId = 0;

    const playerChars = [];
    let pos = 0;
    selectedSlots.forEach(role => {
        if (role !== null) {
            const char = createRoleInstance(role, 'player', pos);
            if (char) { char.order = pos; playerChars.push(char); pos++; }
        }
    });
    playerChars.sort((a, b) => a.order - b.order);
    playerChars.forEach((c, i) => { c.position = i; c.order = i; });

    const enemyChars = [];
    frontRoles.forEach((role, i) => {
        const char = createRoleInstance(role, 'enemy', playerChars.length + i);
        if (char) { char.order = playerChars.length + i; enemyChars.push(char); }
    });

    // 后备：填满 benchEnemy，死亡后由 queueBenchEntry 入场（v0.287 机制）
    const benchRoles = enemySlots.slice(3).filter(r => r !== null);
    battleState.benchEnemy = benchRoles.map((role, i) => {
        const c = createRoleInstance(role, 'enemy', 99);
        if (c) c.order = playerChars.length + 3 + i;
        return c;
    }).filter(c => c);

    battleState.playerTeam.push(...playerChars);
    battleState.enemyTeam.push(...enemyChars);
    battleState.allCharacters.push(...playerChars, ...enemyChars);

    repositionAll();
    renderCharacters();
    updateTurnDisplay();
    updateWinCondition();
    logPanel.innerHTML = '<p>⚔️ 自定义测试战斗开始！</p>';
    if (battleState.benchEnemy.length) {
        log(`🚑 敌方待命区：${battleState.benchEnemy.map(c => c.name).join('、')}（前方阵亡后入场补位）`);
    }
    actionContent.innerHTML = '点击按钮开始第一回合';
    nextRoundBtn.style.display = 'block';
    nextRoundBtn.onclick = startNewRound;
    showPage('pageBattle');
}

// v0.312：胜利结算页「下一关」→ 进下一关介绍页
function nextLevel() {
    const next = battleState.currentLevel + 1;
    // v0.5：篇章内推进（鲁盼旋篇 0~3 / 灼华篇 4~6，跨篇章不跳）
    const inLu = battleState.currentLevel >= 0 && battleState.currentLevel < 3;
    const inZh = battleState.currentLevel >= 4 && battleState.currentLevel < 6;
    if ((inLu || inZh) && typeof selectLevel === 'function') selectLevel(next);
}

// ==================== 初始化 ====================
initCharSelection();
refreshContinueBtn();   // v0.313：主界面检测未完成的自动存档，显示「继续战斗」入口
