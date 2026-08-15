// SkillSystem.js - 技能系统（硬币投掷、伤害计算、特效、时点广播）

// v0.289：技能专属动画配置表（简约光效，每个技能量身定制）
// v0.291：按用户要求整体调慢、调夸张（时长约 1.7 倍、线条加粗、粒子增多、光效加大）
const SKILL_ANIM_CONFIG = {
    // —— 鲁盼旋 ——
    '斩祟·亮剑': {
        // v0.300 改为后撤 + 剑痕凭空出现（伤害同步）：动画由 _singleSlash 统一管理
        type: 'slashSingle', color: '#f9ca24', thick: 5, dur: 0.6,
        particles: { count: 9, icon: '🔥', spread: 65 }
    },
    '剑气迸进': {
        // v0.300 改为剑气弹道向前穿过目标（伤害同步）：动画由 _swordWave 统一管理
        // v0.306 剑气改红色（用户指定）：主刃 #e74c3c + 冲击波配套浅红 #ff7979
        type: 'swordWave', color: '#e74c3c', thick: 4, dur: 0.65,
        impact: { color: '#ff7979', size: 70, dur: 0.5 }
    },
    '十二连·剑斩邪祟': {
        type: 'slash', count: 12, color: '#f9ca24', thick: 5, dur: 1.2,
        particles: { count: 8, icon: '✨', spread: 55 }
    },
    // —— 持盾警察 ——
    '持盾格挡': {
        type: 'aura', color: '#4fc3f7', dur: 0.85, size: 115, border: '4px solid #4fc3f7',
        text: '🛡️'
    },
    '持盾猛击': {
        type: 'strike', color: '#bdc3c7', thick: 8, dur: 0.55,
        impact: { color: '#ecf0f1', size: 110, dur: 0.7 }
    },
    // —— 持棍警察 ——
    '棍击': {
        type: 'strike', color: '#95a5a6', thick: 4, dur: 0.5
    },
    '一秒18棍': {
        type: 'multi', count: 18, color: '#bdc3c7', thick: 3, dur: 1.6
    },
    // —— 持枪警察 ——
    '开火': {
        type: 'strike', color: '#ff4757', thick: 3.5, dur: 0.45,
        muzzle: true, impact: { color: '#ff6b6b', size: 70, dur: 0.55 }
    },
    // —— 开车警察 ——
    '加油': {
        type: 'aura', color: '#2ecc71', dur: 1.0, size: 110, border: '4px solid #2ecc71',
        particles: { count: 9, icon: '⚡', spread: 70, upward: true }
    },
    '刹车': {
        type: 'aura', color: '#e74c3c', dur: 0.8, size: 120, border: '4px solid #e74c3c',
        particles: { count: 8, icon: '💥', spread: 60 }
    },
    '开创': {
        // v0.307 改为警车加速冲过目标（伤害越高加速度越高）：动画由 _carRush 统一管理
        type: 'carRush', color: '#00d2ff', thick: 6, dur: 0.9,
        streaks: { count: 14, color: '#00d2ff', len: 70 },
        impact: { color: '#00d2ff', size: 90, dur: 0.5 }
    },
    // —— 李雅礼 ——
    '象征抵抗': {
        type: 'snap', color: '#f39c12', thick: 4, dur: 0.85
    },
    // —— 云长郡 ——
    '催眠气体释放': {
        type: 'gas', color: '#9b59b6', dur: 1.5, size: 150,
        particles: { count: 7, icon: '💤', spread: 60 }
    },
    '手枪威慑': {
        type: 'strike', color: '#ff6b6b', thick: 3, dur: 0.45,
        muzzle: true
    },
    // —— 灼华 ——
    // v0.5 火焰特效：燃木火球飞击 / 煽风火柱腾升 / 引爆三层爆炸（动画各由 _flameThrow/_emberRise/_fireBomb 统一管理）
    '燃木': {
        type: 'flameThrow', color: '#e67e22', thick: 4, dur: 0.55,
        impact: { color: '#ff9f43', size: 80, dur: 0.5 },
        particles: { count: 7, icon: '🔥', spread: 70 }
    },
    '煽风': {
        type: 'emberRise', color: '#ff6348', dur: 0.9,
        impact: { color: '#ff6348', size: 70, dur: 0.5 },
        particles: { count: 10, icon: '🔥', spread: 40, upward: true }
    },
    '引爆': {
        type: 'fireBomb', color: '#ff5252', dur: 0.8,
        impact: { color: '#ff7979', size: 120, dur: 0.6 },
        particles: { count: 12, icon: '💥', spread: 110 }
    },
    // —— 王庄明（v0.674 专属演出）——
    '抵抗': {
        type: 'aura', color: '#4fc3f7', dur: 0.85, size: 115, border: '4px solid #4fc3f7',
        text: '🛡️'
    },
    '纵焚烈火': {
        type: 'flameThrow', color: '#e67e22', thick: 4, dur: 0.55,
        impact: { color: '#ff9f43', size: 80, dur: 0.5 },
        particles: { count: 7, icon: '🔥', spread: 70 }
    },
    '守护': {
        type: 'guardAura', color: '#f1c40f', dur: 0.9, size: 120, border: '4px solid #f1c40f',
        text: '🛡️'
    },
    // —— 曹佳梦（v0.674 专属演出）——
    '手枪散射': {
        type: 'tripleShot', color: '#ffd166', thick: 3, dur: 0.25,
        impact: { color: '#ffd166', size: 55, dur: 0.4 }
    },
    '精准狙击': {
        type: 'snipe', color: '#7bed9f', thick: 2, dur: 0.3,
        impact: { color: '#7bed9f', size: 90, dur: 0.6 }
    },
    '创大运吧': {
        type: 'luckyDice', color: '#f9ca24', dur: 1.0, size: 120, border: '4px solid #f9ca24'
    },
    '陨星落下': {
        type: 'meteorFall', color: '#ff6b81', thick: 6, dur: 0.9,
        impact: { color: '#ff7979', size: 150, dur: 0.8 },
        particles: { count: 14, icon: '💥', spread: 120 }
    },
};
const SKILL_ANIM_DEFAULT = { type: 'strike', color: '#95a5a6', thick: 2, dur: 0.25 };

class SkillSystem {
    // v0.4：窄屏缩放动画位移。桌面端恒为 1（行为与 v0.320 完全一致）
    static _dispScale() {
        // v0.42：旋转模式下容器按横屏 844 宽渲染，位移不再缩小（与 _isRotated 布局坐标配套）
        if (SkillSystem._isRotated()) return 1;
        return (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) ? 0.4 : 1;
    }

    static flipCoin(probability = 0.5) {
        return Math.random() < probability;
    }

    // v0.673 曹佳梦「概率论的奇迹」：投硬币概率——同阵营存活曹佳梦在场时叠加生效：
    // 曹佳梦自身 +25% 且每级「厌倦」再 -5%，并额外吃场上其他曹佳梦各 +10%；
    // 非曹佳梦队友 = 每个曹佳梦 +10%（多曹佳梦叠加）；概率下限 0.1
    static coinProbFor(actor) {
        let prob = 0.5;
        if (actor && typeof battleState !== 'undefined' && battleState) {
            const teamCjm = battleState.allCharacters.filter(c => c.alive && c.team === actor.team && c.name === '曹佳梦');
            if (teamCjm.length > 0) {
                if (actor.name === '曹佳梦') {
                    // 自身：+25% − 自己的厌倦×5%；场上其他曹佳梦各再给 +10%
                    prob += 0.25 - actor.emotionLevel * 0.05 + 0.10 * (teamCjm.length - 1);
                } else {
                    // 队友：每个曹佳梦 +10%（叠加）
                    prob += 0.10 * teamCjm.length;
                }
            }
        }
        return Math.max(0.1, prob);
    }

    static rollCoins(coinCount, actor = null) {
        const prob = SkillSystem.coinProbFor(actor);
        let heads = 0;
        for (let i = 0; i < coinCount; i++) {
            if (SkillSystem.flipCoin(prob)) heads++;
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
        actor.spSpentThisTurn = (actor.spSpentThisTurn || 0) + skill.spCost;   // v0.669 王庄明「守护之躯」消耗统计
        actor.actedThisTurn = true;
        // v0.62 情感激荡：攻击+1（任何出招均计，含无目标辅助技能如焚香/加油/召唤）；鲁盼旋特殊情感激荡不受通用四触发影响（触发完全替换为回合末恶升级+队友死亡）
        if (!actor.specialEmotion) actor.gainEmotion(1);
        logFn(`${actor.name}（位置${actor.position}）使用【${skill.name}】，消耗${skill.spCost}算力`);
        if (window.refreshCardState) refreshCardState(actor);   // 算力条同帧扣减（含 buff/防御标签）

        // v0.314：第二关特殊胜利追踪——开车警察使出「开创」即记为已用过（怨灵车同名，仅第四关出现，不影响第二关判定）
        if (actor.name === '开车警察' && skill.name === '开创') {
            battleState.specialState.driverUsedOpen = true;
        }

        // 攻击者前冲（朝目标方向，带闪光）；鲁盼旋三技能各有专属演出（v0.294~v0.300）
        const animCfg = SKILL_ANIM_CONFIG[skill.name];
        if (actor.cardElement) {
            if (animCfg && animCfg.type === 'slash') {
                // 穿过式三段（v0.299）：向前穿过所有目标 → 剑痕浮现+目标受伤 → 闪回（battleActions 据此延长重渲染等待）
                SkillSystem._slashSequence(actor, targets, allCharsDiv);
                window._actionAnimDelay = 1400;
            } else if (animCfg && animCfg.type === 'slashSingle') {
                // 亮剑（v0.300）：微微后撤 → 剑痕凭空出现+目标受伤 → 归位剑痕消失
                SkillSystem._singleSlash(actor, targets, allCharsDiv);
                window._actionAnimDelay = 1100;
            } else if (animCfg && animCfg.type === 'swordWave') {
                // 剑气（v0.300）：斩出剑气弹道向前穿过目标 → 穿过时造成伤害 → 剑气消失
                SkillSystem._swordWave(actor, targets, allCharsDiv);
                window._actionAnimDelay = 800;
            } else if (animCfg && animCfg.type === 'carRush') {
                // 开创（v0.307）：警车加速冲过目标（伤害越高加速度越高）→ 撞击受伤同步 → 停在目标对侧
                SkillSystem._carRush(actor, targets, allCharsDiv);
                window._actionAnimDelay = 1100;
            } else if (animCfg && animCfg.type === 'flameThrow') {
                // 燃木（火焰特效）：火球沿直线飞向目标 → 命中炸开火焰（冲击波+🔥粒子）→ 伤害反馈同步
                SkillSystem._flameThrow(actor, targets, allCharsDiv);
                window._actionAnimDelay = 700;
            } else if (animCfg && animCfg.type === 'emberRise') {
                // 煽风（火焰特效）：目标身上火柱腾升，火焰越烧越旺（呼应升火）→ 伤害反馈在火柱中段同步
                SkillSystem._emberRise(actor, targets, allCharsDiv);
                window._actionAnimDelay = 1100;
            } else if (animCfg && animCfg.type === 'fireBomb') {
                // 引爆（火焰特效）：三层冲击波剧烈爆开 + 震屏 → 伤害反馈起爆瞬间同步
                SkillSystem._fireBomb(actor, targets, allCharsDiv);
                window._actionAnimDelay = 1000;
            } else {
                actor.cardElement.classList.add('attacker-animation');
                if (targets[0] && actor.position > targets[0].position) {
                    actor.cardElement.classList.add('lunge-left');
                }
                setTimeout(() => actor.cardElement.classList.remove('attacker-animation', 'lunge-left'), 700);   // v0.291：lunge 0.6s，移除须晚于动画结束
                window._actionAnimDelay = 800;
            }
        }

        // 技能自带 buff（持盾警察用；开车警察为数组，可挂多个）
        const skillBuffs = Array.isArray(skill.buff) ? skill.buff : (skill.buff ? [skill.buff] : []);
        skillBuffs.forEach(b => {
            // 永久型：直接改基础数值（开车警察加油/刹车）
            if (b.duration === 'permanent') {
                if (b.type === 'def') actor.def += b.value;
                // 加油/刹车只改变最小速度（速度区间下限），实际速度由每回合重随机生成（用户指定设计）
                if (b.type === 'speed') {
                    actor.speedMin = Math.max(1, actor.speedMin + b.value);
                    actor.rerollSpeed();   // 下限变化后重掷实际速度，保持落在新区间内
                }
                logFn(`  ${actor.name} ${b.value > 0 ? '+' : ''}${b.value} ${b.type === 'speed' ? '速度' : '防御'}（永久）`);
                return;
            }
            actor.addBuff({ ...b });
            logFn(`  ${actor.name} ${b.value > 0 ? '+' : ''}${b.value} ${b.type === 'speed' ? '速度' : '防御'}（持续${b.duration === 'nextHit' ? '至下次受击' : b.duration + '回合'}）`);
        });
        if (window.refreshCardState) refreshCardState(actor);   // 防御/速度/buff 标签与动画同帧刷新（加油/刹车/持盾格挡）

        // ——— v0.5 焚香（焚香祭司）：无目标增益——置特殊胜利标记，除自己外的存活友军「燃烧」等级+1，自身回120算力 ———
        if (skill.special && skill.special.type === 'incense') {
            battleState.specialState.incenseUsed = true;
            let n = 0;
            battleState.enemyTeam.forEach(c => {
                if (c.alive && c !== actor) { c.addBuffLevel('burn', 1); n++; }
            });
            actor.sp = Math.min(actor.maxSP, actor.sp + 120);
            logFn(`  🕯️ ${actor.name} 焚香：${n} 名友军「燃烧」等级 +1，自身回复 120 算力`);
            if (window.refreshCardState) refreshCardState(actor);
        }

        // ——— v0.5 火灵召唤（烛央）：无目标召唤——生成 1 名烬火信徒入敌方阵（右后方入场） ———
        if (skill.special && skill.special.type === 'summon') {
            const minion = createRoleInstance(skill.special.role, actor.team, 99);
            minion.entryAnim = true;
            minion.order = 999;
            battleState.enemyTeam.push(minion);
            battleState.allCharacters.push(minion);
            battleState.repositionAll();
            logFn(`  🔥 ${actor.name} 召唤了烬火信徒：${minion.name}（血量 ${minion.maxHp}）`);
        }

        // ——— v0.669 守护（王庄明）：使用时获得「守护」层数；自身血量 <1000 时改为更少层数并使防御永久 +75
        //      v0.670 削弱（用户指定）：正常 6→4 层、低血 4→3 层，叠加上限 6 层（防连续施放无限叠加） ———
        if (skill.special && skill.special.type === 'guard') {
            const cap = 6;   // v0.670 守护层数上限
            const gain = actor.hp < 1000 ? 3 : 4;
            const cur = actor.getBuffStack('guard');
            const added = Math.max(0, Math.min(gain, cap - cur));
            if (added > 0) actor.addBuffStack('guard', added);
            if (actor.hp < 1000) {
                actor.def += 75;   // 永久防御（改基础数值，读档经 def 字段恢复）
                logFn(`  🛡️ ${actor.name} 血量低于 1000，获得 ${added} 层「守护」（共 ${actor.getBuffStack('guard')} 层，上限 6），防御永久 +75`);
            } else {
                logFn(`  🛡️ ${actor.name} 获得 ${added} 层「守护」（共 ${actor.getBuffStack('guard')} 层，上限 6）`);
            }
            if (window.refreshCardState) refreshCardState(actor);
        }

        // v0.308：技能音效（Web Audio 合成，按 SKILL_ANIM_CONFIG type 映射专属音）
        if (typeof Sfx !== 'undefined') Sfx.playSkill(skill);

        // v0.289：技能自身光环动画（持盾格挡🛡️/加油⚡/刹车💥），与属性变化同帧
        SkillSystem.playSkillAnimation(actor, skill, allCharsDiv);

        // 特殊：无视防御量
        const baseIgnore = (skill.special && skill.special.type === 'ignoreDef') ? skill.special.value : 0;

        // v0.673 陨星落下：记录主要目标与其硬币结果（循环外对全场结算衰减）
        let meteorMain = null, meteorHeads = 0;
        const coinDist = SkillSystem.calculateCoinDistribution(actor, targets, skill.coinCount);
        coinDist.forEach(({ target, coins }) => {
            if (!target.alive) return;

            const rollResult = SkillSystem.rollCoins(coins, actor);
            const effectiveCoins = rollResult.heads;
            if (skill.special && skill.special.type === 'meteor') { meteorMain = target; meteorHeads = rollResult.heads; }
            // v0.673 曹佳梦「厌倦」：每投出一个正面硬币 +1 级（全局规则）；【精准狙击】投正时额外 +1 级
            if (actor.name === '曹佳梦' && rollResult.heads > 0) {
                actor.gainEmotion(rollResult.heads);
                if (skill.name === '精准狙击') actor.gainEmotion(1);
            }
            let dmg = 0;
            // 开创：与目标每有一点速度差，每硬币加成伤害+200（用局部变量，不改技能本体）
            // 速度差按双方实际速度（每回合在速度区间内重随机，见 Character.rerollSpeed）计算（用户确认）
            let effBonus = skill.bonusDamage;
            if (skill.special && skill.special.type === 'speedDiff') {
                effBonus += Math.abs(actor.speed - target.speed) * skill.special.bonus;
            }
            // v0.673 创大运吧（曹佳梦）：每级「厌倦」基础伤害 +250、每硬币加成 +200（不叠通用情感加成）
            let effBase = skill.baseDamage;
            if (skill.special && skill.special.type === 'jadeBurst') {
                effBase = skill.baseDamage + actor.emotionLevel * 250;
                effBonus = skill.bonusDamage + actor.emotionLevel * 200;
            }
            if (coins > 0) {
                // v0.62 情感激荡：基础伤害档位加成（覆盖式，达2级+50/达6级+100；鲁盼旋特殊情感激荡每2级+100）——作用于 baseDamage 段，正常走防御减免
                // v0.673 创大运吧使用专属公式（不叠通用加成）
                dmg = effBase + (skill.special && skill.special.type === 'jadeBurst' ? 0 : actor.getEmotionDamageBonus()) + effectiveCoins * effBonus;
                // v0.5 狂炎（焚天祭司·烛央）：每层使技能伤害+150
                if (actor.getBuffStack('frenzy') > 0) {
                    dmg += actor.getBuffStack('frenzy') * 150;
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
            if (window.refreshCardState) refreshCardState(target);   // 血条/防御/消耗掉的防御 buff 与受击动画同帧

            if (storedDef !== null) target.def = storedDef;

            logFn(`  → ${target.name}（位置${target.position}）分得 ${coins} 枚硬币，正 ${effectiveCoins}/${coins}，造成 ${actual} 伤害（血量：${target.hp}）`);
            if (!target.alive) {
                logFn(`  💥 ${target.name} 倒下！`);
                // v0.62 情感激荡：击杀+1（技能普伤致死归属施放者）；鲁盼旋特殊情感激荡不受通用触发
                if (!actor.specialEmotion) actor.gainEmotion(1);
                markAiLuKill(actor, target);   // v0.672 第四关隐藏星：AI 鲁盼旋击杀云长郡
                target.handleDeath();   // 倒戈/待命补位（放在伤害与倒下日志之后）
            }

            // ——— 时点广播：造成伤害（用于施加【恶】） ———
            Character.invokePassives('onDamageDealt', battleState, actor, target, actual, logFn);

            // ——— v0.6 「混乱」反噬：目标受击后按本次攻击分配硬币数触发（次数=coins×0.5 向上取整） ———
            // 每次触发：混乱层数-1，造成 级数×20 真实伤害；无回合末结算、无自然衰减，层数耗尽混乱消失
            if (target.alive && target.getBuffStack('confusion') > 0) {
                let chaosTimes = Math.ceil(coins * 0.5);
                while (chaosTimes > 0 && target.alive && target.getBuffStack('confusion') > 0) {
                    const chaosLvl = target.getBuffLevel('confusion');   // 先读级数再减层——最后一层减少后 buff 会被清除，后读得 0
                    target.reduceBuffStack('confusion', 1);
                    const chaosDmg = chaosLvl * 20;
                    const chaosActual = target.takeTrueDamage(chaosDmg);
                    target.dotDamageMap['confusion'] = (target.dotDamageMap['confusion'] || 0) + chaosActual;
                    logFn(`  🌀 ${target.name} 混乱反噬！Lv${chaosLvl}×20 = ${chaosDmg} 真实伤害，混乱层数-1（血量：${target.hp}）`);
                    if (window.refreshCardState) refreshCardState(target);
                    SkillSystem.showDamageNumber(target, chaosDmg, null, allCharsDiv);
                    chaosTimes--;
                    if (!target.alive) {
                        logFn(`  💥 ${target.name} 被混乱反噬致死！`);
                        // v0.62 情感激荡：击杀+1（混乱反噬致死归属触发攻击者，用户「全算」）；鲁盼旋特殊情感激荡不受通用触发
                        if (!actor.specialEmotion) actor.gainEmotion(1);
                        markAiLuKill(actor, target);   // v0.672 第四关隐藏星：AI 鲁盼旋击杀云长郡
                        target.handleDeath();   // 补位/倒戈（死亡广播交由下方统一处理）
                    }
                }
            }

            // ——— 时点广播：角色死亡 ———
            if (!target.alive) {
                Character.invokePassives('onAllyDeath', battleState, target, logFn);
                if (typeof triggerEmotionOnAllyDeath === 'function') triggerEmotionOnAllyDeath(target);   // v0.62 情感激荡：队友死亡+1（同阵营存活角色）
            }

            // ——— 时点广播：技能命中（鲁盼旋施加燃烧 / 灼华添薪；仅注册该时点的角色回调） ———
            Character.invokePassives('onSkillHit', battleState, actor, target, coins, logFn);

            // ——— 技能特殊效果：一技能施加燃烧层数 ———
            if (skill.special && skill.special.type === 'burn') {
                target.addBuffStack('burn', skill.special.stacks || 1, 1);
                logFn(`  🔥 ${target.name} 获得 ${skill.special.stacks || 1} 层「燃烧」（技能效果）`);
            }

            // ——— 特殊效果：煽风——提升目标「燃烧」等级（无燃烧则直接点燃 Lv） ———
            if (skill.special && skill.special.type === 'burnUp') {
                if (target.getBuffStack('burn') > 0) {
                    target.addBuffLevel('burn', skill.special.levels);
                    logFn(`  🔥 ${target.name}「燃烧」等级 +${skill.special.levels}（现 Lv ${target.getBuffLevel('burn')}）`);
                } else {
                    target.addBuffStack('burn', 1, skill.special.levels);
                    logFn(`  🔥 ${target.name} 被点燃：获得 1 层 Lv ${skill.special.levels}「燃烧」`);
                }
            }

            // ——— v0.669 纵焚烈火（王庄明）：命中时对目标施加 N 级「燃烧」（1 层 LvN）；自身部分在循环外只施加一次 ———
            if (skill.special && skill.special.type === 'burnLv') {
                target.addBuffLevel('burn', skill.special.level);
                logFn(`  🔥 ${target.name} 获得 ${skill.special.level} 级「燃烧」`);
                if (window.refreshCardState) refreshCardState(target);
            }

            // ——— 特殊效果：引爆——将目标「燃烧」结算为一次性真实伤害并清零 ———
            if (skill.special && skill.special.type === 'detonate') {
                const lvl = target.getBuffLevel('burn');
                const stk = target.getBuffStack('burn');
                if (lvl > 0 && stk > 0) {
                    const detDmg = lvl * 50 * (skill.special.ratio || 2);
                    const actual = target.takeTrueDamage(detDmg);
                    // v0.64：引爆无归属——「燃烧」的提前一次性结算，全部计入目标 Dot 明细（同回合末燃烧，不归属施放者；
                    //         结算页守恒公式简化为「敌方受到 = 我方造成 + Dot明细总和」）
                    target.dotDamageMap['burn'] = (target.dotDamageMap['burn'] || 0) + actual;
                    if (window.refreshCardState) refreshCardState(target);
                    logFn(`  💥 ${target.name} 的「燃烧」被引爆！Lv${lvl}×50×${skill.special.ratio} = ${detDmg} 真实伤害（血量：${target.hp}）`);
                    target.clearBuff('burn');
                    SkillSystem.showDamageNumber(target, detDmg, null, allCharsDiv);
                    if (!target.alive) {
                        logFn(`  💥 ${target.name} 倒下！`);
                        // v0.62 情感激荡：击杀+1（引爆致死归属引爆者）；鲁盼旋特殊情感激荡不受通用触发
                        if (!actor.specialEmotion) actor.gainEmotion(1);
                        markAiLuKill(actor, target);   // v0.672 第四关隐藏星：AI 鲁盼旋击杀云长郡
                        target.handleDeath();
                        Character.invokePassives('onAllyDeath', battleState, target, logFn);
                        if (typeof triggerEmotionOnAllyDeath === 'function') triggerEmotionOnAllyDeath(target);   // v0.62 情感激荡：队友死亡+1
                    }
                } else {
                    logFn(`  ${target.name} 没有可引爆的「燃烧」`);
                }
            }

            // ——— 特殊效果：催眠（下一回合施加【暂时昏迷】，使目标无法行动一回合） ———
            if (skill.special && skill.special.type === 'stun') {
                target.addBuffStack('stunPending', 1, 1);
                logFn(`  😵 ${target.name} 被催眠气体笼罩（下一回合陷入「暂时昏迷」）`);
            }

            // ——— 三技能：清零目标恶 ———
            if (skill.special && skill.special.type === 'evilDrain') {
                const ev = target.getBuffStack('e');
                if (ev > 0) { target.clearBuff('e'); logFn(`  ✨ ${target.name} 的 ${ev} 层「恶」被清零`); }
            }

            // v0.289：技能对目标专属动画（斩击线/弹道/冲击波/雾气等），与伤害数字同帧
            SkillSystem.playSkillTargetAnimation(actor, target, skill, allCharsDiv);

            // 鲁盼旋专属演出型技能（slash 十二连 / slashSingle 亮剑 / swordWave 剑气）+ 开创（carRush）
            // + 灼华火焰演出（flameThrow 火球 / emberRise 火柱 / fireBomb 爆炸）：
            // 受伤反馈（数字/震动/倒下爆发）延迟到各自动画的关键时刻播放（v0.299 十二连、v0.300 亮剑/剑气、v0.307 开创、v0.5 火焰），
            // 保证「造成伤害」与「剑痕/剑气命中/撞击/火球命中/爆炸」视觉同步
            const slashCfg = SKILL_ANIM_CONFIG[skill.name];
            const delayedHit = slashCfg && (slashCfg.type === 'slash' || slashCfg.type === 'slashSingle' || slashCfg.type === 'swordWave' || slashCfg.type === 'carRush'
                || slashCfg.type === 'flameThrow' || slashCfg.type === 'emberRise' || slashCfg.type === 'fireBomb');
            if (delayedHit) {
                if (slashCfg.type === 'carRush') window._slashCarDamage = actual;   // 开创：实际伤害驱动加速度（伤害越高加速度越高）
                (window._slashHitFeedbacks = window._slashHitFeedbacks || []).push(
                    () => SkillSystem.showDamageNumber(target, actual, { heads: effectiveCoins, total: coins }, allCharsDiv)
                );
            } else {
                SkillSystem.showDamageNumber(target, actual, { heads: effectiveCoins, total: coins }, allCharsDiv);
            }

            // 被动/特殊效果（恶、燃烧、催眠、愤怒等）产生的 buff 标签同帧刷新，不等 450ms 重渲染
            if (window.refreshCardState) { refreshCardState(target); refreshCardState(actor); }
        });

        // ——— v0.669 纵焚烈火（王庄明）：自身也受到 N 级「燃烧」（自焚，只施加一次，不受目标数影响） ———
        if (skill.special && skill.special.type === 'burnLv' && actor.alive) {
            actor.addBuffLevel('burn', skill.special.level);
            logFn(`  🔥 ${actor.name} 也受到 ${skill.special.level} 级「燃烧」（自焚）`);
            if (window.refreshCardState) refreshCardState(actor);
        }

        // ——— v0.673 陨星落下（曹佳梦·强化三）：对所有单位造成伤害（含自己与队友，主要目标已在循环内满伤结算），
        //      每距离主要目标 1 使总伤害下降 25%（距离 ≥4 衰减至 0）；使用后「厌倦」归零（清空重来） ———
        if (skill.special && skill.special.type === 'meteor' && meteorMain && actor.alive) {
            // 与主目标同公式（含厌倦通用基础加成）：(1250 + 厌倦加成) + 正面×1000，再按距离等比衰减
            const baseDmg = skill.baseDamage + actor.getEmotionDamageBonus() + meteorHeads * skill.bonusDamage;
            // v0.676 演出重制（用户指定）：「陨石」角色卡从天而降砸向主目标 → 震荡波 → 受击角色按距离分级颤动
            const arenaEl = allCharsDiv.parentElement;
            const allUnits = [...battleState.allCharacters].filter(c => c.alive);
            SkillSystem._meteorFallShow(meteorMain, allUnits, arenaEl);
            allUnits.forEach(c => {
                if (c === meteorMain) return;   // 主目标已在循环内满伤结算
                const dist = Math.abs(c.position - meteorMain.position);
                const mult = 1 - 0.25 * dist;
                if (mult <= 0) {
                    logFn(`  ☄️ ${c.name}（距主目标 ${dist}）衰减至 0，未受伤`);
                    return;
                }
                const dmg = Math.floor(baseDmg * mult);
                const actual = c.takeDamage(dmg, actor);
                if (window.refreshCardState) refreshCardState(c);
                SkillSystem.showDamageNumber(c, actual, null, allCharsDiv);
                logFn(`  ☄️ ${c.name}（位置${c.position}，距主目标 ${dist}）受到 ${actual} 伤害（衰减后 ${mult * 100}%）（血量：${c.hp}）`);
                if (!c.alive) {
                    logFn(`  💥 ${c.name} 倒下！`);
                    if (!actor.specialEmotion) actor.gainEmotion(1);
                    markAiLuKill(actor, c);
                    c.handleDeath();
                    Character.invokePassives('onAllyDeath', battleState, c, logFn);
                    if (typeof triggerEmotionOnAllyDeath === 'function') triggerEmotionOnAllyDeath(c);
                }
            });
            actor.emotionLevel = 0;   // 使用【陨星落下】后「厌倦」归零（强化三清空重来）
            if (window.refreshCardState) refreshCardState(actor);
            logFn(`  🎲 ${actor.name} 的「厌倦」归零（强化三已释放）`);
        }
    }

    // v0.676 陨星落下演出（用户指定）：一颗「陨石」角色卡从天而降砸向主目标 → 撞击爆散 +
    // 震荡波扩散 + 全场受击角色按与主目标距离分级颤动（近剧远微）+ 全屏震动
    static _meteorFallShow(meteorMain, allUnits, arena) {
        if (!meteorMain || !meteorMain.cardElement || !arena) return;
        const tRect = meteorMain.cardElement.getBoundingClientRect();
        const aRect = arena.getBoundingClientRect();
        const tx = tRect.left - aRect.left + tRect.width / 2;
        const ty = tRect.top - aRect.top + tRect.height / 2;

        // 陨石角色卡（从天而降，重力加速坠落）
        const meteor = document.createElement('div');
        meteor.className = 'meteor-card';
        meteor.innerHTML = `<div class="meteor-rock">🌑</div><div class="meteor-name">陨石</div>`;
        const mw = 64;
        meteor.style.left = (tx - mw / 2) + 'px';
        meteor.style.top = '-130px';
        arena.appendChild(meteor);

        const start = performance.now();
        const dur = 450;   // 坠落时长（重力感）
        const step = (now) => {
            const t = Math.min(1, (now - start) / dur);
            const ease = t * t;   // ease-in：加速下落
            meteor.style.top = (-130 + (ty - 40 + 130) * ease) + 'px';
            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                // 撞击：陨石爆散消失 + 震荡波 + 全员按距离颤动 + 全屏震动
                meteor.classList.add('meteor-impact');
                setTimeout(() => meteor.remove(), 400);
                SkillSystem._shockwave(meteorMain.cardElement, arena);
                allUnits.forEach(c => {
                    if (c.cardElement) {
                        const dist = Math.abs(c.position - meteorMain.position);
                        SkillSystem._hitShakeByDist(c.cardElement, dist);
                    }
                });
                const container = document.querySelector('.container');
                if (container) {
                    container.classList.add('screen-shake');
                    setTimeout(() => container.classList.remove('screen-shake'), 520);
                }
            }
        };
        requestAnimationFrame(step);
        window._actionAnimDelay = 1300;   // 演出总时长（坠落+颤动），重渲染延迟同步
    }

    // 震荡波：主目标处两圈扩散圆环（错时 120ms）
    static _shockwave(card, arena) {
        const cRect = card.getBoundingClientRect();
        const aRect = arena.getBoundingClientRect();
        const x = cRect.left - aRect.left + cRect.width / 2;
        const y = cRect.top - aRect.top + cRect.height / 2;
        [0, 120].forEach(delay => {
            setTimeout(() => {
                if (!arena.isConnected) return;
                const wave = document.createElement('div');
                wave.className = 'meteor-wave';
                wave.style.left = (x - 80) + 'px';
                wave.style.top = (y - 80) + 'px';
                arena.appendChild(wave);
                setTimeout(() => wave.remove(), 700);
            }, delay);
        });
    }

    // 距离分级颤动：距离 0 剧烈 / 1 中等 / 2 轻微 / ≥3 微颤（CSS 动画类，900ms 后移除）
    static _hitShakeByDist(card, dist) {
        const cls = 'meteor-hit-' + Math.min(3, dist);
        card.classList.remove('meteor-hit-0', 'meteor-hit-1', 'meteor-hit-2', 'meteor-hit-3');
        card.classList.add(cls);
        setTimeout(() => card.classList.remove(cls), 900);
    }

    // v0.676 演出重制后已弃用陨石雨光柱（_meteorFallShow 取代），.meteor-beam 样式保留备用

    static showDamageNumber(target, damage, coinInfo, allCharsDiv) {
        const card = target.cardElement;
        if (!card) return;
        const arena = allCharsDiv.parentElement;
        const p = SkillSystem._animPoint(card, arena);
        const s = SkillSystem._animSize(card);
        const x = p.x + s.w / 2;
        const y = p.y;

        const dmgDiv = document.createElement('div');
        dmgDiv.className = 'damage-number';
        if (damage === 0) {
            dmgDiv.classList.add('blocked');
            dmgDiv.textContent = '格挡';
        } else {
            dmgDiv.textContent = `-${damage}`;
            if (damage >= 800) dmgDiv.classList.add('big');   // 高伤大字
        }
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
        setTimeout(() => card.classList.remove('hit-animation'), 600);   // v0.291：hitShake 0.5s，移除须晚于动画结束

        // v0.308：受击音效（格挡→金属叮，受伤→打击咚；死亡附加爆炸声）
        // 演出型技能（slash/slashSingle/swordWave/carRush）的 showDamageNumber 被延迟到命中时刻——
        // 受击音随之同步，撞击/剑痕浮现瞬间出声
        if (typeof Sfx !== 'undefined') {
            if (!target.alive) Sfx.play('death');
            else if (damage === 0) Sfx.play('blocked');
            else Sfx.play('hit');
        }

        // 死亡爆发：单位倒下瞬间爆出 💥（不依赖卡片 DOM 存活）
        if (!target.alive) {
            const burst = document.createElement('div');
            burst.className = 'death-burst';
            burst.textContent = '💥';
            burst.style.left = x + 'px';
            burst.style.top = y + 'px';
            arena.appendChild(burst);
            setTimeout(() => burst.remove(), 850);
        }
    }

    // ==================== v0.289：技能专属动画 ====================

    // 自身动画（光环、速度线等）
    static playSkillAnimation(actor, skill, allCharsDiv) {
        const config = SKILL_ANIM_CONFIG[skill.name];
        if (!config) return;
        const arena = allCharsDiv.parentElement;
        if (!actor.cardElement) return;

        if (config.type === 'aura') {
            SkillSystem._createAura(actor.cardElement, arena, config);
            if (config.text) {
                SkillSystem._createParticles(actor.cardElement, arena, { count: 1, icon: config.text, spread: 20, upward: true });
            }
            if (config.particles) {
                SkillSystem._createParticles(actor.cardElement, arena, config.particles);
            }
        }
        // v0.674 王庄明「守护」：金色双层护盾——内环先亮、外环后亮 + 盾牌粒子涟漪
        if (config.type === 'guardAura') {
            const inner = { ...config, size: Math.round((config.size || 120) * 0.72), dur: (config.dur || 0.9) * 0.65, border: '3px solid ' + config.color };
            SkillSystem._createAura(actor.cardElement, arena, inner);
            setTimeout(() => { if (actor.cardElement) SkillSystem._createAura(actor.cardElement, arena, config); }, 120);
            if (config.text) {
                SkillSystem._createParticles(actor.cardElement, arena, { count: 8, icon: config.text, spread: 50, upward: true });
            }
        }
        // v0.674 曹佳梦「创大运吧」：金色赌运光环 + 骰子/星光粒子腾升
        if (config.type === 'luckyDice') {
            SkillSystem._createAura(actor.cardElement, arena, config);
            SkillSystem._createParticles(actor.cardElement, arena, { count: 8, icon: '🎲', spread: 55, upward: true });
            SkillSystem._createParticles(actor.cardElement, arena, { count: 10, icon: '✨', spread: 40, upward: true });
        }
        // v0.674 曹佳梦「陨星落下」：天际光柱由 meteor 结算段对全场每个受击单位生成（陨石雨），
        //      此处不再生成（v0.675 修复：原光柱错误出现在施放者头顶而非坠落点）
        if (config.type === 'carRush') return;   // 开创（v0.307）：速度线由 _carRush 在撞击目标时刻统一触发
        if (config.streaks) {
            SkillSystem._createStreaks(actor.cardElement, arena, config.streaks);
        }
    }

    // 对目标动画（斩击线/弹道/冲击波/雾气/粒子等）
    static playSkillTargetAnimation(actor, target, skill, allCharsDiv) {
        const config = SKILL_ANIM_CONFIG[skill.name];
        if (!config) return;   // 未知技能不播放动画（不含降级，模板角色按需单独配置）
        // 专属演出型（十二连/亮剑/剑气/开创/灼华火焰）：目标侧特效由各自流程统一管理，避免重复出招
        if (config.type === 'slash' || config.type === 'slashSingle' || config.type === 'swordWave' || config.type === 'carRush'
            || config.type === 'flameThrow' || config.type === 'emberRise' || config.type === 'fireBomb') return;
        const arena = allCharsDiv.parentElement;
        if (!target.cardElement || !actor.cardElement) return;

        if (config.type === 'strike' || config.type === 'beam' || config.type === 'snap') {
            SkillSystem._createStrikeLine(actor.cardElement, target.cardElement, arena, config);
        }
        // v0.674 曹佳梦「手枪散射」：三连发——枪口闪光 + 弹道线各 3 次（间隔 90ms），命中冲击波
        if (config.type === 'tripleShot') {
            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    if (!target.cardElement || !actor.cardElement) return;
                    SkillSystem._createMuzzleFlash(actor.cardElement, arena, config.color);
                    SkillSystem._createStrikeLine(actor.cardElement, target.cardElement, arena, { ...config, dur: 0.12 });
                }, i * 90);
            }
            if (config.impact) SkillSystem._createBurst(target.cardElement, arena, config.impact);
        }
        // v0.674 曹佳梦「精准狙击」：细长激光线（亮青）贯穿 + 枪口大闪光 + 命中强冲击
        if (config.type === 'snipe') {
            SkillSystem._createStrikeLine(actor.cardElement, target.cardElement, arena, { ...config, thick: 2, dur: 0.35 });
            SkillSystem._createStrikeLine(actor.cardElement, target.cardElement, arena, { ...config, thick: 6, dur: 0.18, color: 'rgba(123,237,159,0.35)' });
            if (actor.cardElement) SkillSystem._createMuzzleFlash(actor.cardElement, arena, '#ffffff');
            if (config.impact) SkillSystem._createBurst(target.cardElement, arena, config.impact);
        }
        // v0.674 曹佳梦「陨星落下」：目标处大爆炸 + 大量粒子 + 全屏震动
        if (config.type === 'meteorFall') {
            if (config.impact) SkillSystem._createBurst(target.cardElement, arena, config.impact);
            if (config.particles) SkillSystem._createParticles(target.cardElement, arena, config.particles);
            const c = document.querySelector('.container');
            if (c) {
                c.classList.add('screen-shake');
                setTimeout(() => c.classList.remove('screen-shake'), 520);
            }
        }
        if (config.type === 'multi') {
            const step = config.dur * 1000 / config.count;
            for (let i = 0; i < config.count; i++) {
                setTimeout(() => {
                    if (!target.cardElement || !actor.cardElement) return;
                    SkillSystem._createStrikeLine(actor.cardElement, target.cardElement, arena, { ...config, type: 'multi', dur: 0.15 });
                }, i * step);
            }
        }
        // 注意：slash 型（十二连）不在此处出刀——刀光由 executeSkill 的 _slashSequence 按随机方位闪现统一管理（v0.294）
        if (config.type === 'gas') {
            SkillSystem._createGasCloud(target.cardElement, arena, config);
        }
        if (config.muzzle && actor.cardElement) {
            SkillSystem._createMuzzleFlash(actor.cardElement, arena, config.color);
        }
        if (config.impact) {
            SkillSystem._createBurst(target.cardElement, arena, config.impact);
        }
        if (config.particles) {
            SkillSystem._createParticles(target.cardElement, arena, config.particles);
        }
    }

    // —— 辅助创建函数 ——

    // v0.42 旋转模式坐标适配：
    // rotate-mode 下 .arena 被 CSS rotate(90deg)，getBoundingClientRect 返回旋转后的视口 AABB，
    // 而动画 overlay 挂在 arena 内用布局 left/top 定位 → 必须用「布局坐标」（offset 累加，不受 transform 影响）
    // 才能与旋转后的卡片自洽。非 rotate-mode 走原 rect 逻辑，行为与旧版完全一致。
    static _isRotated() {
        return !!(document.documentElement && document.documentElement.classList.contains('rotate-mode'));
    }
    static _layoutPoint(el, base) {
        let x = 0, y = 0, cur = el;
        while (cur && cur !== base && cur !== document.body) {
            x += cur.offsetLeft;
            y += cur.offsetTop;
            cur = cur.offsetParent;
        }
        return { x, y };
    }
    static _animPoint(el, base) {
        if (SkillSystem._isRotated()) return SkillSystem._layoutPoint(el, base);
        const r = el.getBoundingClientRect();
        const a = base.getBoundingClientRect();
        return { x: r.left - a.left, y: r.top - a.top };
    }
    static _animSize(el) {
        if (SkillSystem._isRotated()) return { w: el.offsetWidth, h: el.offsetHeight };
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height };
    }

    static _getCardCenter(card, arena) {
        const p = SkillSystem._animPoint(card, arena);
        const s = SkillSystem._animSize(card);
        return { x: p.x + s.w / 2, y: p.y + s.h / 2 };
    }

    // 发光线段（actor → target）
    static _createStrikeLine(actorCard, targetCard, arena, config) {
        const a = SkillSystem._getCardCenter(actorCard, arena);
        const b = SkillSystem._getCardCenter(targetCard, arena);
        const dx = b.x - a.x, dy = b.y - a.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const cls = config.type === 'beam' ? 'beam' : (config.type === 'multi' ? 'multi' : (config.type === 'snap' ? 'snap' : 'strike'));

        const line = document.createElement('div');
        line.className = 'skill-line ' + cls;
        line.style.cssText = `left:${a.x}px;top:${a.y}px;width:${length}px;--thick:${config.thick || 2}px;--color:${config.color || '#fff'};--angle:${angle}deg;--dur:${config.dur || 0.35}s;--delay:${config.delay || 0}s`;
        arena.appendChild(line);
        setTimeout(() => line.remove(), (config.dur || 0.35) * 1000 + 150);
    }

    // 穿过式三段（v0.299 十二连·剑斩邪祟）：共十二剑，多目标时按硬币分配（均分+余数给前几个）。
    // 阶段1：角色直线向前穿过所有目标（只移动不出刀）；阶段2：剑痕一次性浮现 + 目标受伤（延迟反馈同步播放）；
    // 阶段3：角色闪回原位、剑痕统一淡出。
    static _slashSequence(actor, targets, allCharsDiv) {
        const cfg = SKILL_ANIM_CONFIG['十二连·剑斩邪祟'] || {};
        const actorCard = actor.cardElement;
        if (!actorCard) return;
        const arena = allCharsDiv.parentElement;
        const marks = [];

        // 剑序：总 12 剑，按硬币分配方式（均分 + 余数给前几个）分到各目标
        const total = 12;
        const n = targets.length || 1;
        const per = Math.floor(total / n), rem = total % n;
        const swords = [];
        targets.forEach((t, i) => {
            const c = per + (i < rem ? 1 : 0);
            for (let j = 0; j < c; j++) swords.push({ target: t, angle: Math.random() * 360 });   // 随机方位
        });

        // 注意：角色原位须在移动前缓存（动画坐标统一经 _animPoint，不随 transform 漂移——
        // v0.294 教训；v0.42 旋转模式下布局坐标同样自洽）
        const bp = SkillSystem._animPoint(actorCard, arena);
        const bs = SkillSystem._animSize(actorCard);

        // 阶段1：向前穿过所有目标——从原位直线冲到目标群对侧（zIndex 50 盖在目标上形成"穿过"感）
        const tgts = targets.map(t => t.cardElement
            ? { p: SkillSystem._animPoint(t.cardElement, arena), s: SkillSystem._animSize(t.cardElement) }
            : null).filter(Boolean);
        if (tgts.length) {
            const cx = tgts.reduce((s, o) => s + o.p.x + o.s.w / 2, 0) / tgts.length;
            const cy = tgts.reduce((s, o) => s + o.p.y + o.s.h / 2, 0) / tgts.length;
            const dir = cx >= bp.x + bs.w / 2 ? 1 : -1;   // 朝目标方向冲
            const farX = dir > 0 ? Math.max(...tgts.map(o => o.p.x + o.s.w)) : Math.min(...tgts.map(o => o.p.x));
            const passX = farX + dir * 140 * SkillSystem._dispScale();   // 穿过目标群后停在对面（v0.4：窄屏缩小位移）
            actorCard.style.transition = 'transform 0.28s ease-in';
            actorCard.style.zIndex = 50;
            actorCard.style.transform = `translate(${passX - (bp.x + bs.w / 2)}px, ${cy - (bp.y + bs.h / 2)}px)`;
        }

        // 阶段2：剑痕一次性浮现（12 道同时划出）+ 目标受伤反馈（延迟到此刻播放，与剑痕同步）
        const strikeAt = 360;
        setTimeout(() => {
            swords.forEach(s => {
                if (s.target.cardElement) SkillSystem._createBlade(s.target.cardElement, arena, s.angle, cfg, marks);
            });
            const fb = window._slashHitFeedbacks || [];
            window._slashHitFeedbacks = [];
            fb.forEach(f => f());
        }, strikeAt);

        // 阶段3：留痕后角色闪回原位 + 剑痕统一淡出移除
        const finishAt = strikeAt + 620;   // 刀光划出 0.35s + 停留留痕
        setTimeout(() => {
            marks.forEach(m => { if (m.isConnected) m.classList.add('fade'); });
            setTimeout(() => marks.forEach(m => m.remove()), 320);
            if (!actorCard.isConnected) return;
            actorCard.style.transition = 'transform 0.15s ease-out';
            actorCard.style.transform = 'translate(0, 0)';
            setTimeout(() => {
                actorCard.style.transition = '';
                actorCard.style.zIndex = '';
            }, 220);
        }, finishAt);
    }

    // 直线斩击光带（v0.297 废墟图书馆/边狱巴士式斩击线）：SVG 直线双层 stroke（金色刀光带 + 白芯亮刃口），
    // stroke-dash 从线一端划到另一端（刀光斩过轨迹）；目标卡片上随机落点，方向 = 角色闪现方位角；劈出后停留留痕。
    // （v0.296 弧形光带被用户否决「别用圆做圆弧」——斩击光痕是直线斜劈，不是弧线）
    static _createBlade(targetCard, arena, angleDeg, config, marks, instant = false) {
        if (!targetCard.isConnected) return;
        const p = SkillSystem._animPoint(targetCard, arena);
        const s = SkillSystem._animSize(targetCard);
        const left0 = p.x, top0 = p.y;
        const len = 50 + Math.random() * 24;              // 50~74px 光带长
        const x = left0 + s.w * (0.05 + Math.random() * 0.68);   // 卡片范围内随机落点
        const y = top0 + s.h * (0.08 + Math.random() * 0.62);
        const angle = Math.round(angleDeg % 360);
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('width', len);
        svg.setAttribute('height', len);
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.classList.add('skill-slash');
        if (instant) svg.classList.add('instant');        // 亮剑「凭空出现」：不划出，直接完整显示（v0.300）
        svg.style.cssText = `left:${x}px;top:${y}px;--angle:${angle}deg;--color:${config.color || '#f9ca24'};--opacity:${(0.7 + Math.random() * 0.3).toFixed(2)}`;
        const d = 'M 8 50 L 92 50';                       // 水平斩击线（viewBox 100，长 84），旋转到随机方位
        const gold = document.createElementNS(NS, 'path');
        gold.setAttribute('d', d);
        gold.setAttribute('stroke', config.color || '#f9ca24');
        gold.setAttribute('stroke-width', '8');            // 金色刀光带
        gold.setAttribute('stroke-linecap', 'round');
        gold.setAttribute('fill', 'none');
        gold.setAttribute('stroke-dasharray', '84');
        gold.setAttribute('stroke-dashoffset', instant ? '0' : '84');   // 初始全隐藏，动画从一端划出
        const edge = document.createElementNS(NS, 'path');
        edge.setAttribute('d', d);
        edge.setAttribute('stroke', '#fff');
        edge.setAttribute('stroke-width', '4');            // 白芯亮刃口叠在金色带上
        edge.setAttribute('stroke-linecap', 'round');
        edge.setAttribute('fill', 'none');
        edge.setAttribute('stroke-dasharray', '84');
        edge.setAttribute('stroke-dashoffset', instant ? '0' : '84');
        svg.appendChild(gold);
        svg.appendChild(edge);
        arena.appendChild(svg);
        marks.push(svg);
    }

    // 亮剑·斩祟（v0.300）：角色微微后撤 → 剑痕在目标身上凭空出现（伤害反馈同步）→ 归位、剑痕消失
    static _singleSlash(actor, targets, allCharsDiv) {
        const cfg = SKILL_ANIM_CONFIG['斩祟·亮剑'] || {};
        const actorCard = actor.cardElement;
        if (!actorCard) return;
        const arena = allCharsDiv.parentElement;
        const marks = [];
        const bp = SkillSystem._animPoint(actorCard, arena);
        const bs = SkillSystem._animSize(actorCard);

        // 阶段1：微微后撤（远离目标方向 42px，0.2s ease-out）
        let dir = 1;
        const t0 = targets[0];
        if (t0 && t0.cardElement) {
            const tp = SkillSystem._animPoint(t0.cardElement, arena);
            const ts = SkillSystem._animSize(t0.cardElement);
            dir = (tp.x + ts.w / 2 >= bp.x + bs.w / 2) ? -1 : 1;
        }
        actorCard.style.transition = 'transform 0.2s ease-out';
        actorCard.style.transform = `translate(${dir * 42 * SkillSystem._dispScale()}px, 0)`;   // v0.4：窄屏缩小位移

        // 阶段2：剑痕凭空出现（每目标一道）+ 目标受伤反馈同步 + 🔥 粒子
        const strikeAt = 240;
        setTimeout(() => {
            targets.forEach(t => {
                if (t.cardElement) SkillSystem._createBlade(t.cardElement, arena, 20 + Math.random() * 140, cfg, marks, true);
            });
            const fb = window._slashHitFeedbacks || [];
            window._slashHitFeedbacks = [];
            fb.forEach(f => f());
            targets.forEach(t => {
                if (t.cardElement && cfg.particles) SkillSystem._createParticles(t.cardElement, arena, cfg.particles);
            });
        }, strikeAt);

        // 阶段3：角色归位 + 剑痕统一淡出移除
        const finishAt = strikeAt + 500;
        setTimeout(() => {
            marks.forEach(m => { if (m.isConnected) m.classList.add('fade'); });
            setTimeout(() => marks.forEach(m => m.remove()), 320);
            if (!actorCard.isConnected) return;
            actorCard.style.transition = 'transform 0.2s ease-out';
            actorCard.style.transform = 'translate(0, 0)';
            setTimeout(() => { actorCard.style.transition = ''; }, 220);
        }, finishAt);
    }

    // 剑气迸进（v0.302）：从角色前方斩出一道圆弧形剑气（月牙光刃，曲率小），沿直线高加速冲出
    // （加速度很高：起步慢、急速命中），穿过目标瞬间造成伤害（反馈同步），到达目标对侧后消失
    static _swordWave(actor, targets, allCharsDiv) {
        const cfg = SKILL_ANIM_CONFIG['剑气迸进'] || {};
        const actorCard = actor.cardElement;
        if (!actorCard || !targets[0] || !targets[0].cardElement) return;
        const arena = allCharsDiv.parentElement;
        const tp = SkillSystem._animPoint(targets[0].cardElement, arena);
        const ts = SkillSystem._animSize(targets[0].cardElement);
        const ap = SkillSystem._animPoint(actorCard, arena);
        const as = SkillSystem._animSize(actorCard);
        const dir = (tp.x + ts.w / 2 >= ap.x + as.w / 2) ? 1 : -1;

        // 剑气：圆弧形光刃（SVG 双层 stroke，蓝刃白芯）——用户指定「剑气本身为圆弧，曲率小」：
        // 月牙形，两端尖、弧背凸向飞行方向（v0.302；v0.300 为竖直线光刃、v0.301 弹道弧被否——弹道改回直线）
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        // v0.305 剑气放大：110×80 → 140×100（弧线等比放大）；线宽 10/4 → 12/5 保持观感比例
        svg.setAttribute('width', '140');
        svg.setAttribute('height', '100');
        svg.setAttribute('viewBox', '0 0 140 100');
        svg.classList.add('sword-wave');
        const startX = (dir > 0 ? ap.x + as.w : ap.x);   // 角色卡边缘起手
        // 垂直中心与角色卡片高度中心对齐（v0.305 用户指定）：top = 角色中心 - 剑气高/2
        const cy = ap.y + as.h / 2;
        svg.style.cssText = `left:${startX}px;top:${cy - 50}px;--color:${cfg.color || '#3498db'}`;
        // 二次贝塞尔月牙：左上 → 控制点偏右 → 左下（弧背凸向右 = 飞行方向）
        // v0.305 曲率再小：控制点 x 36 → 30，凸出 12px → 9px（放大后视觉占比更平）
        const d = 'M 12 12 Q 30 50 12 88';
        const blue = document.createElementNS(NS, 'path');
        blue.setAttribute('d', d);
        blue.setAttribute('stroke', cfg.color || '#3498db');
        blue.setAttribute('stroke-width', '12');           // 蓝色光刃
        blue.setAttribute('stroke-linecap', 'round');
        blue.setAttribute('fill', 'none');
        const white = document.createElementNS(NS, 'path');
        white.setAttribute('d', d);
        white.setAttribute('stroke', '#fff');
        white.setAttribute('stroke-width', '5');           // 白芯
        white.setAttribute('stroke-linecap', 'round');
        white.setAttribute('fill', 'none');
        svg.appendChild(blue);
        svg.appendChild(white);
        arena.appendChild(svg);

        // 运动学驱动（v0.301 起，setInterval 16ms 逐帧更新；rAF 在 headless 下不保证执行）：
        // x(t) = v0·t + ½a·t² —— 加速度很高（初速 = 平均速度 1/3，末速 ≈ 平均速度 5/3），起步慢、急速命中
        // 弹道为直线（y 恒定，v0.302 用户澄清：圆弧是剑气形状不是弹道）
        const T = 380;   // 总飞行时长
        const L = (dir > 0 ? tp.x + ts.w : tp.x) + dir * 40 * SkillSystem._dispScale() - startX;   // 总行程（含冲过头 40px；v0.4：窄屏缩小）
        const v0 = L / (T * 3);
        const acc = 2 * (L - v0 * T) / (T * T);
        // 穿过目标时刻（运动学反解 v0·t + ½a·t² = 目标中心距离）：命中在飞行中后段，恰是速度最快时
        const dHit = dir > 0
            ? (tp.x + ts.w / 2) - startX
            : startX - (tp.x + ts.w / 2);
        const tHit = (-v0 + Math.sqrt(v0 * v0 + 2 * acc * dHit)) / acc;
        setTimeout(() => {
            const fb = window._slashHitFeedbacks || [];
            window._slashHitFeedbacks = [];
            fb.forEach(f => f());
            if (cfg.impact) SkillSystem._createBurst(targets[0].cardElement, arena, cfg.impact);
        }, tHit);

        const mirror = dir < 0 ? ' scale(-1, 1)' : '';   // 朝左飞时翻转形状（弧背朝飞行方向）
        const t0 = Date.now();
        const timer = setInterval(() => {
            const t = Date.now() - t0;
            if (t >= T) {
                clearInterval(timer);
                svg.classList.add('fade');
                setTimeout(() => svg.remove(), 260);
                return;
            }
            const x = v0 * t + 0.5 * acc * t * t;
            svg.style.transform = `translate(${x.toFixed(1)}px, 0)${mirror}`;
        }, 16);
    }

    // 开创（v0.307）：警车加速冲过目标——加速度与实际伤害正相关（伤害越高加速度越高），
    // 穿过目标瞬间撞击受伤反馈同步（速度线从车尾甩出 + 蓝色冲击波），停在目标对侧（用户指定，不回原位）
    static _carRush(actor, targets, allCharsDiv) {
        const cfg = SKILL_ANIM_CONFIG['开创'] || {};
        const actorCard = actor.cardElement;
        if (!actorCard || !targets[0] || !targets[0].cardElement) return;
        const arena = allCharsDiv.parentElement;
        const bp = SkillSystem._animPoint(actorCard, arena);
        const bs = SkillSystem._animSize(actorCard);
        const tp = SkillSystem._animPoint(targets[0].cardElement, arena);
        const ts = SkillSystem._animSize(targets[0].cardElement);
        const dir = (tp.x + ts.w / 2 >= bp.x + bs.w / 2) ? 1 : -1;
        const baseLeft = bp.x;
        // 冲过目标群停在目标对侧 140px（单硬币技能，目标 = targets[0]）
        const passX = (dir > 0 ? tp.x + ts.w : tp.x) + dir * 140 * SkillSystem._dispScale();   // v0.4：窄屏缩小位移
        const L = passX - baseLeft;                       // 带符号行程
        const dist = Math.abs(L);
        actorCard.style.zIndex = 50;                      // 盖在目标上形成穿过感
        actorCard.style.transition = 'none';

        // 第一个 tick 时伤害循环已同步结算完成（executeSkill 同步调用栈），读实际伤害定加速度：
        // acc = 伤害×5 + 1800（px/s²）——伤害越高加速度越高；0 伤害（格挡）也保持 0.75s 内的慢速冲过
        // 时长 T = sqrt(2·dist/acc)（约 0.27~0.75s）
        const t0 = Date.now();
        let started = false, acc = 0, T = 0, tHit = 0;
        const timer = setInterval(() => {
            const t = (Date.now() - t0) / 1000;   // 秒（acc/T/tHit 均为秒单位，勿混用毫秒——v0.307 单位 bug 教训）
            if (!started) {
                started = true;
                const dmg = window._slashCarDamage || 0;
                acc = dmg * 5 + 1800;
                T = Math.sqrt(2 * dist / acc);
                // 穿过目标中心时刻（运动学反解 ½·a·t² = 目标中心距离）：撞击瞬间受伤反馈 + 速度线 + 冲击波
                const dHit = dir > 0
                    ? (tp.x + ts.w / 2) - baseLeft
                    : baseLeft - (tp.x + ts.w / 2);
                tHit = (dHit > 0 && dHit < dist) ? Math.sqrt(2 * dHit / acc) : T;
                setTimeout(() => {
                    const fb = window._slashHitFeedbacks || [];
                    window._slashHitFeedbacks = [];
                    fb.forEach(f => f());
                    if (cfg.streaks) SkillSystem._createStreaks(actorCard, arena, cfg.streaks);
                    if (cfg.impact) SkillSystem._createBurst(targets[0].cardElement, arena, cfg.impact);
                }, tHit * 1000);   // tHit 为秒单位，setTimeout 需毫秒（v0.307 单位 bug 教训）
            }
            if (t >= T) {
                clearInterval(timer);
                actorCard.style.transform = `translate(${L.toFixed(1)}px, 0)`;   // 停在目标对侧（用户指定）
                return;
            }
            const x = 0.5 * acc * t * t * Math.sign(L);   // 初速 0、加速度很高：起步慢 → 爆发冲出
            actorCard.style.transform = `translate(${x.toFixed(1)}px, 0)`;
        }, 16);
    }

    // 燃木（v0.5 火焰特效）：灼华卡前凝火苗 → 火球沿直线飞向目标（运动学：初速慢→急速命中）→
    // 命中炸开火焰（橙红冲击波 + 🔥粒子四溅），伤害反馈在命中时刻同步播放
    static _flameThrow(actor, targets, allCharsDiv) {
        const cfg = SKILL_ANIM_CONFIG['燃木'] || {};
        const actorCard = actor.cardElement;
        if (!actorCard || !targets[0] || !targets[0].cardElement) return;
        const arena = allCharsDiv.parentElement;
        const ap = SkillSystem._animPoint(actorCard, arena);
        const as = SkillSystem._animSize(actorCard);
        const tp = SkillSystem._animPoint(targets[0].cardElement, arena);
        const ts = SkillSystem._animSize(targets[0].cardElement);
        const dir = (tp.x + ts.w / 2 >= ap.x + as.w / 2) ? 1 : -1;
        const startX = (dir > 0 ? ap.x + as.w : ap.x);   // 角色卡边缘起手
        const cy = ap.y + as.h / 2;

        // 火球：多层火苗层叠的圆形光球（radial-gradient + 多重 box-shadow 模拟火苗），从起手位置飞向目标
        const ball = document.createElement('div');
        ball.className = 'flame-ball';
        ball.style.left = startX + 'px';
        ball.style.top = cy + 'px';
        arena.appendChild(ball);

        // 运动学（与剑气相同）：x(t) = v0·t + ½a·t²，初速 = 平均速度 1/3，起步慢、急速命中
        const T = 450;   // 飞行总时长
        const endX = (dir > 0 ? tp.x + ts.w : tp.x) + dir * 30 * SkillSystem._dispScale();   // 冲过头 30px；v0.4：窄屏缩小
        const L = endX - startX;   // 带符号行程
        const dist = Math.abs(L);
        const v0 = L / (T * 3);
        const acc = 2 * (L - v0 * T) / (T * T);
        // 命中目标中心时刻（运动学反解）：此刻炸开火焰 + 伤害反馈同步
        const dHit = dir > 0 ? (tp.x + ts.w / 2) - startX : startX - (tp.x + ts.w / 2);
        const tHit = (dHit > 0 && dHit < dist) ? (-v0 + Math.sqrt(v0 * v0 + 2 * acc * dHit)) / acc : T;
        setTimeout(() => {
            const fb = window._slashHitFeedbacks || [];
            window._slashHitFeedbacks = [];
            fb.forEach(f => f());
            targets.forEach(t => {   // 命中炸开：冲击波 + 火焰粒子四溅（多目标 AOE 时全部炸开）
                if (t.cardElement) {
                    if (cfg.impact) SkillSystem._createBurst(t.cardElement, arena, cfg.impact);
                    if (cfg.particles) SkillSystem._createParticles(t.cardElement, arena, cfg.particles);
                }
            });
            ball.classList.add('fade');   // 火球命中后淡出
            setTimeout(() => ball.remove(), 260);
        }, tHit);

        const t0 = Date.now();
        const timer = setInterval(() => {
            const t = Date.now() - t0;
            if (t >= tHit) { clearInterval(timer); return; }   // 命中后由命中回调接管淡出
            const x = v0 * t + 0.5 * acc * t * t;
            // 火球为圆形，translate 需折回自身半径（13px）保持中心在弹道上；加微小正弦抖动模拟火焰跳动
            ball.style.transform = `translate(${(x - 13).toFixed(1)}px, ${(Math.sin(t * 0.02) * 3).toFixed(1)}px)`;
        }, 16);
    }

    // 煽风（v0.5 火焰特效）：目标身上火柱腾升——8~12 个火焰粒子从卡底向上蹿升（逐批涌出，火焰越烧越旺
    // 呼应「升火」），顶部火星飘散；伤害反馈在火柱腾升中段（~300ms）同步播放
    static _emberRise(actor, targets, allCharsDiv) {
        const cfg = SKILL_ANIM_CONFIG['煽风'] || {};
        const arena = allCharsDiv.parentElement;
        targets.forEach(target => {
            if (!target.cardElement) return;
            const p = SkillSystem._animPoint(target.cardElement, arena);
            const s = SkillSystem._animSize(target.cardElement);
            const cx = p.x + s.w / 2;
            const bottom = p.y + s.h;   // 从卡底喷涌
            const count = 8 + Math.floor(Math.random() * 5);   // 8~12 个火焰粒子
            for (let i = 0; i < count; i++) {
                setTimeout(() => {
                    if (!target.cardElement.isConnected) return;
                    const flame = document.createElement('div');
                    flame.className = 'flame-particle';
                    const drift = (Math.random() - 0.5) * 70;   // 水平摆动
                    const rise = 70 + Math.random() * 50;       // 上升高度
                    const dur = 0.5 + Math.random() * 0.35;
                    const size = 10 + Math.random() * 14;
                    flame.style.cssText = `left:${cx}px;top:${bottom}px;--dx:${drift.toFixed(0)}px;--dy:${(-rise).toFixed(0)}px;--dur:${dur.toFixed(2)}s;--size:${size.toFixed(0)}px`;
                    arena.appendChild(flame);
                    setTimeout(() => flame.remove(), dur * 1000 + 120);
                }, i * 70);   // 逐批蹿升（火焰越烧越旺）
            }
        });
        // 火柱腾升中段：伤害反馈 + 目标处橙红冲击波
        setTimeout(() => {
            const fb = window._slashHitFeedbacks || [];
            window._slashHitFeedbacks = [];
            fb.forEach(f => f());
            targets.forEach(t => {
                if (t.cardElement && cfg.impact) SkillSystem._createBurst(t.cardElement, arena, cfg.impact);
            });
        }, 300);
    }

    // 引爆（v0.5 火焰特效）：目标剧烈爆炸（三技能里最华丽）——三层冲击波（白闪快圈→橙红大圈→暗红外圈
    // 错开 80ms 依次扩散）+ 🔥💥粒子向四周高速飞射 + 目标卡震屏；伤害反馈在起爆瞬间（~120ms）同步播放
    static _fireBomb(actor, targets, allCharsDiv) {
        const cfg = SKILL_ANIM_CONFIG['引爆'] || {};
        const arena = allCharsDiv.parentElement;
        const rings = [
            { color: '#ffffff', size: 50, dur: 0.4, delay: 0 },    // 白闪快圈（起爆）
            { color: '#ff5252', size: 90, dur: 0.6, delay: 80 },    // 橙红大圈
            { color: '#c0392b', size: 130, dur: 0.7, delay: 160 },  // 暗红外圈
        ];
        targets.forEach(target => {
            if (!target.cardElement) return;
            const p = SkillSystem._getCardCenter(target.cardElement, arena);
            rings.forEach(r => {
                setTimeout(() => {
                    const ring = document.createElement('div');
                    ring.className = 'explosion-ring';
                    ring.style.cssText = `left:${p.x}px;top:${p.y}px;--size:${r.size}px;--color:${r.color};--dur:${r.dur}s`;
                    arena.appendChild(ring);
                    setTimeout(() => ring.remove(), r.dur * 1000 + 100);
                }, r.delay);
            });
            target.cardElement.classList.add('hit-animation');   // 震屏
            setTimeout(() => target.cardElement.classList.remove('hit-animation'), 600);
        });
        // 起爆瞬间：伤害反馈 + 爆炸粒子高速飞射 + 大冲击波
        setTimeout(() => {
            const fb = window._slashHitFeedbacks || [];
            window._slashHitFeedbacks = [];
            fb.forEach(f => f());
            targets.forEach(t => {
                if (t.cardElement) {
                    if (cfg.impact) SkillSystem._createBurst(t.cardElement, arena, cfg.impact);
                    if (cfg.particles) SkillSystem._createParticles(t.cardElement, arena, cfg.particles);
                }
            });
        }, 120);
    }

    // 冲击波（target 处扩散）
    static _createBurst(targetCard, arena, config) {
        const p = SkillSystem._getCardCenter(targetCard, arena);
        const circle = document.createElement('div');
        circle.className = 'skill-circle burst';
        circle.style.cssText = `left:${p.x}px;top:${p.y}px;--size:${config.size || 60}px;--color:${config.color || '#fff'};--border:2px solid ${config.color || '#fff'};--glow:${Math.floor((config.size || 60) / 5)}px;--dur:${config.dur || 0.5}s`;
        arena.appendChild(circle);
        setTimeout(() => circle.remove(), (config.dur || 0.5) * 1000 + 100);
    }

    // 光环（actor 自身）
    static _createAura(actorCard, arena, config) {
        const p = SkillSystem._getCardCenter(actorCard, arena);
        const circle = document.createElement('div');
        circle.className = 'skill-circle aura';
        circle.style.cssText = `left:${p.x}px;top:${p.y}px;--size:${config.size || 80}px;--color:${config.color};--border:${config.border || '3px solid ' + config.color};--glow:15px;--dur:${config.dur || 0.6}s`;
        arena.appendChild(circle);
        setTimeout(() => circle.remove(), (config.dur || 0.6) * 1000 + 100);
    }

    // 雾气（target 处缓慢扩散 + blur）
    static _createGasCloud(targetCard, arena, config) {
        const p = SkillSystem._getCardCenter(targetCard, arena);
        const circle = document.createElement('div');
        circle.className = 'skill-circle gas';
        circle.style.cssText = `left:${p.x}px;top:${p.y}px;--size:${config.size || 100}px;--color:${config.color};--border:none;--fill:${config.color}22;--glow:20px;--dur:${config.dur || 0.8}s`;
        arena.appendChild(circle);
        setTimeout(() => circle.remove(), (config.dur || 0.8) * 1000 + 200);
    }

    // 枪口闪光
    static _createMuzzleFlash(actorCard, arena, color) {
        const p = SkillSystem._getCardCenter(actorCard, arena);
        const dot = document.createElement('div');
        dot.className = 'skill-dot';
        dot.style.cssText = `left:${p.x}px;top:${p.y}px;--size:14px;--color:${color || '#fff'};--glow:10px;--dur:0.2s`;
        arena.appendChild(dot);
        setTimeout(() => dot.remove(), 300);
    }

    // 粒子飘散（emoji 小字随机方向飞散）
    static _createParticles(centerCard, arena, config) {
        const p = SkillSystem._animPoint(centerCard, arena);
        const s = SkillSystem._animSize(centerCard);
        const cx = p.x + s.w / 2;
        const cy = p.y + s.h * 0.35;   // 卡片上部偏中
        for (let i = 0; i < config.count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = (config.spread || 40) * (0.6 + Math.random() * 0.4);
            const dx = Math.cos(angle) * dist;
            const dy = config.upward ? -(Math.abs(Math.sin(angle)) * dist + dist * 0.2) : Math.sin(angle) * dist;
            const p = document.createElement('div');
            p.className = 'skill-particle';
            p.textContent = config.icon || '✨';
            p.style.cssText = `left:${cx}px;top:${cy}px;--dx:${dx}px;--dy:${dy}px;--dur:${0.45 + Math.random() * 0.3}s`;
            arena.appendChild(p);
            setTimeout(() => p.remove(), 800);
        }
    }

    // 速度线（开创冲刺用，actor 身后横向飞掠）
    static _createStreaks(actorCard, arena, config) {
        const p = SkillSystem._animPoint(actorCard, arena);
        const s = SkillSystem._animSize(actorCard);
        const cy = p.y + s.h / 2;
        for (let i = 0; i < (config.count || 6); i++) {
            const x = p.x + Math.random() * s.w;
            const yOff = (Math.random() - 0.5) * r.height * 0.7;
            const streak = document.createElement('div');
            streak.className = 'skill-streak';
            streak.style.cssText = `left:${x}px;top:${cy + yOff}px;--len:${config.len || 40}px;--color:${config.color};--dur:${0.3 + Math.random() * 0.25}s`;
            arena.appendChild(streak);
            setTimeout(() => streak.remove(), 600);
        }
    }
}
