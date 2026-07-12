// Skills.js - 技能类定义
class Skill {
    constructor(name, spCost, baseDamage, bonusDamage, coinCount, attackRange, buff = null, special = null) {
        this.name = name;
        this.spCost = spCost;
        this.baseDamage = baseDamage;
        this.bonusDamage = bonusDamage;
        this.coinCount = coinCount;
        this.attackRange = attackRange;
        this.buff = buff;                        // { type:'def', value, duration:'nextHit' }
        this.special = special;                  // { type:'ignoreDef', value:200 } | { type:'burn', stacks:1 } | { type:'evilDrain', bonus:50 }
    }
}
