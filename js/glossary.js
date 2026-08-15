// glossary.js - 特殊词条词典与文本渲染（词条可点击弹出解释）
// 用法：在纯文本上调用 renderGlossaryText(text)，返回带可点击词条的 HTML
// v0.278：词条仅保留 Buff 类（状态效果），机制类词条移除

const GLOSSARY = {
    'Buff': { title: 'Buff（状态效果）', desc: '战斗中的临时状态效果，如防御增减、「恶」、「愤怒」、「怨恨」、「情感激荡」、「燃烧」、「昏迷」等。点击角色卡上的 Buff 标签可查看该角色当前的全部状态详情。' },
    '燃烧': { title: '燃烧', desc: '持续伤害状态：回合结束时受到等级 × 50 真实伤害。每 5 级消耗 1 层（1~4 级不消耗层数），层数耗尽后燃烧结束；若层数不足，按剩余层数 × 5 级一次结算并结束燃烧。' },
    '恶': { title: '恶', desc: '伤害计算时，每层使鲁盼旋对目标无视 50 防御；【十二连·剑斩邪祟】命中时可转化为每层 100 点额外伤害并清零。' },
    '愤怒': { title: '愤怒', desc: '鲁盼旋的专属强化状态（上限 5 级）：每 2 级基础伤害 +100、每 2 级防御 −50，不回复算力。回合结束时获得场上「恶」总层数的愤怒；队友死亡时愤怒 +3 级；技能命中时可消耗 1 级为「燃烧」追加 1 层。' },
    '怨恨': { title: '怨恨', desc: '云长郡的专属强化状态（上限 10 级）：受击减伤 = 100% − 等级×15%（Lv 7 起跌破 0%，转为受到伤害加成）；每 3 级基础伤害 +50、防御 −50（Lv 3/6/9 = +50/100/150）；队友死亡时怨恨 +1 级（含其召唤的警察怨灵）；不回复算力。' },
    '情感激荡': { title: '情感激荡', desc: '情绪累积系统（0~8 级）：攻击、受击、击杀、队友死亡各 +1 级；达 2 级基础伤害 +50、达 6 级 +100、达 4 级算力回复 +50、达 8 级 +100（覆盖式）。' },
    '暂时昏迷': { title: '暂时昏迷', desc: '轮到行动时无法行动，跳过本次行动后解除。' },
    '昏迷': { title: '暂时昏迷', desc: '轮到行动时无法行动，跳过本次行动后解除。' },
    '狂炎': { title: '狂炎', desc: '焚天祭司·烛央的强化状态：伤害计算时每层使【烈焰鞭】/【焚天祭】伤害+150，防御计算时每层防御-20。烛央【薪火不息】回合结束时把场上全体「燃烧」等级之和转为狂炎层数；死亡时【焚尽薪火】把狂炎转成残余敌方的「燃烧」等级。' },
    '易燃': { title: '易燃', desc: '焦木傀儡的固有特性：燃烧结算时，受到的「燃烧」持续伤害×1.5。' },
    '混乱': { title: '混乱', desc: '受击反噬型持续伤害：受到伤害后按本次攻击的分配硬币数触发反噬（次数=硬币数×0.5 向上取整），每次消耗 1 层并造成 级数×20 真实伤害，层数耗尽后混乱消失。' },
    '守护': { title: '守护', desc: '王庄明的专属状态：队友即将失去血量时防止之，改为王庄明自身受到对应数值的无来源伤害（再次结算防御与减伤），然后「守护」层数减一。一切伤害（普通/真伤/持续伤害）均会转移；王庄明自己受击不转移。' },
    '厌倦': { title: '厌倦', desc: '曹佳梦的专属强化状态（特殊情感激荡，上限 5 级）：每投出一个正面硬币 +1 级（【精准狙击】投正时额外 +1 级），每级基础伤害 +50，每级自身投正率 -5%；使用【陨星落下】后归零；厌倦 ≥4 级时回合开始【创大运吧】替换为【陨星落下】（<4 级恢复）；不回复算力。' }
};

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 把纯文本中出现的词条替换为可点击的高亮 span（长词条优先，不会重复包裹）
// 词条前面紧邻汉字/字母/数字时视为专有名词内的子串（如"惩恶之火"中的"恶"），不匹配
function renderGlossaryText(text) {
    if (typeof text !== 'string' || text === '') return '';
    const keys = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
    const re = new RegExp(keys.map(escapeRegExp).join('|'), 'g');
    let html = '';
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
        const prev = text[m.index - 1];
        if (prev && /[一-鿿぀-ヿA-Za-z0-9·]/.test(prev)) {
            re.lastIndex = m.index + 1;
            continue;
        }
        html += text.slice(last, m.index);
        html += `<span class="glossary-term" onclick="showGlossary('${m[0]}')">${m[0]}</span>`;
        last = m.index + m[0].length;
    }
    html += text.slice(last);
    return html;
}

// 技能特殊效果行：按触发时点生成描述，写在技能介绍末尾
// 例：【斩祟·亮剑】→ 【命中时】对目标施加1层「燃烧」
function skillEffectLines(skill) {
    const lines = [];
    const buffs = Array.isArray(skill.buff) ? skill.buff : (skill.buff ? [skill.buff] : []);
    if (buffs.length > 0) {
        const allPermanent = buffs.every(b => b.duration === 'permanent');
        const parts = buffs.map(b => {
            const sign = b.value > 0 ? '+' : '';
            return (b.type === 'def' ? '防御' : '速度') + sign + b.value;
        });
        lines.push(`【使用时】自身${allPermanent ? '永久' : ''}${parts.join('、')}${allPermanent ? '' : '（至下次受击）'}`);
    }
    if (skill.special) {
        const s = skill.special;
        if (s.type === 'burn') lines.push(`【命中时】对目标施加 ${s.stacks} 层「燃烧」`);
        else if (s.type === 'stun') lines.push(`【命中时】对目标施加「催眠气体」，下一回合陷入「暂时昏迷」`);
        else if (s.type === 'ignoreDef') lines.push(`【伤害时】无视目标${s.value}防御`);
        else if (s.type === 'evilDrain') lines.push(`【伤害时】目标每层「恶」+${s.bonus} 伤害，并清零「恶」`);
        else if (s.type === 'speedDiff') lines.push(`【伤害时】与目标每点速度差，每枚硬币额外+${s.bonus}伤害`);
        else if (s.type === 'burnUp') lines.push(`【命中时】目标「燃烧」等级 +${s.levels}；无「燃烧」则施加 1 层 Lv ${s.levels}`);
        else if (s.type === 'detonate') lines.push(`【命中时】引爆目标「燃烧」：造成 等级×50×${s.ratio} 真实伤害并清零`);
        else if (s.type === 'incense') lines.push(`【使用时】除自己外的友军「燃烧」等级 +1，自身回复 120 算力`);
        else if (s.type === 'summon') lines.push(`【使用时】召唤 1 名${s.role}入场`);
        else if (s.type === 'burnLv') lines.push(`【命中时】对目标施加 ${s.level} 级「燃烧」，并对自身施加 ${s.level} 级「燃烧」`);   // v0.669 纵焚烈火
        else if (s.type === 'guard') lines.push(`【使用时】获得 4 层「守护」（上限 6 层）；自身血量 <1000 时改为 3 层，并使防御永久 +75`);   // v0.669 守护（v0.670 层数削弱）
        else if (s.type === 'jadeBonus') lines.push(`【伤害时】硬币投正时额外提升 1 级「厌倦」`);   // v0.673 精准狙击
        else if (s.type === 'jadeBurst') lines.push(`【伤害时】每级「厌倦」使基础伤害 +250、每硬币加成 +200`);   // v0.673 创大运吧
        else if (s.type === 'meteor') lines.push(`【伤害时】对所有单位造成伤害；每距离主要目标 1 使伤害下降 25%（≥4 为 0）；使用后「厌倦」归零`);   // v0.673 陨星落下
    }
    return lines;
}

// ==================== 词条弹窗 ====================
function showGlossary(key) {
    const item = GLOSSARY[key];
    if (!item) return;
    document.getElementById('glossaryPopupTitle').textContent = `📖 ${item.title}`;
    document.getElementById('glossaryPopupBody').innerHTML = `<p style="margin:0;line-height:1.8;">${item.desc}</p>`;
    document.getElementById('glossaryPopupOverlay').style.display = 'flex';
}

function closeGlossary() {
    document.getElementById('glossaryPopupOverlay').style.display = 'none';
}
