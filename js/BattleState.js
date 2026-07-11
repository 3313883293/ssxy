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
    }

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
    }
}
