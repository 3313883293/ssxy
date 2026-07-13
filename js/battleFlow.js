// battleFlow.js - 回合流程、开始战斗

function startNewRound() {
    battleState.turnCount++;
    updateTurnDisplay();
    log(`══════ 第 ${battleState.turnCount} 回合 ══════`);
    log(`我方存活：${battleState.getAlivePlayers().length}　敌方存活：${battleState.getAliveEnemies().length}`);
    battleState.allCharacters.forEach(c => c.regenSP());

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
    renderCharacters();
    if (battleState.currentActor.team === 'player') playerTurn(battleState.currentActor);
    else enemyTurn(battleState.currentActor);
}

function onTurnEnd() {
    Character.invokePassives('onTurnEnd', battleState, log);

    battleState.allCharacters.forEach(c => {
        if (!c.alive) return;
        const burnLevel = c.getBuffLevel('burn');
        const burnStack = c.getBuffStack('burn');
        if (burnStack > 0 && burnLevel > 0) {
            const burnDmg = burnLevel * 50;
            const actual = c.takeTrueDamage(burnDmg);
            c.dotDamageMap['burn'] = (c.dotDamageMap['burn'] || 0) + actual;
            log(`🔥 ${c.name} 受到${burnDmg}点燃烧伤害（Lv${burnLevel}×${burnStack}层），实际${actual} (HP:${c.hp})`);
            c.reduceBuffStack('burn', 1);
            if (c.getBuffStack('burn') <= 0) c.clearBuff('burn');
            if (!c.alive) {
                log(`💥 ${c.name} 被烧死！`);
                Character.invokePassives('onAllyDeath', battleState, c, log);
            }
        }
    });
    renderCharacters();
}

function checkVictory() {
    if (battleState.getAlivePlayers().length === 0) {
        log('💀 我方全灭，战斗失败！');
        showResultPage('失败');
        nextRoundBtn.style.display = 'none';
        return true;
    }
    if (battleState.getAliveEnemies().length === 0) {
        log('🎉 敌方全灭，我方胜利！');
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
    } else {
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
    logPanel.innerHTML = '<p>战斗开始！</p>';
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
