// SkillSystem.js - 技能系统（硬币投掷、伤害计算、特效、时点广播）
class SkillSystem {
    static flipCoin(probability = 0.5) {
        return Math.random() < probability;
    }

    static rollCoins(coinCount) {
        let heads = 0;
        for (let i = 0; i < coinCount; i++) {
            if (SkillSystem.flipCoin()) heads++;
        }
        return { heads, total: coinCount };
    }

    static calculateCoinDistribution(attacker, targets, totalCoins) {
        if (targets.length === 0) return [];
        const n = targets.length;
        const baseCoins = Math.floor(totalCoins / n);
        let remainder = totalCoins % n;
        const dist = targets.map(t => ({
            target: t,
            distance: Math.abs(attacker.position - t.position),
            coins: baseCoins
        }));
        dist.sort((a, b) => {
            if (a.distance !== b.distance) return a.distance - b.distance;
            return a.target.position - b.target.position;
        });
        for (let i = 0; i < remainder; i++) dist[i].coins += 1;
        return dist;
    }

    static executeSkill(actor, skill, targets, battleState, allCharsDiv, logFn) {
        if (!actor.alive) return;
        actor.sp -= skill.spCost;
        actor.actedThisTurn = true;
        logFn(`${actor.name}(位置${actor.position}) 使用【${skill.name}】，消耗${skill.spCost}算力`);

        // 攻击者闪光
        if (actor.cardElement) {
            actor.cardElement.classList.add('attacker-animation');
            setTimeout(() => actor.cardElement.classList.remove('attacker-animation'), 300);
        }

        // 技能自带 buff（持盾警察用）
        if (skill.buff) {
            actor.addBuff({ ...skill.buff });
            logFn(`  ${actor.name} 获得防御${skill.buff.value > 0 ? '+' : ''}${skill.buff.value} buff`);
        }

        // 特殊：无视防御量
        const baseIgnore = (skill.special && skill.special.type === 'ignoreDef') ? skill.special.value : 0;

        const coinDist = SkillSystem.calculateCoinDistribution(actor, targets, skill.coinCount);
        coinDist.forEach(({ target, coins }) => {
            if (!target.alive) return;

            const rollResult = SkillSystem.rollCoins(coins);
            const effectiveCoins = rollResult.heads;
            let dmg = 0;
            if (coins > 0) {
                dmg = skill.baseDamage + effectiveCoins * skill.bonusDamage;
                // 鲁盼旋：每有2层愤怒使技能伤害+100
                if (actor.name === '鲁盼旋') {
                    const rageStacks = actor.getBuffStack('rage');
                    dmg += Math.floor(rageStacks / 2) * 100;
                }
            }

            // 三技能：目标每层恶 +bonus 伤害
            if (skill.special && skill.special.type === 'evilDrain') {
                dmg += target.getBuffStack('e') * skill.special.bonus;
            }

            // 总无视防御：二技能基础值 + 目标恶层数 × 50（鲁盼旋固有机制）
            let totalIgnore = baseIgnore;
            if (actor.name === '鲁盼旋') {
                totalIgnore += target.getBuffStack('e') * 50;
            }
            let storedDef = null;
            if (totalIgnore > 0) {
                storedDef = target.def;
                target.def = Math.max(0, target.def - totalIgnore);
            }

            const actual = target.takeDamage(dmg, actor);

            if (storedDef !== null) target.def = storedDef;

            logFn(`  → 对${target.name}(位置${target.position}) 分配${coins}硬币，投掷结果：正${effectiveCoins}/${coins}，造成${actual}伤害 (HP:${target.hp})`);
            if (!target.alive) logFn(`  💥 ${target.name} 倒下！`);

            // ——— 时点广播：造成伤害（用于施加【恶】） ———
            Character.invokePassives('onDamageDealt', battleState, actor, target, actual, logFn);

            // ——— 时点广播：角色死亡 ———
            if (!target.alive) {
                Character.invokePassives('onAllyDeath', battleState, target, logFn);
            }

            // ——— 时点广播：技能命中（鲁盼旋施加燃烧） ———
            if (actor.name === '鲁盼旋') {
                 Character.invokePassives('onSkillHit', battleState, actor, target, coins, logFn);
            }

            // ——— 技能特殊效果：一技能施加燃烧层数 ———
            if (skill.special && skill.special.type === 'burn') {
                target.addBuffStack('burn', skill.special.stacks || 1, 1);
                logFn(`  🔥 ${target.name} 获得${skill.special.stacks || 1}层【燃烧】（技能效果）`);
            }

            // ——— 三技能：清零目标恶 ———
            if (skill.special && skill.special.type === 'evilDrain') {
                const ev = target.getBuffStack('e');
                if (ev > 0) { target.clearBuff('e'); logFn(`  ✨ ${target.name} 的${ev}层【恶】被清零`); }
            }

            SkillSystem.showDamageNumber(target, actual, { heads: effectiveCoins, total: coins }, allCharsDiv);
        });
    }

    static showDamageNumber(target, damage, coinInfo, allCharsDiv) {
        const card = target.cardElement;
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const arenaRect = allCharsDiv.parentElement.getBoundingClientRect();
        const x = rect.left - arenaRect.left + rect.width / 2;
        const y = rect.top - arenaRect.top;
        const arena = allCharsDiv.parentElement;

        const dmgDiv = document.createElement('div');
        dmgDiv.className = 'damage-number';
        dmgDiv.textContent = `-${damage}`;
        dmgDiv.style.left = x + 'px';
        dmgDiv.style.top = y + 'px';
        arena.appendChild(dmgDiv);
        setTimeout(() => dmgDiv.remove(), 1000);

        if (coinInfo) {
            const coinDiv = document.createElement('div');
            coinDiv.className = 'coin-indicator';
            coinDiv.textContent = `硬币×${coinInfo.total}(正${coinInfo.heads})`;
            coinDiv.style.left = x + 5 + 'px';
            coinDiv.style.top = y + 18 + 'px';
            arena.appendChild(coinDiv);
            setTimeout(() => coinDiv.remove(), 800);
        }

        card.classList.add('hit-animation');
        setTimeout(() => card.classList.remove('hit-animation'), 200);
    }
}
