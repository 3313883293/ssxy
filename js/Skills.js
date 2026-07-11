// Skills.js - 技能类定义
class Skill {
    constructor(name, spCost, baseDamage, bonusDamage, coinCount, attackRange, buff = null) {
        this.name = name;
        this.spCost = spCost;
        this.baseDamage = baseDamage;
        this.bonusDamage = bonusDamage;
        this.coinCount = coinCount;
        this.attackRange = attackRange;
        this.buff = buff;
    }
}
