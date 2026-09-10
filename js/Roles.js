// Roles.js - 所有角色创建函数
// v0.689 职责边界：**角色专属的一切**（情感规格 / 被动 / 机制标记 / 角色自带钩子 / 机制注册）
// 都收敛在本文件，核心文件（Characters / SkillSystem / battleFlow / globals）不含角色名判定。

// ==================== v0.689 角色专属情感规格注册 ====================
// Characters.js 注册通用规格 normal；以下三套为角色专属，由本文件注册，再由 applyEmotionSpec 装到实例上。
// 规格语义见 Characters.js 顶部注释。
EMOTION_SPECS.anger = {
    key: 'anger', displayName: '愤怒', special: true, cap: 5,
    damageBonus: lv => Math.floor(lv / 2) * 100,   // 每 2 级基础伤害 +100（Lv2/4 = +100/200，Lv5 仍 +200）
    spBonus: () => 0,                              // 不回复算力
    defPenalty: lv => Math.floor(lv / 2) * 50,     // 每 2 级防御 -50
    reduction: null,
    tierLogs: (c, before, after) => {
        const parts = [];
        if (before < 2 && after >= 2) parts.push('基础伤害 +100，防御 -50');
        if (before < 4 && after >= 4) parts.push('基础伤害 +200，防御 -100');
        return parts;
    },
    effectLine: c => `基础伤害 +${c.getEmotionDamageBonus()} ｜ 防御 -${Math.floor(c.emotionLevel / 2) * 50}`
};
EMOTION_SPECS.hate = {
    key: 'hate', displayName: '怨恨', special: true, cap: 10,
    damageBonus: lv => Math.floor(lv / 3) * 50,    // 每 3 级基础伤害 +50（Lv3/6/9 = +50/100/150）
    spBonus: () => 0,                              // 不回复算力
    defPenalty: lv => Math.floor(lv / 3) * 50,     // 每 3 级防御 -50
    reduction: lv => 100 - lv * 15,                // 减伤曲线：跌破 0% 转受击加伤
    tierLogs: (c, before, after) => {
        const parts = [];
        if (before < 3 && after >= 3) parts.push('基础伤害 +50，防御 -50');
        if (before < 6 && after >= 6) parts.push('基础伤害 +100，防御 -100');
        if (before < 9 && after >= 9) parts.push('基础伤害 +150，防御 -150');
        if (before < 7 && after >= 7) parts.push('减伤跌破 0%，转为受击加伤');
        return parts;
    },
    effectLine: c => {
        const r = 100 - c.emotionLevel * 15;
        const reducText = r >= 0 ? `亡灵怨恨减伤 ${r}%` : `减伤跌破 0%，转受击加伤 ${-r}%`;
        const tier = Math.floor(c.emotionLevel / 3) * 50;
        return tier > 0 ? `${reducText} ｜ 基础伤害 +${tier} ｜ 防御 -${tier}` : reducText;
    }
};
EMOTION_SPECS.jade = {
    key: 'jade', displayName: '厌倦', special: true, cap: 5,
    damageBonus: lv => lv * 50,                    // 每级基础伤害 +50（覆盖式累计）
    spBonus: () => 0,                              // 不回复算力
    defPenalty: () => 0,                           // 无防御副作用
    reduction: null,
    tierLogs: (c, before, after) => (after === 5 && before < 5) ? ['基础伤害 +250（厌倦满级，投正率 -25%）'] : [],
    effectLine: c => `基础伤害 +${c.emotionLevel * 50} ｜ 自身投正率 -${c.emotionLevel * 5}%`,
    // 硬币投正钩子：每投出一个正面 +1 级；【精准狙击】投正时额外 +1 级
    onCoinHeads: (c, heads, skill) => {
        c.gainEmotion(heads);
        if (skill.special && skill.special.type === 'jadeBonus') c.gainEmotion(1);
    }
};

// 给角色装上情感规格，同时维护三个对外兼容字段（specialEmotion / specialEmotionType / emotionDisplayName）
function applyEmotionSpec(char, key) {
    const spec = EMOTION_SPECS[key] || EMOTION_SPECS.normal;
    char.emotionSpec = spec;
    char.specialEmotion = spec.special;
    char.specialEmotionType = spec.key === 'normal' ? '' : spec.key;
    char.emotionDisplayName = spec.displayName;
    return char;
}

// ==================== v0.689 伤害转移机制注册（王庄明「守护」） ====================
// 通用伤害转移注册表在 Characters.js（静态方法）；核心 takeDamage / takeTrueDamage 只询问注册表，
// 不含任何角色名判定；「守护」这一具体机制在这里注册。
Character.registerDamageTransfer(function guardTransfer(target, dmg) {
    if (typeof battleState === 'undefined' || !battleState) return false;
    if (target.getBuffStack('guard') > 0) return false;   // 守护者本人不保护自己
    const guarder = battleState.allCharacters.find(c =>
        c.alive && c !== target && c.team === target.team && c.getBuffStack('guard') > 0
    );
    if (!guarder) return false;
    guarder.reduceBuffStack('guard', 1);
    if (typeof log === 'function') log(`🛡️ ${guarder.name} 的「守护」抵挡了${target.name}的伤害（剩余${guarder.getBuffStack('guard')}层）`);
    // 虚拟技能结算：无动画配置 / 无卡片 → executeSkill 内部各环节空安全跳过；
    // 无来源虚拟攻击者不入队：伤害统计与情感归属落在守护者与虚拟体上，原攻击者 damageDealt 不受影响
    const virt = Character.createPhantom(`${guarder.name}的守护`, guarder.team, guarder.position);
    const virtSkill = new Skill('守护转移', 0, dmg, 0, 1, 99);
    if (typeof SkillSystem !== 'undefined' && typeof SkillSystem.executeSkill === 'function') {
        SkillSystem.executeSkill(virt, virtSkill, [guarder], battleState, allCharsDiv, log);
    } else {
        guarder.takeDamage(dmg, null);   // 兜底：SkillSystem 未就绪时直接扣血
    }
    return true;   // 队友本次不掉血
});

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
    char.evilDefIgnore = true;   // v0.683 固有机制标记：伤害结算时目标每层「恶」额外无视 50 防御（原 SkillSystem 按名字特判）
    applyEmotionSpec(char, 'anger');   // v0.689 情感规格：愤怒（cap 5、每 2 级伤害 +100 / 防御 -50、不回蓝、接管通用四触发）
    // ——— 被动零：惩恶之火 — 本阵营角色受伤时伤害来源获得 1 层【恶】（v0.309 按敌我阵营区分） ———
    char.registerPassive('onDamageDealt', (self, bs, attacker, target, actual, log) => {
        if (actual > 0 && target.team === self.team) {
            attacker.addBuffStack('e', 1, 1);
            log(`  🔥 ${attacker.name} 获得 1 层「恶」`);
        }
    });

    // ——— 被动一：无行动回合结束回复 200 算力（v0.689 改用通用被动模板，与王庄明共用同一份实现） ———
    PASSIVE_TEMPLATES.idleSpRegen(char, 200);

    // ——— 被动二（v0.62 特殊情感激荡①）：回合结束，获得等同于场上「恶」总层数的情感激荡等级（替代原「恶→愤怒」） ———
    char.registerPassive('onTurnEnd', (self, bs, log) => {
        let totalEvil = 0;
        bs.allCharacters.forEach(c => { if (c.alive) totalEvil += c.getBuffStack('e'); });
        if (totalEvil > 0) {
            self.gainEmotion(totalEvil);   // 情感激荡等级+恶层数（上限8级，跨2/4/6/8档位由 gainEmotion 打提示）
            log(`💢 ${self.name}（位置${self.position}）从场上 ${totalEvil} 层「恶」获得 ${totalEvil} 级「${self.emotionDisplayName}」`);
        }
    });

    // ——— 被动三（v0.62 特殊情感激荡②）：本阵营角色死亡获得 3 级情感激荡（v0.309 按敌我阵营区分，替代原「+3愤怒」） ———
    char.registerPassive('onAllyDeath', (self, bs, deadChar, log) => {
        if (deadChar.team === self.team && self !== deadChar) {
            self.gainEmotion(3);
            log(`  💢 ${self.name}（位置${self.position}）友方阵亡，${self.emotionDisplayName} +3 级`);
        }
    });

    // ——— 被动四：技能命中后施加燃烧（分配硬币数级） ———
    //          若目标燃烧 ≤3 层，消耗 1 级情感激荡额外施加 1 层燃烧（v0.62 替代原「消耗1层愤怒」）
    char.registerPassive('onSkillHit', (self, bs, actor, target, coins, log) => {
        if (self !== actor) return;  // 仅技能施放者自己触发
        if (target.alive) {
            target.addBuffLevel('burn', coins);
            log(`  🔥 ${target.name} 获得 ${coins} 级「燃烧」`);
            if (target.getBuffStack('burn') <= 3 && self.emotionLevel > 0) {
                self.emotionLevel = Math.max(0, self.emotionLevel - 1);   // 直接扣等级（不能 gainEmotion(-1)，其 before>=after 直接 return）
                target.addBuffStack('burn', 1, 1);
                log(`  🔥 消耗 1 级「${self.emotionDisplayName}」，${target.name} 额外获得 1 层「燃烧」`);
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
    char.hateReduction = true;   // 减伤持有者标记（减伤值由「怨恨」情感规格的 reduction 曲线驱动，回合开始快照）
    applyEmotionSpec(char, 'hate');   // v0.689 情感规格：怨恨（cap 10、每 3 级伤害 +50 / 防御 -50、接管通用四触发）
    char.specialStarTarget = true;   // v0.689 隐藏星目标标记：被 AI 操控的队友亲手击杀 → 发隐藏星
    // v0.689 召唤池随角色定义（原写在 battleFlow.startBattle 的关卡配置里）：2 持盾 / 2 持棍 / 4 持枪 / 2 开车
    char.summonPoolConfig = ['持盾警察', '持盾警察', '持棍警察', '持棍警察', '持枪警察', '持枪警察', '持枪警察', '持枪警察', '开车警察', '开车警察'];
    // ——— 怨恨触发：同阵营角色阵亡（含云长郡召唤的警察怨灵）→ 怨恨+1 级 ———
    char.registerPassive('onAllyDeath', (self, bs, deadChar, log) => {
        if (deadChar.team === self.team && self !== deadChar) {
            self.gainEmotion(1);
            log(`  💢 ${self.name}（位置${self.position}）同阵营${deadChar.name}阵亡，「${self.emotionDisplayName}」 +1 级`);
        }
    });
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
        // v0.689 witness 标记：使出本技能即记入 specialState.driverUsedOpen（原核心按「角色名+技能名」特判）
        new Skill('开创', 500, 400, 400, 1, 3, null, { type: 'speedDiff', bonus: 200, witness: 'driverUsedOpen' })
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
        if (n > 0) log(`  🌬️ 风助火势：${n} 名敌方单位「燃烧」等级 +1`);
    });

    return char;
}

// ==================== 张子曦（「混乱」dot 手，玩家可用角色，v0.6） ====================
// TODO(用户后补)：张子曦三技能设计 + 被动。当前仅搭「混乱」载体框架，面板数值为 DoT 手基准待调。
function createZhangZiXi(team, position) {
    const skills = [
        new Skill('待定·技能一', 250, 100, 100, 1, 3),   // TODO(用户后补)：张子曦技能一设计
        new Skill('待定·技能二', 500, 150, 150, 2, 4),   // TODO(用户后补)：张子曦技能二设计
        new Skill('待定·技能三', 800, 200, 200, 3, 5)    // TODO(用户后补)：张子曦技能三设计
    ];
    const char = new Character('张子曦', 1800, 150, [3,6], 1500, 300, skills, team, position);
    // TODO(用户后补)：张子曦被动（registerPassive）
    return char;
}

// ==================== 王庄明（守护者，玩家可用角色，v0.669） ====================
// 用户设计：守护之躯（按消耗算力折算减伤）+ 抵抗（自防）/纵焚烈火（自焚 AOE 燃烧）/
// 守护（替队友挡伤害的层数机制）。守护转移一切伤害（普通/真伤/dot），转移为无来源普通伤害（再结算防御/减伤）。
function createWangZhuangMing(team, position) {
    const skills = [
        new Skill('抵抗', 300, 200, 200, 1, 1, { type: 'def', value: 200, duration: 'nextHit' }),
        new Skill('纵焚烈火', 500, 400, 400, 2, 3, null, { type: 'burnLv', level: 4 }),
        new Skill('守护', 700, 800, 800, 1, 4, null, { type: 'guard' })
    ];
    const char = new Character('王庄明', 2000, 300, [2,5], 1000, 400, skills, team, position);
    // ——— 被动·黎明级先天能力者（同鲁盼旋）：未使用技能回合结束回复 200 算力（v0.689 通用被动模板） ———
    PASSIVE_TEMPLATES.idleSpRegen(char, 200);
    // ——— 被动·守护之躯：回合结束时按本回合消耗算力折算减伤（每 100 算力 10%，向下取整、无上限），
    //      覆盖式，持续到下回合结束（下回合结束时按新消耗重算；消耗为 0 则清除） ———
    char.registerPassive('onTurnEnd', (self, bs, log) => {
        const spent = self.spSpentThisTurn || 0;
        self.clearBuff('guardShield');
        const pct = Math.floor(spent / 100) * 10;
        if (pct > 0) {
            self.addBuff({ type: 'guardShield', value: pct, duration: 'nextTurn' });
            log(`🛡️ ${self.name} 守护之躯：本回合消耗 ${spent} 算力，获得 ${pct}% 减伤（持续到下回合结束）`);
        }
    });
    return char;
}

// ==================== 曹佳梦（概率赌徒，玩家可用角色，v0.673） ====================
// 用户设计：概率论的奇迹（队友投正率+10%/自身+25%）+ 厌倦（特殊情感激荡：硬币投正升级、
// 每级基础伤害+50、自身投正率-5%/级、≥4级回合开始创大运吧→陨星落下、使用【陨星落下】后厌倦归零）。
// 陨星（强化三）：对全场所有单位（含自己与队友）造成伤害，每距离主要目标 1 使总伤害下降 25%（≥4 为 0）。
function createCaoJiaMeng(team, position) {
    const skills = [
        new Skill('手枪散射', 300, 200, 300, 3, 3),
        new Skill('精准狙击', 400, 400, 1200, 1, 6, null, { type: 'jadeBonus' }),   // 投正时额外 +1 级厌倦
        new Skill('创大运吧', 500, 200, 400, 1, 9, null, { type: 'jadeBurst' })     // 每级厌倦基础+250/加成+200
    ];
    const char = new Character('曹佳梦', 1800, 100, [3,6], 500, 500, skills, team, position);
    char.directReduce = 20;   // 黎明级书生学院校服：直伤减伤 20%（同灼华）
    applyEmotionSpec(char, 'jade');   // v0.689 情感规格：厌倦（cap 5、每级伤害 +50、自身投正率 -5%/级、只由硬币投正升级）
    // v0.689 光环声明（隐藏 buff「coinLuck」= 投正率加成）：由 SkillSystem.refreshAuras 通用聚合，
    // 核心不再含「曹佳梦」名字与 +25% / −5%每级 / +10% 硬编码数值。
    // 刷新时机：回合开始 / 曹佳梦阵亡 / 读档后（攻击内投正率恒定——厌倦升级与归零不触发刷新）。
    char.aura = {
        buffType: 'coinLuck',
        label: '概率论的奇迹',
        selfBonus: self => 0.25 - self.emotionLevel * 0.05,   // 自身 +25% − 自己的厌倦×5%（取回合开始级）
        allyBonus: 0.10                                        // 每个同阵营单位 +10%（多个曹佳梦叠加）
    };
    // v0.689 技能形态同步钩子（原 battleFlow.syncCaoJiaMengSkill 按角色名特判，现由角色自带；
    // 由 battleFlow.syncAllSkillForms 在回合开始与读档后统一调用）：
    // 厌倦 ≥4 级 →【创大运吧】替换为【陨星落下】；<4 级（如使用陨星后归零）→ 恢复【创大运吧】（可逆替换）
    char.syncSkills = (self, logFn) => {
        if (!self.alive) return;
        const idx = self.skills.findIndex(s => s.name === '创大运吧' || s.name === '陨星落下');
        if (idx < 0) return;
        const wantMeteor = self.emotionLevel >= 4;
        const isMeteor = self.skills[idx].name === '陨星落下';
        if (wantMeteor && !isMeteor) {
            self.skills[idx] = new Skill('陨星落下', 500, 1250, 1000, 1, 9, null, { type: 'meteor' });
            if (typeof logFn === 'function') logFn(`🔄 ${self.name} 厌倦达到 ${self.emotionLevel} 级，【创大运吧】替换为【陨星落下】！`);
        } else if (!wantMeteor && isMeteor) {
            self.skills[idx] = new Skill('创大运吧', 500, 200, 400, 1, 9, null, { type: 'jadeBurst' });
            if (typeof logFn === 'function') logFn(`🔄 ${self.name} 厌倦降至 ${self.emotionLevel} 级，【陨星落下】恢复为【创大运吧】！`);
        }
    };
    return char;
}

// ==================== 多能战警（v0.684，张子曦篇第一关敌方 ×3） ====================
// 用户设计：装备切换（回合开始按同阵营多能战警间位置排位换装备+换技能）+ 战术撤退（血量≤40%退待命区末端，
// 补位入场后获得休整3回合）+ 创伤（被攻击投币时按硬币数触发真伤反噬）+ 被制服（速度-2、回合结束层数-1）
// 交叉火力：连携技——与至多2名多能战警连携（每名消耗200算力），射程内全体敌方自动选中；
// 防爆装参与：对被制服目标+200伤害并对全体施加3层Lv3混乱；步枪装参与：基础+200并对全体施加2层Lv2燃烧；
// 狙击装参与：加成+400并对全体施加3层Lv3创伤。
// v0.689 装备配置表（随角色定义；原在 battleFlow.js 顶部）
const DUONENG_GEAR_CFG = {
    riot:  { skill: '近身制服', def: 300, speed: 0 },
    rifle: { skill: '中距点射', def: 100, speed: 1 },
    snipe: { skill: '远程狙击', def: 0,   speed: 3 }
};

function createDuoNengZhanJing(team, position) {
    const skills = [
        new Skill('近身制服', 0, 400, 200, 1, 2, null, { type: 'subdue', stacks: 2, pick: 'noSubdued' }),   // 优先未被制服
        new Skill('中距点射', 0, 200, 200, 3, 4, null, { type: 'rifleBurn', pick: 'lowestDef' }),            // 优先防御最低
        new Skill('远程狙击', 0, 100, 800, 1, 6, null, { type: 'snipeTrauma', stacks: 2, pick: 'lowestHp' }), // 优先血量最低
        new Skill('交叉火力', 400, 600, 300, 3, 5, null, { type: 'crossfire' })   // 连携技（施放者400 + 每名连携者200）
    ];
    const char = new Character('多能战警', 2500, 200, [1,4], 400, 100, skills, team, position);
    char.sp = 0;   // v0.686 初始算力 0：开场无法施放【交叉火力】（400），靠回合结束 100/回合 攒算力（约第 4 回合末起可用）
    char.duoNengGear = true;   // 装备切换标记：回合开始按站位同步装备与技能（v0.684）
    char.gear = '';            // 当前装备：'riot'防爆装 / 'rifle'步枪装 / 'snipe'狙击装（''=尚未同步）
    char.retreatUsed = false;  // v0.688 战术撤退一局仅触发一次（随存档序列化）
    char._gearSkills = { riot: skills[0], rifle: skills[1], snipe: skills[2], crossfire: skills[3] };   // v0.684 换装技能池
    // v0.689 装备同步钩子（原 battleFlow.syncDuoNengGear / duoNengTargetGear 按标记 + 全阵营排位实现）：
    // 回合开始 / 读档后按同阵营多能战警的排位换装，换装同时切换技能[0]；【交叉火力】恒为技能[1]。
    // 排位方向按阵营取：我方在左（位置大 = 靠前）、敌方在右（位置小 = 靠前）。
    // 1 = 防爆装 / 2 = 步枪装 / 其余 = 狙击装；直接改基础数值并回退旧装备加成（同开车警察加油/刹车模式）。
    char.syncGear = (logFn) => {
        if (!char.alive || char.pendingEntry) return;
        const mates = battleState.allCharacters.filter(x =>
            x.alive && x.team === char.team && x !== char && x.duoNengGear && !x.pendingEntry
        );
        const frontCount = char.team === 'player'
            ? mates.filter(x => x.position > char.position).length   // 我方：位置大 = 靠前
            : mates.filter(x => x.position < char.position).length;  // 敌方：位置小 = 靠前
        const rank = frontCount + 1;
        const target = rank === 1 ? 'riot' : rank === 2 ? 'rifle' : 'snipe';
        if (target === char.gear) return;
        if (char.gear && DUONENG_GEAR_CFG[char.gear]) {   // 回退旧装备加成
            const old = DUONENG_GEAR_CFG[char.gear];
            char.def -= old.def;
            char.speedMin = Math.max(1, char.speedMin - old.speed);
        }
        char.gear = target;
        const cfg = DUONENG_GEAR_CFG[target];
        char.def += cfg.def;
        char.speedMin = Math.max(1, char.speedMin + cfg.speed);
        if (cfg.speed > 0) char.rerollSpeed();   // 速度下限变化后重掷实际速度（同开车警察）
        // 换技能：装备技能 + 交叉火力
        if (char._gearSkills && char._gearSkills[target]) {
            char.skills = [char._gearSkills[target], char._gearSkills.crossfire];
        }
        if (typeof logFn === 'function') {
            const name = target === 'riot' ? '防爆装' : target === 'rifle' ? '步枪装' : '狙击装';
            logFn(`🔁 ${char.name}（位置${char.position}）装备切换：${name}（防御 ${char.def}、速度 ${char.speedMin}~${char.speedMax}）→ 使用【${cfg.skill}】`);
        }
    };
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
            log(`🌿 ${self.name}（位置${self.position}）再生恢复${heal}血量（血量：${self.hp}/${self.maxHp}）`);
        }
    });
    return char;
}

// ==================== 烬火教团（v0.5 灼华篇敌方；v0.690 数值上调） ====================
// 主题：崇拜火焰的教团——焚香给队友挂燃烧、烛央薪火不息吸燃烧成狂炎而变强。
// 玩家用灼华烧教团既爽也喂火了 Boss：每层狂炎使烛央伤害+150、防御-20（双刃剑）。
// v0.690：灼华篇三关难度整体上调（血量/防御/伤害/算力回复），使其略高于鲁盼旋篇（数值实测见
//   开发工具/pwgame/diag-zh-balance.js：AI 对 AI 逐关模拟胜率/回合/残血）。
//   ①烬火信徒 1700→2600 血、防御 100→120、算力 300+100→340+130、
//     火球术 150+150×2→230+220×2、火刃 250 算力 200+200→200 算力 300+260
//     （原火刃与火球术同为 250 算力且排序在后 → AI 恒选火球术，火刃是死技能；改低消耗后可交替使用）；
//   ②焦木傀儡 3200→4500 血、防御 250→260、算力 300+80→340+110、重锤 300+200→500+320、
//     木甲 100 算力/+300 防 → 250 算力/+200 防（原消耗低于算力回复 → 被无视时逐回合叠甲、防御无限膨胀，
//     我方 AI 算不出正期望后集体跳过形成僵局（旧版 L6 约 18% 对局打不完）；抬高消耗 + 降低单次叠甲后消除）；
//   ③引火学徒 1500→2300 血、防御 80→120、算力 350+120→380+150、燎原 120+120×2→200+190×2、引火 100+100→180+160；
//   ④焚香祭司 2400→3600 血、防御 150→190、算力 500+150→520+170、祭火 250+250×2→400+340×2；
//   ⑤烛央 7000→7600 血、防御 180→190、算力回复 400→420、烈焰鞭 400+400→470+470、焚天祭 150+150×3→190+190×3
//     （狂炎每层 +150 伤害不变）。
// 同步点：charSelect.getRoleDefRange 的防御表须与本文件一致（防御有变动）。

function createAshCultist(team, position) {
    const skills = [
        new Skill('火球术', 250, 230, 220, 2, 3, null, { type: 'burn', stacks: 2 }),
        new Skill('火刃', 200, 300, 260, 1, 2)
    ];
    return new Character('烬火信徒', 2600, 120, [2,5], 340, 130, skills, team, position);
}

function createCharredGolem(team, position) {
    const skills = [
        new Skill('木甲', 250, 0, 0, 0, 1, { type: 'def', value: 200, duration: 'nextHit' }),
        new Skill('重锤', 300, 500, 320, 1, 2)
    ];
    const char = new Character('焦木傀儡', 4500, 260, [1,3], 340, 110, skills, team, position);
    char.burnMultiplier = 1.5;   // 易燃：受到的燃烧 dot 伤害 ×1.5
    return char;
}

function createFirestarter(team, position) {
    const skills = [
        new Skill('燎原', 250, 200, 190, 2, 3),
        new Skill('引火', 200, 180, 160, 1, 4, null, { type: 'burn', stacks: 1 })
    ];
    return new Character('引火学徒', 2300, 120, [4,8], 380, 150, skills, team, position);
}

function createIncensePriest(team, position) {
    const skills = [
        new Skill('焚香', 250, 0, 0, 0, 99, null, { type: 'incense' }),
        new Skill('祭火', 400, 400, 340, 2, 4, null, { type: 'burn', stacks: 1 })
    ];
    const char = new Character('焚香祭司', 3600, 190, [2,4], 520, 170, skills, team, position);
    char.aiCycle = ['焚香', '祭火', '焚香', '祭火'];
    return char;
}

function createZhuYang(team, position) {
    const skills = [
        new Skill('烈焰鞭', 300, 470, 470, 1, 3),
        new Skill('焚天祭', 500, 190, 190, 3, 4, null, { type: 'burn', stacks: 1 }),
        new Skill('火灵召唤', 350, 0, 0, 0, 99, null, { type: 'summon', role: '烬火信徒' })
    ];
    const char = new Character('焚天祭司·烛央', 7600, 190, [3,6], 800, 420, skills, team, position);
    char.frenzyBuff = true;   // 狂炎持有者：死亡时焚尽薪火（Characters.handleDeath）
    char.aiCycle = ['焚天祭', '烈焰鞭', '焚天祭', '火灵召唤', '烈焰鞭'];
    // ——— 薪火不息：回合结束时把场上全体「燃烧」等级之和 → 自身「狂炎」层数（双刃剑核心） ———
    char.registerPassive('onTurnEnd', (self, bs, log) => {
        const sum = bs.allCharacters.filter(c => c.alive).reduce((s, c) => s + c.getBuffLevel('burn'), 0);
        if (sum > 0) {
            self.addBuffStack('frenzy', sum);
            log(`  🔥 ${self.name} 薪火不息：吸收场上${sum}级「燃烧」→「狂炎」${self.getBuffStack('frenzy')}层`);
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
    if (roleName === '张子曦') return createZhangZiXi(team, position);
    if (roleName === '王庄明') return createWangZhuangMing(team, position);   // v0.669
    if (roleName === '曹佳梦') return createCaoJiaMeng(team, position);   // v0.673
    if (roleName === '多能战警') return createDuoNengZhanJing(team, position);   // v0.684
    if (roleName === '烬火信徒') return createAshCultist(team, position);
    if (roleName === '焦木傀儡') return createCharredGolem(team, position);
    if (roleName === '引火学徒') return createFirestarter(team, position);
    if (roleName === '焚香祭司') return createIncensePriest(team, position);
    if (roleName === '焚天祭司·烛央') return createZhuYang(team, position);
    return null;
}
