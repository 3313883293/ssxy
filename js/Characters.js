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
        this.buffs = [];
    }

    takeDamage(dmg) {
        if (!this.alive) return 0;
        let totalDef = this.def;
        this.buffs.forEach(buff => {
            if (buff.type === 'def') totalDef += buff.value;
        });
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

    regenSP() {
        if (!this.alive) return;
        this.sp = Math.min(this.maxSP, this.sp + this.spRegen);
    }

    addBuff(buff) {
        this.buffs.push(buff);
    }
}
