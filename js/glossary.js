// glossary.js - 特殊词条词典与文本渲染（词条可点击弹出解释）
// 用法：在纯文本上调用 renderGlossaryText(text)，返回带可点击词条的 HTML
// v0.278：词条仅保留 Buff 类（状态效果），机制类词条移除

const GLOSSARY = {
    'Buff': { title: 'Buff（状态效果）', desc: '战斗中的临时状态效果，如防御增减、「恶」、「愤怒」、「燃烧」、「昏迷」等。点击角色卡上的 Buff 标签可查看该角色当前的全部状态详情。' },
    '燃烧': { title: '燃烧', desc: '持续伤害状态：回合结束时受到等级 × 50 真实伤害。每 5 级消耗 1 层（1~4 级不消耗层数），层数耗尽后燃烧结束；若层数不足，按剩余层数 × 5 级一次结算并结束燃烧。' },
    '恶': { title: '恶', desc: '每层使攻击者对目标无视 50 防御；【十二连·剑斩邪祟】命中时可转化为每层 100 点额外伤害并清零。' },
    '愤怒': { title: '愤怒', desc: '强化状态（上限 5 层）：每 2 层使技能伤害 +50，每 2 层使防御 −50；可消耗 1 层为「燃烧」追加 1 层。' },
    '暂时昏迷': { title: '暂时昏迷', desc: '目标本回合无法行动，回合结束后恢复。' },
    '昏迷': { title: '暂时昏迷', desc: '目标本回合无法行动，回合结束后恢复。' },
    '狂炎': { title: '狂炎', desc: '焚天祭司·烛央 的强化状态：每层使【烈焰鞭】/【焚天祭】伤害+150、防御-20。烛央【薪火不息】回合结束时把场上全体「燃烧」等级之和转为狂炎层数；死亡时【焚尽薪火】把狂炎转成残余敌方的「燃烧」等级。' },
    '易燃': { title: '易燃', desc: '焦木傀儡 的固有特性：受到的「燃烧」持续伤害×1.5。' }
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
        if (s.type === 'burn') lines.push(`【命中时】对目标施加${s.stacks}层「燃烧」`);
        else if (s.type === 'stun') lines.push(`【命中时】对目标施加「催眠气体」，下一回合陷入「暂时昏迷」`);
        else if (s.type === 'ignoreDef') lines.push(`【伤害时】无视目标${s.value}防御`);
        else if (s.type === 'evilDrain') lines.push(`【伤害时】目标每层「恶」+${s.bonus}伤害，并清零「恶」`);
        else if (s.type === 'speedDiff') lines.push(`【伤害时】与目标每点速度差，每枚硬币额外+${s.bonus}伤害`);
        else if (s.type === 'burnUp') lines.push(`【命中时】目标「燃烧」等级+${s.levels}；无「燃烧」则施加1层Lv${s.levels}`);
        else if (s.type === 'detonate') lines.push(`【命中时】引爆目标「燃烧」：造成 等级×50×${s.ratio} 真实伤害并清零`);
        else if (s.type === 'incense') lines.push(`【使用时】除自己外的友军「燃烧」等级+1，自身回复120算力`);
        else if (s.type === 'summon') lines.push(`【使用时】召唤 1 名${s.role}入场`);
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
