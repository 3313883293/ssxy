// Characters.js - 角色类定义
let globalId = 0;

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
        this.specialEmotionType = '';   // v0.66 特殊情感激荡类型：'anger'（鲁盼旋愤怒）| 'hate'（云长郡怨恨）| ''（普通情感激荡）；区分 cap/效果/副作用
    }

    // —————— 亡灵怨恨减伤快照：每回合开始判定（100% - 累计阵亡数×15%，可为负，负值转为受到伤害加成） ——————
    getHateReduction() {
        return this.hateReduction ? this.hateReductionCurrent : 0;
    }

    updateHateReduction() {
        if (!this.hateReduction) return;
        if (this.specialEmotionType === 'hate') {
            // v0.66 云长郡「怨恨」：减伤 = 100 − 怨恨等级×15（上限10级），跌破0%转受击加伤（「负转加伤」融合进怨恨）
            this.hateReductionCurrent = 100 - this.emotionLevel * 15;
        } else {
            const deaths = (typeof battleState !== 'undefined' && battleState) ? battleState.totalDeaths : 0;
            this.hateReductionCurrent = 100 - deaths * 15;
        }
    }

    // 每回合重随机实际速度（在最小~最大速度区间内）：最小速度是加油/刹车改变的核心属性，
    // 实际速度只决定本回合行动顺序，开创伤害按最小速度算（确定性）
    rerollSpeed() {
        this.speed = Math.floor(Math.random() * (this.speedMax - this.speedMin + 1)) + this.speedMin;
    }

    // —————— 防御 ——————
    getTotalDef() {
        let total = this.def;
        this.buffs.forEach(b => {
            if (b.type === 'def') total += b.value;
            if (b.type === 'frenzy') total -= b.stack * 20;   // 狂炎：每层防御-20（v0.5 烛央）
        });
        // v0.62 鲁盼旋「愤怒」副作用：每2级防御-50；v0.661 云长郡「怨恨」副作用：每3级防御-50（无条件生效，不依赖 buff 存在）
        if (this.specialEmotionType === 'anger') total -= Math.floor(this.emotionLevel / 2) * 50;
        if (this.specialEmotionType === 'hate') total -= Math.floor(this.emotionLevel / 3) * 50;
        return total;
    }

    // v0.312：第四关 AI 鲁盼旋「誓死守护」——队友仍存活时锁血为 1，不会倒下
    // v0.5：灼华篇第三关锁槽灼华同规则（强制上场角色 = AI 操控 + 锁血，与鲁盼旋第四关一致）
    // v0.5 补：队友检测含待命区——出战队友全灭但待命区仍有存活队友时同样锁血（誓死守护延伸到候补队友）
    isImmortalWhileAlliesAlive() {
        if (typeof battleState === 'undefined' || !battleState) return false;
        const isLockedHero = (this.name === '鲁盼旋' && battleState.currentLevel === 3)
                          || (this.name === '灼华' && battleState.currentLevel === 6);
        if (!(isLockedHero && this.aiControlled)) return false;
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
        if (actual > 0 && Character.guardTransfer(this, actual) === 0) return 0;
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

    // v0.669 王庄明「守护」转移（静态）：同阵营存在存活且带「守护」层数的王庄明时，
    // 队友（守护者本人除外）即将失去血量 → 防止之，改为守护者自身受到"对应数值的无来源普通伤害"
    // （完整走防御/减伤结算），守护层数-1；一切伤害（普通/真伤/dot/混乱反噬）均转移；
    // v0.669 显示修正（用户指定）：转移伤害不再裸扣血，而是临时生成一个虚拟技能指向守护者，
    // 走完整技能结算——伤害数字/血条刷新/受击音效/死亡爆发全部正常显示；
    // 无来源 = 虚拟攻击者不入队（其 damageDealt 不计入任何结算统计、不触发击杀归属）；
    // 返回 0 表示本次伤害已被转移（受击方不掉血）；返回原值表示未转移
    static guardTransfer(target, dmg) {
        if (dmg <= 0 || !target.alive) return dmg;
        if (typeof battleState === 'undefined' || !battleState) return dmg;
        if (target.getBuffStack('guard') > 0) return dmg;   // 守护者本人不保护自己
        const guarder = battleState.allCharacters.find(c =>
            c.alive && c !== target && c.team === target.team && c.name === '王庄明' && c.getBuffStack('guard') > 0
        );
        if (!guarder) return dmg;
        guarder.reduceBuffStack('guard', 1);
        if (typeof log === 'function') log(`🛡️ ${guarder.name} 的「守护」抵挡了${target.name}的伤害（剩余${guarder.getBuffStack('guard')}层）`);
        // 虚拟技能结算：无动画配置/无卡片 → executeSkill 内部各环节空安全跳过；
        // 虚拟攻击者不入队：伤害统计/情感激荡归属全部落在守护者与虚拟体上，原攻击者 damageDealt 不受影响
        const virt = createRoleInstance('模板一', 'player', guarder.position);
        virt.name = `${guarder.name}的守护`;
        virt.sp = 0;
        const virtSkill = new Skill('守护转移', 0, dmg, 0, 1, 99);
        if (typeof SkillSystem !== 'undefined' && typeof SkillSystem.executeSkill === 'function') {
            SkillSystem.executeSkill(virt, virtSkill, [guarder], battleState, allCharsDiv, log);
        } else {
            guarder.takeDamage(dmg, null);   // 兜底：SkillSystem 未就绪时直接扣血
        }
        return 0;   // 队友本次不掉血
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
        }
    }

    // 真实伤害（无视防御与减伤，完全穿透）
    takeTrueDamage(dmg) {
        if (!this.alive) return 0;
        // v0.669 王庄明「守护」：真伤/dot/混乱反噬等一切掉血同样转移（用户指定）
        if (dmg > 0 && Character.guardTransfer(this, dmg) === 0) return 0;
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
        // v0.66 特殊情感激荡上限：鲁盼旋「愤怒」5 级、云长郡「怨恨」10 级（均用户指定）、普通情感激荡 8 级
        const cap = this.specialEmotion ? (this.specialEmotionType === 'hate' ? 10 : 5) : 8;
        this.emotionLevel = Math.min(cap, this.emotionLevel + n);
        if (before >= this.emotionLevel) return;
        const parts = [];
        if (this.specialEmotion) {
            if (this.specialEmotionType === 'hate') {
                // v0.66 云长郡「怨恨」：减伤连续每级-15%（跌破0% Lv7 起转受击加伤）；v0.661 每3级基础伤害+50/防御-50（覆盖式，上限10级只跨 3/6/9 档）
                if (before < 3 && this.emotionLevel >= 3) parts.push('基础伤害 +50，防御 -50');
                if (before < 6 && this.emotionLevel >= 6) parts.push('基础伤害 +100，防御 -100');
                if (before < 9 && this.emotionLevel >= 9) parts.push('基础伤害 +150，防御 -150');
                if (before < 7 && this.emotionLevel >= 7) parts.push('减伤跌破 0%，转为受击加伤');
            } else if (this.specialEmotionType === 'jade') {
                // v0.673 曹佳梦「厌倦」：每级基础伤害 +50（覆盖式累计），上限 5 级；满级提示
                if (this.emotionLevel === 5 && before < 5) parts.push('基础伤害 +250（厌倦满级，投正率 -25%）');
            } else {
                // v0.62 鲁盼旋「愤怒」：每2级基础伤害+100、防御-50（覆盖式），无算力回复档位；上限5级只跨 2/4 档
                if (before < 2 && this.emotionLevel >= 2) parts.push('基础伤害 +100，防御 -50');
                if (before < 4 && this.emotionLevel >= 4) parts.push('基础伤害 +200，防御 -100');
            }
        } else {
            const dmgBonus = this.getEmotionDamageBonus();
            const spBonus = this.getEmotionSpBonus();
            if (this.emotionLevel >= 2 && before < 2) parts.push(`基础伤害 +${dmgBonus}`);
            if (this.emotionLevel >= 4 && before < 4) parts.push(`算力回复 +${spBonus}`);
            if (this.emotionLevel === 6) parts.push('基础伤害加成提升至 +100');
            if (this.emotionLevel === 8) parts.push('算力回复加成提升至 +100');
        }
        if (parts.length > 0 && typeof log === 'function') {
            log(`${this.emotionDisplayName}：${this.name} 升至 Lv ${this.emotionLevel}（${parts.join('，')}）`);
        }
    }

    // 基础伤害加成（覆盖式）：普通角色达 2 级 +50、达 6 级 +100；鲁盼旋「愤怒」每2级 +100（Lv2/4=+100/200，Lv5 仍+200）；云长郡「怨恨」每3级 +50（v0.661 Lv3/6/9=+50/100/150，Lv10 仍+150）；曹佳梦「厌倦」每级 +50（v0.673）
    getEmotionDamageBonus() {
        if (this.specialEmotionType === 'anger') return Math.floor(this.emotionLevel / 2) * 100;
        if (this.specialEmotionType === 'hate') return Math.floor(this.emotionLevel / 3) * 50;
        if (this.specialEmotionType === 'jade') return this.emotionLevel * 50;
        if (this.specialEmotion) return 0;
        if (this.emotionLevel >= 6) return 100;
        if (this.emotionLevel >= 2) return 50;
        return 0;
    }

    // 算力回复加成（覆盖式）：普通角色达 4 级 +50、达 8 级 +100；特殊情感激荡（愤怒/怨恨/厌倦）均不回蓝
    getEmotionSpBonus() {
        if (this.specialEmotion) return 0;
        if (this.emotionLevel >= 8) return 100;
        if (this.emotionLevel >= 4) return 50;
        return 0;
    }

    // v0.66 情感效果一行文本（卡片弹窗/详情面板共用）：怨恨显示减伤/加伤曲线 + 每3级伤害/防御档位（v0.661），愤怒显示伤害+防御副作用，普通显示伤害+算力回复
    // v0.673 厌倦显示伤害 + 自身投正率下降
    getEmotionEffectLine() {
        if (this.specialEmotionType === 'hate') {
            const r = 100 - this.emotionLevel * 15;
            const reducText = r >= 0 ? `亡灵怨恨减伤 ${r}%` : `减伤跌破 0%，转受击加伤 ${-r}%`;
            const tier = Math.floor(this.emotionLevel / 3) * 50;
            return tier > 0 ? `${reducText} ｜ 基础伤害 +${tier} ｜ 防御 -${tier}` : reducText;
        }
        if (this.specialEmotionType === 'jade') {
            return `基础伤害 +${this.emotionLevel * 50} ｜ 自身投正率 -${this.emotionLevel * 5}%`;
        }
        if (this.specialEmotion) {
            return `基础伤害 +${this.getEmotionDamageBonus()} ｜ 防御 -${Math.floor(this.emotionLevel / 2) * 50}`;
        }
        return `基础伤害 +${this.getEmotionDamageBonus()} ｜ 算力回复 +${this.getEmotionSpBonus()}`;
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
