// Roles.js - 所有角色创建函数

function createTemplateOne(team, position) {
    const skills = [
        new Skill('技能一·突刺', 200, 300, 100, 2, 2),
        new Skill('技能二·重斩', 400, 600, 300, 2, 3),
        new Skill('技能三·终结', 800, 800, 400, 3, 3)
    ];
    return new Character('模板一', 2000, 200, [3,7], 1000, 300, skills, team, position);
}

function createPolice(team, position, initialSP = null) {
    const skills = [
        new Skill('持盾格挡', 0, 100, 200, 1, 1, { type: 'def', value: 100, duration: 'nextHit' }),
        new Skill('持盾猛击', 200, 500, 500, 1, 1, { type: 'def', value: -200, duration: 'nextHit' })
    ];
    const char = new Character('持盾警察', 2000, 300, [2,4], 200, 50, skills, team, position);
    if (initialSP !== null) char.sp = initialSP;
    return char;
}

function createStickPolice(team, position, initialSP = null) {
    const skills = [
        new Skill('棍击', 0, 200, 100, 2, 2),
        new Skill('一秒18棍', 200, 400, 50, 18, 2)
    ];
    const char = new Character('持棍警察', 2000, 200, [3,6], 200, 50, skills, team, position);
    if (initialSP !== null) char.sp = initialSP;
    return char;
}

function createGunPolice(team, position, initialSP = null) {
    const skills = [
        new Skill('开火', 200, 400, 1200, 1, 4)
    ];
    const char = new Character('持枪警察', 2000, 100, [4,8], 200, 50, skills, team, position);
    if (initialSP !== null) char.sp = initialSP;
    return char;
}

// ==================== 鲁盼旋 ====================
function createLuPanxuan(team, position) {
    const skills = [
        new Skill('斩祟·亮剑',       100,  200,  50,  3,  4, null, { type: 'burn', stacks: 1 }),
        new Skill('剑气迸进',         700,  500, 500,  1,  6, null, { type: 'ignoreDef', value: 200 }),
        new Skill('十二连·剑斩邪祟', 1200,  300, 100, 12,  3, null, { type: 'evilDrain', bonus: 50 })
    ];
    const char = new Character('鲁盼旋', 2000, 200, [5,7], 1200, 400, skills, team, position);
    // ——— 被动零：惩恶之火 — 友方受伤时伤害来源获得 1 层【恶】 ———
    char.registerPassive('onDamageDealt', (self, bs, attacker, target, actual, log) => {
        if (actual > 0 && target.team === 'player') {
            attacker.addBuffStack('e', 1, 1);
            log(`  🔥 ${attacker.name} 获得1层【恶】`);
        }
    });

    // ——— 被动一：无行动回合结束回复 200 算力 ———
    char.registerPassive('onTurnEnd', (self, bs, log) => {
        if (!self.actedThisTurn) {
            const before = self.sp;
            self.sp = Math.min(self.maxSP, self.sp + 200);
            const gained = self.sp - before;
            if (gained > 0) log(`♻️ ${self.name}(位置${self.position}) 未使用技能，回复${gained}算力 (${self.sp}/${self.maxSP})`);
        }
    });

    // ——— 被动二：回合结束，获得等同于场上恶总层数的愤怒 ———
    char.registerPassive('onTurnEnd', (self, bs, log) => {
        let totalEvil = 0;
        bs.allCharacters.forEach(c => { if (c.alive) totalEvil += c.getBuffStack('e'); });
        if (totalEvil > 0) {
            self.addBuffStack('rage', totalEvil, 1);
            const rageBuff = self.buffs.find(b => b.type === 'rage');
            if (rageBuff && rageBuff.stack > 5) rageBuff.stack = 5;
            log(`💢 ${self.name}(位置${self.position}) 从场上${totalEvil}层【恶】获得${totalEvil}层【愤怒】（上限5层）`);
        }
    });

    // ——— 被动三：友方死亡获得 5 层愤怒 ———
    char.registerPassive('onAllyDeath', (self, bs, deadChar, log) => {
        if (deadChar.team === 'player' && self !== deadChar) {
            self.addBuffStack('rage', 3, 1);
            const rageBuff = self.buffs.find(b => b.type === 'rage');
            if (rageBuff && rageBuff.stack > 5) rageBuff.stack = 5;
            log(`  💢 ${self.name}(位置${self.position}) 获得3层【愤怒】（上限5层）`);
        }
    });

    // ——— 被动四：技能命中后施加燃烧（分配硬币数级） ———
    //          若目标燃烧 ≤3 层，消耗 1 层愤怒额外施加 1 层燃烧
    char.registerPassive('onSkillHit', (self, bs, actor, target, coins, log) => {
        if (self !== actor) return;  // 仅技能施放者自己触发
        if (target.alive) {
            target.addBuffLevel('burn', coins);
            log(`  🔥 ${target.name} 获得${coins}级【燃烧】`);
            if (target.getBuffStack('burn') <= 3 && self.getBuffStack('rage') > 0) {
                self.reduceBuffStack('rage', 1);
                target.addBuffStack('burn', 1, 1);
                log(`  🔥 消耗1层【愤怒】，${target.name} 额外获得1层【燃烧】`);
            }
        }
    });

    return char;
}

// ==================== 稻草人系列（测试用） ====================
function createScarecrowPaper(team, position) {
    const skills = [
        new Skill('轻击', 0, 50, 0, 1, 1)
    ];
    return new Character('纸糊稻草人', 9999, 0, [1,1], 100, 0, skills, team, position);
}

function createScarecrowIron(team, position) {
    const skills = [
        new Skill('轻击', 0, 50, 0, 1, 1)
    ];
    return new Character('铁皮稻草人', 9999, 999, [1,1], 100, 0, skills, team, position);
}

function createScarecrowStandard(team, position) {
    const skills = [
        new Skill('轻击', 0, 50, 0, 1, 1)
    ];
    return new Character('标准稻草人', 9999, 200, [1,2], 100, 0, skills, team, position);
}

function createScarecrowFast(team, position) {
    const skills = [
        new Skill('轻击', 0, 50, 0, 1, 1)
    ];
    return new Character('灵敏稻草人', 5000, 50, [8,10], 100, 0, skills, team, position);
}

function createScarecrowRegen(team, position) {
    const skills = [
        new Skill('轻击', 0, 50, 0, 1, 1)
    ];
    const char = new Character('再生稻草人', 9999, 100, [1,2], 100, 0, skills, team, position);
    char.registerPassive('onTurnEnd', (self, bs, log) => {
        if (self.alive && self.hp < self.maxHp) {
            const heal = 500;
            self.hp = Math.min(self.maxHp, self.hp + heal);
            log(`🌿 ${self.name}(位置${self.position}) 再生恢复${heal}HP (${self.hp}/${self.maxHp})`);
        }
    });
    return char;
}

// ==================== 工厂入口 ====================
function createRoleInstance(roleName, team, position) {
    if (roleName === '模板一') return createTemplateOne(team, position);
    if (roleName === '鲁盼旋') return createLuPanxuan(team, position);
    if (roleName === '纸糊稻草人') return createScarecrowPaper(team, position);
    if (roleName === '铁皮稻草人') return createScarecrowIron(team, position);
    if (roleName === '标准稻草人') return createScarecrowStandard(team, position);
    if (roleName === '灵敏稻草人') return createScarecrowFast(team, position);
    if (roleName === '再生稻草人') return createScarecrowRegen(team, position);
    return null;
}
