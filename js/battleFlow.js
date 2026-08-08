// battleFlow.js - 回合流程、开始战斗

function startNewRound() {
    battleState.turnCount++;
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

    const alive = battleState.allCharacters.filter(c => c.alive);
    alive.sort((a, b) => {
        if (b.speed !== a.speed) return b.speed - a.speed;
        if (a.team === 'player' && b.team === 'enemy') return -1;
        if (a.team === 'enemy' && b.team === 'player') return 1;
        return a.position - b.position;
    });
    battleState.actionQueue = [...alive];
    log(`行动顺序: ${battleState.actionQueue.map(c => c.name + '(' + c.team[0] + c.position + ')').join(' → ')}`);
    nextRoundBtn.style.display = 'none';
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
            const actual = c.takeTrueDamage(burnDmg);
            c.dotDamageMap['burn'] = (c.dotDamageMap['burn'] || 0) + actual;
            log(`🔥 ${c.name} 受到${burnDmg}点「燃烧」伤害（Lv${burnLevel}×${burnStack}层），消耗${consume}层，实际${actual} (HP:${c.hp})`);
            // v0.286：燃烧掉血同帧更新血条并飘伤害数字；v0.288 连 buff 标签一起刷新
            if (window.refreshCardState) refreshCardState(c);
            SkillSystem.showDamageNumber(c, actual, null, allCharsDiv);
            if (!c.alive) {
                log(`💥 ${c.name} 被烧死！`);
                c.handleDeath();   // 待命补位（放在被烧死日志之后）
                Character.invokePassives('onAllyDeath', battleState, c, log);
            }
        }
    });
    renderCharacters();
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
    initCharSelection();
    showPage('pageTitle');
}

// ==================== 开始战斗 ====================
function startBattle(level) {
    battleLog = [];
    battleState.reset();
    battleState.currentLevel = level;
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

    let enemyChars = [];
    if (level === 0) {
        enemyChars = [
            createRoleInstance('纸糊稻草人', 'enemy', playerChars.length),
            createRoleInstance('铁皮稻草人', 'enemy', playerChars.length + 1),
            createRoleInstance('标准稻草人', 'enemy', playerChars.length + 2)
        ];
    } else if (level === 1) {
        enemyChars = [
            createPolice('enemy', playerChars.length, 0),
            createStickPolice('enemy', playerChars.length + 1, 100),
            createGunPolice('enemy', playerChars.length + 2, 200)
        ];
    } else if (level === 2) {
        // 第二关：前线复制第一关（持盾+持棍+持枪），开车警察待命
        enemyChars = [
            createPolice('enemy', playerChars.length, 0),
            createStickPolice('enemy', playerChars.length + 1, 100),
            createGunPolice('enemy', playerChars.length + 2, 200)
        ];
        const benchDriver = createDrivingPolice('enemy', 99, 500);   // 待命者满算力入场
        benchDriver.order = playerChars.length + 3;   // 待命者排在最后，入场后依次填补
        battleState.benchEnemy = [benchDriver];
    } else if (level === 3) {
        // 第三关：李雅礼（站最前）+ 持枪警察×2 上场，开车警察待命
        enemyChars = [
            createRoleInstance('李雅礼', 'enemy', playerChars.length),
            createGunPolice('enemy', playerChars.length + 1, 200),
            createGunPolice('enemy', playerChars.length + 2, 200)
        ];
        const benchDriver = createDrivingPolice('enemy', 99, 500);
        benchDriver.order = playerChars.length + 3;
        battleState.benchEnemy = [benchDriver];
    } else if (level === 4) {
        // 第四关：Boss 云长郡（亡灵怨恨减伤 + 召唤怨灵）
        enemyChars = [
            createYunChangjun('enemy', playerChars.length)
        ];
        battleState.summonPool = ['持盾警察', '持盾警察', '持棍警察', '持棍警察', '持枪警察', '持枪警察', '持枪警察', '持枪警察', '开车警察', '开车警察'];
    } else {
        // 第三关：李雅礼（站最前）+ 持枪警察×2 上场，开车警察待命
        enemyChars = [
            createRoleInstance('李雅礼', 'enemy', playerChars.length),
            createGunPolice('enemy', playerChars.length + 1, 200),
            createGunPolice('enemy', playerChars.length + 2, 200)
        ];
        const benchDriver = createDrivingPolice('enemy', 99, 500);
        benchDriver.order = playerChars.length + 3;
        battleState.benchEnemy = [benchDriver];
    }
    enemyChars.forEach((c, i) => { c.order = i + playerChars.length; });

    battleState.playerTeam.push(...playerChars);
    battleState.enemyTeam.push(...enemyChars);
    battleState.allCharacters.push(...playerChars, ...enemyChars);

    repositionAll();
    renderCharacters();
    updateTurnDisplay();
    logPanel.innerHTML = '<p>战斗开始！</p>';
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
    const enemyCount = enemySlots.filter(r => r !== null).length;
    if (enemyCount === 0) { alert('请至少选择一个敌人！'); return; }
    const playerCount = selectedSlots.filter(r => r !== null).length;
    if (playerCount === 0) { alert('请先在选角界面选择出战角色！'); return; }

    battleLog = [];
    battleState.reset();
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
    let eIdx = 0;
    enemySlots.forEach(role => {
        if (role !== null) {
            const char = createRoleInstance(role, 'enemy', playerChars.length + eIdx);
            if (char) { char.order = playerChars.length + eIdx; enemyChars.push(char); eIdx++; }
        }
    });

    battleState.playerTeam.push(...playerChars);
    battleState.enemyTeam.push(...enemyChars);
    battleState.allCharacters.push(...playerChars, ...enemyChars);

    repositionAll();
    renderCharacters();
    updateTurnDisplay();
    logPanel.innerHTML = '<p>⚔️ 自定义测试战斗开始！</p>';
    actionContent.innerHTML = '点击按钮开始第一回合';
    nextRoundBtn.style.display = 'block';
    nextRoundBtn.onclick = startNewRound;
    showPage('pageBattle');
}

// ==================== 初始化 ====================
initCharSelection();
