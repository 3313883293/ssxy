// Characters.js - 角色类定义
let globalId = 0;

// ==================== v0.689 情感规格（规格驱动） ====================
// 情感激荡的上限 / 伤害加成 / 算力回复加成 / 防御副作用 / 减伤曲线 / 档位日志 / 效果行 / 投正钩子，
// 全部收敛为「规格对象」。本文件只注册**通用规格 normal**；角色专属规格（愤怒 anger / 怨恨 hate /
// 厌倦 jade）由 Roles.js 在各角色工厂旁注册。核心结算只读 char.emotionSpec，
// **不再出现任何 specialEmotionType 字符串分支**（v0.689 前 anger/hate/jade 三套公式硬编码在本文件）。
// 规格字段：
//   key / displayName          标识与显示名
//   special                    是否「特殊情感激荡」（true = 完全接管通用四触发）
//   cap                        等级上限
//   damageBonus(lv)            基础伤害加成（覆盖式）
//   spBonus(lv)                算力回复加成（覆盖式）
//   defPenalty(lv)             防御副作用（覆盖式，返回正数表示扣减）
//   reduction(lv)              减伤曲线（null = 不使用；否则为受击减伤百分比快照，可为负 = 受击加伤）
//   tierLogs(char,before,after) 跨档位时的日志片段数组
//   effectLine(char)           卡面 / 弹窗的效果行
//   onCoinHeads(char,heads,skill)  硬币投正后的追加钩子（可选）
const EMOTION_SPECS = {
    normal: {
        key: 'normal',
        displayName: '情感激荡',
        special: false,
        cap: 8,
        damageBonus: lv => (lv >= 6 ? 100 : lv >= 2 ? 50 : 0),   // 达 2 级 +50、达 6 级 +100（覆盖式）
        spBonus: lv => (lv >= 8 ? 100 : lv >= 4 ? 50 : 0),       // 达 4 级 +50、达 8 级 +100（覆盖式）
        defPenalty: () => 0,
        reduction: null,
        tierLogs: (c, before, after) => {
            const parts = [];
            if (after >= 2 && before < 2) parts.push(`基础伤害 +${c.getEmotionDamageBonus()}`);
            if (after >= 4 && before < 4) parts.push(`算力回复 +${c.getEmotionSpBonus()}`);
            if (after === 6) parts.push('基础伤害加成提升至 +100');
            if (after === 8) parts.push('算力回复加成提升至 +100');
            return parts;
        },
        effectLine: c => `基础伤害 +${c.getEmotionDamageBonus()} ｜ 算力回复 +${c.getEmotionSpBonus()}`
    }
};

// ==================== v0.689 buff 类型通用表 ====================
// buff 类型 → 每层防御副作用（负值 = 扣防御）。新增「按层扣防御」类 buff 只需在此加一行。
const BUFF_DEF_PER_STACK = {
    frenzy: -20   // 狂炎（焚天祭司·烛央）：每层防御 -20
};

// ==================== v0.689 通用被动模板 ====================
// 供多个角色复用的标准被动，避免同一段逻辑在 Roles.js 里复制粘贴。
const PASSIVE_TEMPLATES = {
    // 未使用技能的回合结束时回复 amount 算力（鲁盼旋「黎明级先天能力者」/ 王庄明同款）
    idleSpRegen(char, amount) {
        char.registerPassive('onTurnEnd', (self, bs, log) => {
            if (self.actedThisTurn) return;
            const before = self.sp;
            self.sp = Math.min(self.maxSP, self.sp + amount);
            const gained = self.sp - before;
            if (gained > 0) log(`♻️ ${self.name}（位置${self.position}）未使用技能，回复 ${gained} 算力（算力：${self.sp}/${self.maxSP}）`);
        });
    }
};

class Character {
    constructor(name, hp, def, speedRange, maxSP, spRegen, skills, team, position) {
        this.id = globalId++;
        this.name = name;
        this.maxHp = hp;
        this.hp = hp;
        this.def = def;
        const [min, max] = speedRange;
        this.speed = Math.floor(Math.random() * (max - min + 1)) + min;
        this.speedMin = min;   // 速度区间下限（最小速度）：加油/刹车只改它，开创速度差按它计算（用户指定设计）
        this.speedMax = max;   // 速度区间上限：固定不变
        this.maxSP = maxSP;
        this.sp = maxSP;
        this.spRegen = spRegen;
        this.skills = skills;
        this.team = team;
        this.position = position;
        this.order = position;
        this.alive = true;
        this.cardElement = null;
        this.buffs = [];              // [{ type, value, stack, level, duration }]
        this.actedThisTurn = false;   // 本回合是否使用了技能
        this.spSpentThisTurn = 0;   // v0.669 王庄明「守护之躯」：本回合累计消耗算力（回合开始清零，executeSkill 累加）
        this.passives = [];           // [{ trigger, callback }]
        this.damageDealt = 0;
        this.damageReceived = 0;
        this.dotDamageMap = {};
        this.aiCycle = null;   // 敌方固定技能循环（如开车警察：加油×2→开创→刹车）
        this.aiIndex = 0;      // 循环进度
        this.defector = false;   // 死亡后倒戈加入玩家阵营（李雅礼）
        this.aiControlled = false; // 倒戈单位仍由 AI 操控，玩家不操作
        this.hateReduction = false; // 部下亡灵之怨恨：受击减伤100%，场上每阵亡1角色-10%（云长郡）
        this.hateReductionCurrent = 100; // 减伤快照（每回合开始判定，回合内死亡不即时生效）
        this.directReduce = 0;   // 直伤减伤（百分比）：黎明级后天能力者·直伤减伤20%（灼华）
        this.burnMultiplier = 1;   // 易燃（焦木傀儡 1.5）：受到的燃烧 dot 伤害倍率（v0.5）
        this.frenzyBuff = false;   // 狂炎持有者标记（焚天祭司·烛央）：死亡时焚尽薪火（v0.5）
        this.emotionLevel = 0;   // 情感激荡等级（v0.62）：0~8 级，受击/攻击/击杀/队友死亡各 +1；2/6 级基础伤害、4/8 级算力回复档位加成
        this.specialEmotion = false;   // 特殊情感激荡（v0.62 鲁盼旋）：触发/效果/副作用完全自定义，不受通用四触发影响
        this.emotionDisplayName = '情感激荡';   // 情感等级显示名（v0.62 鲁盼旋改「愤怒」：仍归属情感激荡机制，仅用户可见文本换名）
        this.specialEmotionType = '';   // 'anger'（鲁盼旋愤怒）| 'hate'（云长郡怨恨）| 'jade'（曹佳梦厌倦）| ''（普通情感激荡）
        this.emotionSpec = EMOTION_SPECS.normal;   // v0.689 情感规格对象（核心只读它，不含角色专属公式）
        this.syncSkills = null;   // v0.689 通用角色钩子：技能形态同步 syncSkills(char, logFn)，由工厂按需安装
        this.syncGear = null;     // v0.689 通用角色钩子：装备同步 syncGear(logFn)，由工厂按需安装
        this.summonPoolConfig = null;   // v0.689 通用角色钩子：召唤池配置（数组），由工厂按需安装
        this.aura = null;   // v0.689 通用角色钩子：隐藏 buff 光环声明 { buffType, label, selfBonus(self), allyBonus }
        this.specialStarTarget = false; // v0.689 隐藏星目标标记（被 AI 操控的队友击杀 → 发隐藏星）
    }

    // —————— 亡灵怨恨减伤快照：每回合开始判定（100% - 累计阵亡数×15%，可为负，负值转为受到伤害加成） ——————
    getHateReduction() {
        return this.hateReduction ? this.hateReductionCurrent : 0;
    }

    updateHateReduction() {
        if (!this.hateReduction) return;
        // v0.689 规格驱动：情感规格提供减伤曲线（如怨恨 100 − 等级×15，跌破 0% 转受击加伤）；
        // 无曲线的持有者退回「按累计阵亡数」的通用曲线
        const curve = this.emotionSpec && this.emotionSpec.reduction;
        if (curve) {
            this.hateReductionCurrent = curve(this.emotionLevel);
        } else {
            const deaths = (typeof battleState !== 'undefined' && battleState) ? battleState.totalDeaths : 0;
            this.hateReductionCurrent = 100 - deaths * 15;
        }
    }

    // 每回合重随机实际速度（在最小~最大速度区间内）：最小速度是加油/刹车改变的核心属性，
    // 实际速度只决定本回合行动顺序，开创伤害按最小速度算（确定性）
    // v0.689 修正：speedMin 可被永久提升到超过 speedMax（如开车警察连续【加油】），
    // 原式会算出低于 speedMin 的速度（区间反向，违反「speedMin = 速度下限」）；改以 speedMin 为硬下限。
    rerollSpeed() {
        const lo = this.speedMin;
        const hi = Math.max(lo, this.speedMax);
        this.speed = Math.floor(Math.random() * (hi - lo + 1)) + lo;
    }

    // v0.684 被制服：速度-2（总共，无论层数）；行动顺序排序/开创速度差/卡片显示均用本方法取生效速度
    getSpeed() {
        let s = this.speed;
        if (this.getBuffStack('subdued') > 0) s -= 2;
        return Math.max(1, s);
    }

    // —————— 防御 ——————
    getTotalDef() {
        let total = this.def;
        this.buffs.forEach(b => {
            if (b.type === 'def') total += b.value;
            // v0.689 表驱动：buff 类型的「每层防御副作用」集中声明，新增此类 buff 不必再改本方法
            const perStack = BUFF_DEF_PER_STACK[b.type];
            if (perStack) total += perStack * (b.stack || 0);
        });
        // v0.689 规格驱动：情感防御副作用统一由 emotionSpec.defPenalty 提供
        // （鲁盼旋「愤怒」每 2 级防御 -50 / 云长郡「怨恨」每 3 级防御 -50；无副作用的情感返回 0）
        total -= this.emotionSpec.defPenalty(this.emotionLevel);
        return total;
    }

    // v0.312：第四关 AI 鲁盼旋「誓死守护」——队友仍存活时锁血为 1，不会倒下
    // v0.5：灼华篇第三关锁槽灼华同规则（强制上场角色 = AI 操控 + 锁血，与鲁盼旋第四关一致）
    // v0.5 补：队友检测含待命区——出战队友全灭但待命区仍有存活队友时同样锁血（誓死守护延伸到候补队友）
    // v0.683：锁血资格改为工厂/开战标记 lockHp（startBattle 设锁槽时打标，随存档序列化），不再耦合「名字+关卡号」
    isImmortalWhileAlliesAlive() {
        if (typeof battleState === 'undefined' || !battleState) return false;
        if (!(this.lockHp && this.aiControlled)) return false;
        // 队友 = 出场（playerTeam，排除入场动画中 pendingEntry）+ 待命区（benchPlayer 存活未入场）
        const allies = battleState.playerTeam.concat(battleState.benchPlayer || []);
        return allies.some(c => c !== this && c.alive && !c.pendingEntry);
    }

    // 普通伤害（吃防御）
    takeDamage(dmg, attacker) {
        if (!this.alive) return 0;
        const totalDef = this.getTotalDef();
        let actual = Math.max(0, dmg - totalDef);
        // v0.669 王庄明「守护」：防御结算后、扣血前，若即将失去血量则尝试转移（队友掉血 0，不消耗本角色 nextHit buff/不触发受击）
        // v0.689：改问通用伤害转移注册表（守护等机制由角色自行注册；注意本分支提前返回，不消耗 nextHit buff）
        if (actual > 0 && Character.tryTransferDamage(this, actual)) return 0;
        let reduction = this.getHateReduction();
        // v0.669 王庄明「守护之躯」：减伤叠加（回合结束时按本回合消耗算力折算，持续到下回合结束）
        const guardShield = this.buffs.find(b => b.type === 'guardShield');
        if (guardShield) reduction += guardShield.value;
        if (reduction !== 0) actual = Math.floor(actual * (100 - reduction) / 100);   // 负值=加伤
        if (this.directReduce > 0) actual = Math.floor(actual * (100 - this.directReduce) / 100);   // 直伤减伤（灼华 20%）
        this.hp = Math.max(0, this.hp - actual);
        this.damageReceived += actual;
        if (attacker && attacker.alive) attacker.damageDealt += actual;
        if (actual > 0 && !this.specialEmotion) this.gainEmotion(1);   // v0.62 情感激荡：受击+1（仅实际扣血的攻击命中；格挡 0 伤害不计；鲁盼旋特殊情感不受通用触发）
        if (this.hp <= 0) {
            if (this.isImmortalWhileAlliesAlive()) {
                this.hp = 1;   // v0.312：队友仍奋战，鲁盼旋锁血
                if (typeof log === 'function') log(`🛡️ ${this.name} 誓死守护队友，锁血为 1！`);
            } else {
                this.alive = false;
                this.hp = 0;
            }
        }
        this.buffs = this.buffs.filter(b => b.duration !== 'nextHit');
        return actual;
    }

    // —————— v0.689 通用伤害转移机制注册表 ——————
    // 核心伤害管线（takeDamage / takeTrueDamage）在「扣血前」统一询问注册表：是否有机制要拦截这次掉血。
    // 核心只负责询问与短路，**不含任何角色专属判定**；具体机制（如王庄明「守护」）由角色在 Roles.js 注册。
    // 处理函数签名：(target, dmg) => true（已完全转移，受击方不掉血）/ false（未转移）
    static damageTransfers = [];
    static registerDamageTransfer(fn) {
        if (typeof fn === 'function' && !Character.damageTransfers.includes(fn)) Character.damageTransfers.push(fn);
    }
    static tryTransferDamage(target, dmg) {
        if (dmg <= 0 || !target.alive) return false;
        for (const fn of Character.damageTransfers) {
            if (fn(target, dmg)) return true;
        }
        return false;
    }

    // 无来源虚拟攻击者：不入队、不参与任何统计，仅用于让「转移伤害」走完整技能结算
    // （伤害数字 / 血条刷新 / 受击音效 / 死亡爆发正常显示）。v0.689 前借 createRoleInstance('模板一') 生成，
    // 属核心对具体角色工厂的硬依赖，现改为直接构造最小 Character。
    static createPhantom(name, team, position) {
        const p = new Character(name, 1, 0, [1, 1], 0, 0, [], team, position);
        p.sp = 0;
        return p;
    }

    // v0.669 兼容入口：返回 0 表示本次伤害已被转移，返回原值表示未转移（旧验证脚本仍在使用）
    static guardTransfer(target, dmg) {
        return Character.tryTransferDamage(target, dmg) ? 0 : dmg;
    }

    // 死亡处理：倒戈复活 → 待命区补位 + 站位重排
    handleDeath() {
        if (typeof battleState !== 'undefined' && battleState) {
            battleState.totalDeaths++;   // 阵亡计数（云长郡减伤计算）
            // v0.5：焚尽薪火（烛央）——死亡时把狂炎层数转成残余敌方的燃烧等级（临死纵火）
            if (this.frenzyBuff) {
                const fz = this.getBuffStack('frenzy');
                battleState.specialState.zhuYangFrenzyAtDeath = fz;   // 击败时狂炎层数快照（特殊胜利判定用）
                if (fz > 0) {
                    battleState.enemyTeam.forEach(e => {
                        if (e.alive && e !== this) e.addBuffLevel('burn', fz);
                    });
                    if (typeof log === 'function') log(`🔥 ${this.name} 焚尽薪火：${fz} 层狂炎转为残余敌方的「燃烧」等级！`);
                }
                this.clearBuff('frenzy');
            }
            if (this.defector && this.team === 'enemy') {
                battleState.defectToPlayer(this);   // 李雅礼：作为我方单位复活
            }
            battleState.queueBenchEntry(this.team);   // 待命补位（回合开始时入场，v0.287）
            battleState.repositionAll();
            // v0.682 概率论的奇迹：曹佳梦阵亡 → 队友立即失去其投正率加成（死亡瞬间刷新）
            if (typeof SkillSystem !== 'undefined' && SkillSystem.refreshCoinLuckBuffs) SkillSystem.refreshCoinLuckBuffs();
        }
    }

    // 真实伤害（无视防御与减伤，完全穿透）
    takeTrueDamage(dmg) {
        if (!this.alive) return 0;
        // v0.669 王庄明「守护」：真伤/dot/混乱反噬等一切掉血同样转移（用户指定）
        if (dmg > 0 && Character.tryTransferDamage(this, dmg)) return 0;
        this.hp = Math.max(0, this.hp - dmg);
        this.damageReceived += dmg;
        if (this.hp <= 0) {
            if (this.isImmortalWhileAlliesAlive()) {
                this.hp = 1;   // v0.312：队友仍奋战，鲁盼旋锁血
                if (typeof log === 'function') log(`🛡️ ${this.name} 誓死守护队友，锁血为 1！`);
            } else {
                this.alive = false;
                this.hp = 0;
            }
        }
        return dmg;
    }

    regenSP() {
        if (!this.alive) return;
        // v0.62 情感激荡：达 4 级算力回复+50、达 8 级+100（覆盖式）
        this.sp = Math.min(this.maxSP, this.sp + this.spRegen + this.getEmotionSpBonus());
        this.actedThisTurn = false;
    }

    // —————— 情感激荡（v0.62）：敌我通用底层机制 ——————
    // 提升等级（攻击/受击/击杀/队友死亡时调用）；普通封顶 8 级，鲁盼旋「愤怒」（特殊情感激荡）封顶 5 级（用户指定）；跨过档位时打日志
    gainEmotion(n) {
        const before = this.emotionLevel;
        // v0.689 规格驱动：等级上限与档位提示全部取自 emotionSpec
        // （普通 8 级 / 愤怒 5 级 / 怨恨 10 级 / 厌倦 5 级）
        this.emotionLevel = Math.min(this.emotionSpec.cap, this.emotionLevel + n);
        if (before >= this.emotionLevel) return;
        const parts = this.emotionSpec.tierLogs(this, before, this.emotionLevel);
        if (parts.length > 0 && typeof log === 'function') {
            log(`${this.emotionDisplayName}：${this.name} 升至 Lv ${this.emotionLevel}（${parts.join('，')}）`);
        }
    }

    // 基础伤害加成（覆盖式）：全部由 emotionSpec.damageBonus 提供
    // （普通 2/6 级 = +50/+100；愤怒每 2 级 +100；怨恨每 3 级 +50；厌倦每级 +50）
    getEmotionDamageBonus() {
        return this.emotionSpec.damageBonus(this.emotionLevel);
    }

    // 算力回复加成（覆盖式）：全部由 emotionSpec.spBonus 提供（特殊情感规格一律返回 0）
    getEmotionSpBonus() {
        return this.emotionSpec.spBonus(this.emotionLevel);
    }

    // v0.689 情感效果一行文本（卡片弹窗 / 详情面板共用）：全部由 emotionSpec.effectLine 提供
    getEmotionEffectLine() {
        return this.emotionSpec.effectLine(this);
    }

    // —————— Buff 操作 ——————
    // 旧版 addBuff（持盾警察用，按 value 正负号区分）
    addBuff(buff) {
        const signKey = buff.value >= 0 ? 'pos' : 'neg';
        const existing = this.buffs.find(b =>
            b.type === buff.type &&
            b.duration === buff.duration &&
            (b.value >= 0 ? 'pos' : 'neg') === signKey
        );
        if (existing) {
            existing.value += buff.value;
            existing.stack = (existing.stack || 1) + 1;
        } else {
            this.buffs.push({ ...buff, stack: 1, level: 1 });
        }
    }

    // 施加层数（恶/愤怒/燃烧）
    addBuffStack(type, stacks, initLevel) {
        const existing = this.buffs.find(b => b.type === type);
        if (existing) {
            existing.stack += stacks;
        } else {
            this.buffs.push({ type, stack: stacks, level: initLevel || 1, duration: null });
        }
    }

    // 施加级数（燃烧级数），若不存在则层数初始为 1
    addBuffLevel(type, levels) {
        const existing = this.buffs.find(b => b.type === type);
        if (existing) {
            existing.level += levels;
        } else {
            this.buffs.push({ type, stack: 1, level: levels, duration: null });
        }
    }

    reduceBuffStack(type, amount) {
        const existing = this.buffs.find(b => b.type === type);
        if (!existing) return;
        existing.stack -= amount;
        if (existing.stack <= 0) this.clearBuff(type);
    }

    getBuffStack(type) {
        const b = this.buffs.find(b => b.type === type);
        return b ? b.stack : 0;
    }

    getBuffLevel(type) {
        const b = this.buffs.find(b => b.type === type);
        return b ? b.level : 0;
    }

    clearBuff(type) {
        const idx = this.buffs.findIndex(b => b.type === type);
        if (idx >= 0) this.buffs.splice(idx, 1);
    }

    // —————— 被动系统 ——————
    registerPassive(trigger, callback) {
        this.passives.push({ trigger, callback });
    }

    // 静态方法：向场上所有存活角色广播时点事件
    static invokePassives(trigger, battleState, ...args) {
        battleState.allCharacters.forEach(c => {
            if (c.alive) {
                c.passives.forEach(p => {
                    if (p.trigger === trigger) p.callback(c, battleState, ...args);
                });
            }
        });
    }
}
