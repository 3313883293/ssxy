// Roles.js - 所有角色创建函数

function createTemplateOne(team, position) {
    const skills = [
        new Skill('技能一', 200, 300, 100, 2, 2),
        new Skill('技能二', 400, 600, 200, 2, 3),
        new Skill('技能三', 600, 600, 400, 3, 3)
    ];
    return new Character('模板一', 2000, 200, [2,6], 1000, 300, skills, team, position);
}

function createTemplateTwo(team, position) {
    const skills = [
        new Skill('技能一', 300, 300, 600, 1, 5),
        new Skill('技能二', 400, 200, 300, 4, 4),
        new Skill('技能三', 500, 500, 1000, 1, 6)
    ];
    return new Character('模板二', 2000, 100, [4,7], 1000, 300, skills, team, position);
}

function createTemplateThree(team, position) {
    const skills = [
        new Skill('技能一', 100, 50, 100, 3, 3),
        new Skill('技能二', 400, 600, 400, 1, 1),
        new Skill('技能三', 700, 1000, 800, 1, 1)
    ];
    return new Character('模板三', 2000, 300, [1,4], 1000, 300, skills, team, position);
}

function createPolice(team, position, initialSP = null) {
    const skills = [
        new Skill('持盾格挡', 0, 100, 200, 1, 1, { type: 'def', value: 100, duration: 'nextHit' }),
        new Skill('持盾猛击', 200, 500, 500, 1, 1, { type: 'def', value: -200, duration: 'nextHit' })
    ];
    const char = new Character('持盾警察', 2000, 300, [1,3], 200, 50, skills, team, position);
    if (initialSP !== null) char.sp = initialSP;
    return char;
}

function createStickPolice(team, position, initialSP = null) {
    const skills = [
        new Skill('棍击', 0, 200, 100, 2, 2),
        new Skill('一秒18棍', 200, 400, 50, 18, 2)
    ];
    const char = new Character('持棍警察', 2000, 200, [2,5], 200, 50, skills, team, position);
    if (initialSP !== null) char.sp = initialSP;
    return char;
}

function createGunPolice(team, position, initialSP = null) {
    const skills = [
        new Skill('开火', 200, 400, 1200, 1, 4)
    ];
    const char = new Character('持枪警察', 2000, 100, [3,7], 200, 50, skills, team, position);
    if (initialSP !== null) char.sp = initialSP;
    return char;
}

// ==================== 鲁盼旋 ====================
function createLuPanxuan(team, position) {
    const skills = [
        new Skill('斩祟·亮剑',       300,  100,  100,  3,  4, null, { type: 'burn', stacks: 1 }),
        new Skill('剑气迸进',         500,  500, 600,  1,  6, null, { type: 'ignoreDef', value: 200 }),
        new Skill('十二连·剑斩邪祟', 800,  300, 100, 12, 3, null, { type: 'evilDrain', bonus: 100 })   // v0.293：加成伤害与恶加伤 50→100
    ];
    const char = new Character('鲁盼旋', 2000, 200, [4,6], 1200, 400, skills, team, position);
    // ——— 被动零：惩恶之火 — 本阵营角色受伤时伤害来源获得 1 层【恶】（v0.309 按敌我阵营区分） ———
    char.registerPassive('onDamageDealt', (self, bs, attacker, target, actual, log) => {
        if (actual > 0 && target.team === self.team) {
            attacker.addBuffStack('e', 1, 1);
            log(`  🔥 ${attacker.name} 获得1层「恶」`);
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
            log(`💢 ${self.name}(位置${self.position}) 从场上${totalEvil}层「恶」获得${totalEvil}层「愤怒」（上限5层）`);
        }
    });

    // ——— 被动三：本阵营角色死亡获得 3 层愤怒（v0.309 按敌我阵营区分） ———
    char.registerPassive('onAllyDeath', (self, bs, deadChar, log) => {
        if (deadChar.team === self.team && self !== deadChar) {
            self.addBuffStack('rage', 3, 1);
            const rageBuff = self.buffs.find(b => b.type === 'rage');
            if (rageBuff && rageBuff.stack > 5) rageBuff.stack = 5;
            log(`  💢 ${self.name}(位置${self.position}) 获得3层「愤怒」（上限5层）`);
        }
    });

    // ——— 被动四：技能命中后施加燃烧（分配硬币数级） ———
    //          若目标燃烧 ≤3 层，消耗 1 层愤怒额外施加 1 层燃烧
    char.registerPassive('onSkillHit', (self, bs, actor, target, coins, log) => {
        if (self !== actor) return;  // 仅技能施放者自己触发
        if (target.alive) {
            target.addBuffLevel('burn', coins);
            log(`  🔥 ${target.name} 获得${coins}级「燃烧」`);
            if (target.getBuffStack('burn') <= 3 && self.getBuffStack('rage') > 0) {
                self.reduceBuffStack('rage', 1);
                target.addBuffStack('burn', 1, 1);
                log(`  🔥 消耗1层「愤怒」，${target.name} 额外获得1层「燃烧」`);
            }
        }
    });

    return char;
}

// ==================== 云长郡（第四关 Boss） ====================
function createYunChangjun(team, position) {
    const skills = [
        // 催眠气体释放：随机指定目标，使其暂时昏迷（下一回合无法行动）
        new Skill('催眠气体释放', 700, 400, 400, 1, 4, null, { type: 'stun' }),
        // 手枪威慑：指定所有目标
        new Skill('手枪威慑', 100, 200, 200, 3, 6)
    ];
    const char = new Character('云长郡', 8000, 200, [2,6], 800, 300, skills, team, position);
    char.hateReduction = true;   // 被动·部下亡灵之怨恨：受击减伤100%，场上每阵亡1角色-10%
    return char;
}

// 召唤警察怨灵：原单位一半初始HP与算力（开车警察为25%HP）
function createPoliceWraith(type, position) {
    let c;
    if (type === '持盾警察') c = createPolice('enemy', position, 100);
    else if (type === '持棍警察') c = createStickPolice('enemy', position, 100);
    else if (type === '持枪警察') c = createGunPolice('enemy', position, 100);
    else c = createDrivingPolice('enemy', position, 250);
    const ratio = type === '开车警察' ? 0.25 : 0.5;   // 怨灵车只有25%HP
    c.maxHp = c.hp = Math.floor(c.hp * ratio);
    c._wraithType = type;   // v0.313：标记怨灵类型，战斗自动存档据此重建（createPoliceWraith）
    return c;
}

// ==================== 李雅礼 ====================
// 死亡后作为我方单位复活，位于我方最前方（倒戈机制）
function createLiYali(team, position) {
    const skills = [
        new Skill('象征抵抗', 0, 200, 0, 1, 1)
    ];
    const char = new Character('李雅礼', 2000, 0, [1,7], 0, 0, skills, team, position);
    char.defector = true;   // 死亡后倒戈加入玩家阵营
    return char;
}

// ==================== 开车警察 ====================
function createDrivingPolice(team, position, initialSP = null) {
    const skills = [
        // 加油：永久速度+2，防御-100（直接改基础数值）
        new Skill('加油', 100, 200, 400, 1, 4, [
            { type: 'def', value: -100, duration: 'permanent' },
            { type: 'speed', value: 2, duration: 'permanent' }
        ]),
        // 刹车：永久速度-4，防御+200（直接改基础数值）
        new Skill('刹车', 100, 300, 200, 1, 2, [
            { type: 'def', value: 200, duration: 'permanent' },
            { type: 'speed', value: -4, duration: 'permanent' }
        ]),
        // 开创：与目标每有一点速度差，每硬币加成伤害+200
        new Skill('开创', 500, 400, 400, 1, 3, null, { type: 'speedDiff', bonus: 200 })
    ];
    const char = new Character('开车警察', 4000, 400, [3,7], 500, 200, skills, team, position);
    if (initialSP !== null) char.sp = initialSP;
    // AI 循环：两次加油 → 一次开创 → 一次刹车
    char.aiCycle = ['加油', '加油', '开创', '刹车'];
    return char;
}

// ==================== 训练木偶（教程关专用） ====================
// 两个技能分别演示「普通防御减免」与「破防（无视防御）」两种机制
function createTrainingDummy(team, position) {
    const skills = [
        // 普通示范：无 special，正常走防御减免（玩家模板一防御200，该技能伤害会被减到 0/格挡）
        new Skill('普通示范', 100, 100, 200, 1, 2),
        // 破防示范：ignoreDef 9999 → target.def 临时归 0，无视全部防御直接命中
        new Skill('破防示范', 200, 100, 200, 1, 2, null, { type: 'ignoreDef', value: 9999 })
    ];
    const char = new Character('训练木偶', 4000, 0, [1,1], 500, 200, skills, team, position);
    // AI 循环：固定交替，保证玩家两回合分别看到「被防御减免」「被破防无视」
    // HP 4000：模板一/三的最大一击(1600/1700)打不死，保证至少撑到第二回合的「破防示范」演示
    char.aiCycle = ['普通示范', '破防示范'];
    return char;
}

// ==================== 灼华（燃烧 dot 手，玩家可用角色） ====================
function createZhuoHua(team, position) {
    const skills = [
        new Skill('燃木', 250, 150, 150, 2, 3, null, { type: 'burn', stacks: 2 }),
        new Skill('煽风', 500, 200, 200, 3, 4, null, { type: 'burnUp', levels: 2 }),
        new Skill('引爆', 800, 300, 150, 1, 5, null, { type: 'detonate', ratio: 2 })
    ];
    const char = new Character('灼华', 1800, 150, [3,6], 1500, 300, skills, team, position);
    char.directReduce = 20;   // 黎明级后天能力者：直伤减伤20%

    // ——— 被动·添薪：技能命中已带「燃烧」的目标 → 层数+1（补燃料延长 dot） ———
    char.registerPassive('onSkillHit', (self, bs, actor, target, coins, log) => {
        if (self !== actor) return;
        if (target.alive && target.getBuffStack('burn') > 0) {
            target.addBuffStack('burn', 1, 1);
            log(`  🧨 ${self.name} 添薪：${target.name}「燃烧」层数+1`);
        }
    });

    // ——— 被动·风助火势：回合结束时，带「燃烧」的敌方单位「燃烧」等级+1（全场滚雪球） ———
    char.registerPassive('onTurnEnd', (self, bs, log) => {
        let n = 0;
        bs.allCharacters.forEach(c => {
            if (c.alive && c.team !== self.team && c.getBuffStack('burn') > 0) {
                c.addBuffLevel('burn', 1);
                n++;
            }
        });
        if (n > 0) log(`  🌬️ 风助火势：${n} 名敌方单位「燃烧」等级+1`);
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
    if (roleName === '模板二') return createTemplateTwo(team, position);
    if (roleName === '模板三') return createTemplateThree(team, position);
    if (roleName === '鲁盼旋') return createLuPanxuan(team, position);
    if (roleName === '纸糊稻草人') return createScarecrowPaper(team, position);
    if (roleName === '铁皮稻草人') return createScarecrowIron(team, position);
    if (roleName === '标准稻草人') return createScarecrowStandard(team, position);
    if (roleName === '灵敏稻草人') return createScarecrowFast(team, position);
    if (roleName === '再生稻草人') return createScarecrowRegen(team, position);
    if (roleName === '持盾警察') return createPolice(team, position);
    if (roleName === '持棍警察') return createStickPolice(team, position);
    if (roleName === '持枪警察') return createGunPolice(team, position);
    if (roleName === '开车警察') return createDrivingPolice(team, position);
    if (roleName === '李雅礼') return createLiYali(team, position);
    if (roleName === '云长郡') return createYunChangjun(team, position);
    if (roleName === '训练木偶') return createTrainingDummy(team, position);
    if (roleName === '灼华') return createZhuoHua(team, position);
    return null;
}
