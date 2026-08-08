// BattleState.js - 战斗状态管理
class BattleState {
    constructor() {
        this.allCharacters = [];
        this.playerTeam = [];
        this.enemyTeam = [];
        this.turnCount = 0;
        this.actionQueue = [];
        this.currentActor = null;
        this.selectedSkill = null;
        this.waitingForPlayer = false;
        this.currentSelectedTargets = new Set();
        this.currentLevel = 0;
        this.benchPlayer = [];   // 玩家待命区（前方友方死亡后最靠前者入场）
        this.benchEnemy = [];    // 敌方待命区
        this.totalDeaths = 0;    // 场上累计阵亡数（云长郡减伤计算用）
        this.summonPool = [];    // 云长郡怨灵召唤池（2持盾2持棍4持枪2车）
        this.specialState = {    // v0.314：特殊胜利状态（每关额外成就，达成即记录、读档不丢失）
            achieved: false,       // 本关特殊胜利是否已达成
            driverUsedOpen: false  // 第二关：开车警察是否使出过「开创」（过程追踪）
        };
    }

    // —————— 云长郡召唤：每回合开始时若自身无友方单位，召唤2个警察怨灵 ——————
    summonWraiths() {
        if (!this.summonPool.length) return;
        for (let i = 0; i < 2; i++) {
            if (!this.summonPool.length) break;
            const idx = Math.floor(Math.random() * this.summonPool.length);
            const type = this.summonPool.splice(idx, 1)[0];   // 从池中随机抽
            const wraith = createPoliceWraith(type, 99);
            wraith.entryAnim = true;   // v0.287：召唤登场带滑入动画（本回合立即入场，不需隐藏）
            wraith.order = -99;   // 怨灵在左边生成（紧贴玩家一侧）
            this.enemyTeam.push(wraith);
            this.allCharacters.push(wraith);
            if (typeof log === 'function') log(`👻 云长郡 召唤了警察怨灵：${wraith.name}（HP ${wraith.maxHp}）`);
        }
        this.repositionAll();
    }

    // —————— 倒戈：李雅礼死亡后作为我方单位复活，位于我方最右方（紧挨敌人） ——————
    defectToPlayer(defected) {
        this.enemyTeam = this.enemyTeam.filter(c => c !== defected);
        this.allCharacters = this.allCharacters.filter(c => c !== defected);
        const revived = createRoleInstance('李雅礼', 'player', 0);
        revived.order = 999;          // 排在玩家最右，紧挨敌方（象征抵抗距离1可及）
        revived.aiControlled = true;  // 倒戈后依然由 AI 操控
        this.playerTeam.push(revived);
        this.allCharacters.push(revived);
        if (typeof log === 'function') log(`🔄 ${defected.name} 死亡后作为我方单位复活，位于最右方！`);
    }

    // —————— 待命区补位（v0.287：死亡时仅标记，回合开始时入场） ——————
    queueBenchEntry(team) {
        const bench = team === 'player' ? this.benchPlayer : this.benchEnemy;
        if (!bench.length) return;
        const replacement = bench.shift();   // 最靠前者
        replacement.alive = true;
        replacement.pendingEntry = true;     // 标记：下一回合开始入场（入场动画由 renderCharacters 消费）
        if (team === 'player') this.playerTeam.push(replacement);
        else this.enemyTeam.push(replacement);
        this.allCharacters.push(replacement);
        this.repositionAll();
        if (typeof log === 'function') log(`🚑 ${replacement.name} 已候补，将于下一回合开始入场！`);
    }

    // 候补单位（pendingEntry，下一回合入场）计入存活：必须把后备也消灭才能获胜（v0.288 曾改为不计入被否决，保留"全灭才算赢"）
    getAliveEnemies() { return this.enemyTeam.filter(c => c.alive); }
    getAlivePlayers() { return this.playerTeam.filter(c => c.alive); }

    findCharacterById(id) {
        return this.allCharacters.find(c => c.id === id);
    }

    repositionAll() {
        const alivePlayers = this.playerTeam.filter(c => c.alive).sort((a,b) => a.order - b.order);
        const aliveEnemies = this.enemyTeam.filter(c => c.alive).sort((a,b) => a.order - b.order);
        let pos = 0;
        alivePlayers.forEach(c => c.position = pos++);
        aliveEnemies.forEach(c => c.position = pos++);
    }

    reset() {
        this.allCharacters = [];
        this.playerTeam = [];
        this.enemyTeam = [];
        this.turnCount = 0;
        this.actionQueue = [];
        this.currentActor = null;
        this.selectedSkill = null;
        this.waitingForPlayer = false;
        this.currentSelectedTargets.clear();
        this.currentLevel = 0;
        this.benchPlayer = [];
        this.benchEnemy = [];
        this.totalDeaths = 0;
        this.summonPool = [];
        this.specialState = { achieved: false, driverUsedOpen: false };   // v0.314
    }
}
