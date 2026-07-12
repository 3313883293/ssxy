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
        this.passives = [];           // [{ trigger, callback }]
    }

    // —————— 防御 ——————
    getTotalDef() {
        let total = this.def;
        this.buffs.forEach(b => {
            if (b.type === 'def') total += b.value;
            if (b.type === 'rage') total -= Math.floor(b.stack / 2) * 50;
        });
        return total;
    }

    // 普通伤害（吃防御）
    takeDamage(dmg, attacker) {
        if (!this.alive) return 0;
        const totalDef = this.getTotalDef();
        const actual = Math.max(0, dmg - totalDef);
        this.hp = Math.max(0, this.hp - actual);
        if (this.hp <= 0) {
            this.alive = false;
            this.hp = 0;
            if (typeof battleState !== 'undefined' && battleState) {
                battleState.repositionAll();
            }
        }
        this.buffs = this.buffs.filter(b => b.duration !== 'nextHit');
        return actual;
    }

    // 真实伤害（无视防御）
    takeTrueDamage(dmg) {
        if (!this.alive) return 0;
        this.hp = Math.max(0, this.hp - dmg);
        if (this.hp <= 0) {
            this.alive = false;
            this.hp = 0;
            if (typeof battleState !== 'undefined' && battleState) {
                battleState.repositionAll();
            }
        }
        return dmg;
    }

    regenSP() {
        if (!this.alive) return;
        this.sp = Math.min(this.maxSP, this.sp + this.spRegen);
        this.actedThisTurn = false;
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
