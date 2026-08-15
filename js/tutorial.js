// tutorial.js - 新手教程教学引导状态机（v0.310 教程关 level === -2；v0.65 扩为 12 步）
// 前半段强制引导：每步弹窗 + 目标高亮，做对应操作即自动推进（游戏流程天然强制）；
// 后半段（⑫）解除强制，自由练习到胜利。
// v0.65 全面优化：能实操的机制（硬币/算力/速度/防御/意图徽章/情感/结算）文本讲透；
//           无法实操的机制（Buff/燃烧/混乱/被动/替补）用图文讲解步（⑨ buff-dot、⑪ bench）覆盖。
const TUTORIAL_STEPS = [
    { id: 'char-select',    text: '① 本关只需选<b>1 名角色</b>出战。三模板定位：<br>模板一【均衡】中速中防 / 模板二【高速远程】速度快但身板脆 / 模板三【近战爆发】防御极高擅长贴身爆发<br>点<b>角色卡</b>可看完整面板（血量/算力/防御/速度）与技能详情 → 再点下方出战空格放入', highlight: '.roster-card' },
    { id: 'confirm',        text: '② 选择好出战角色后，点击【确认出战】进入战斗', highlight: null },
    { id: 'start-round',    text: '③ 点击【▶ 开始回合】开始本回合。<b>速度决定行动顺序</b>——速度高的先出手；回合开始敌方头顶会显示 <b>🔮 预计使用</b> 徽章，预告它本回合将用的技能，可用来预判布防', highlight: '#nextRoundBtn' },
    { id: 'pick-skill',     text: '④ 从下方技能按钮选一个技能。每个技能标注：<b>基础伤害 + 每枚硬币加成</b>、<b>硬币数</b>（掷硬币，正面越多伤害越高，也决定最多选几个目标）、<b>攻击距离</b>、<b>消耗算力</b>（不足无法使用）', highlight: '.skill-btn' },
    { id: 'pick-target',    text: '⑤ 点击射程内的敌方角色卡选目标（<b>目标数 = 硬币数</b>）；点错再点一下可取消。部分技能会附加<b>状态效果</b>（如燃烧、恶），卡片下方会出现彩色角标，点击可查看详情', highlight: '.character-card.selectable' },
    { id: 'confirm-action', text: '⑥ 选好目标后，点击【✅ 确认】执行技能', highlight: '#confirmTargetBtn' },
    { id: 'defense',        text: '⑦ 看敌方出手——<b>【普通示范】</b>会被你的防御减免（伤害不足防御时完全「格挡」为0）；<b>【破防示范】</b>无视防御直接命中。此外还有<b>真实伤害</b>（如燃烧），无视防御与减伤直接扣血', highlight: null, dismissable: true },
    // v0.63：情感激荡教学步——玩家出招+1、受击+1 后展示（防御步与状态步之间插入）；
    //        敌我通用机制（训练木偶也累积）；文本按玩家实际情感等级动态生成（模板三防高受击0不触发，等级可能只有1）
    { id: 'emotion',        text: emotionTutorialText, highlight: '.emotion-line', dismissable: true, okAdvance: true },
    // v0.65：新增「状态与持续伤害」图文讲解步——Buff/燃烧/混乱/被动在教程关无法实操演示，用图文讲清；
    //        插在 emotion(⑧) 与 skip-turn 之间，emotion 点「知道了」→ okAdvance 自动推进到此步，无需新钩子
    { id: 'buff-dot',       text: '⑨ 📚 <b>状态与持续伤害</b>：很多技能会附加状态（Buff）——卡片下方出现彩色角标，点击可看详情。常见有：<b>「燃烧」</b>（每回合末造成 等级×50 真实伤害）、<b>「恶」</b>（每层使鲁盼旋无视对方 50 防御）、<b>「混乱」</b>（被攻击时反噬真实伤害）、「昏迷」（跳过行动）。此外，<b>被动</b>——部分角色自带被动，战斗中自动触发，可在角色详情查看', highlight: null, dismissable: true, okAdvance: true },
    { id: 'skip-turn',      text: '⑩ 不想出手时，点【⏭ 跳过本回合】直接结束本角色行动——这里试一次', highlight: '#skipTurnBtn' },
    // v0.65：新增「待命与补位」图文讲解步——待命/补位机制进教程（用户指定），图文讲清即可
    { id: 'bench',          text: '⑪ 🚑 <b>待命与补位</b>：部分关卡的敌人带「＋X 待命」——前方角色阵亡后，待命角色会在<b>下一回合开始</b>入场补位；我方个别关卡也有待命区。注意：要<b>击败全部敌人（含待命角色）</b>才算胜利', highlight: null, dismissable: true, okAdvance: true },
    { id: 'free',           text: '⑫ 教学完成！自由战斗到胜利吧——胜利后<b>结算页</b>可查看伤害统计、Dot 明细与完整战斗日志', highlight: null, end: true }
];

// v0.63：情感激荡教学弹窗文本（读取玩家出战角色实际情感等级，精确显示 Lv1/Lv2 两种情况）
function emotionTutorialText() {
    const me = (typeof battleState !== 'undefined' && battleState.playerTeam.find(c => c.alive)) || null;
    const lv = me ? me.emotionLevel : 0;
    // 模板一/二被木偶命中扣血 → Lv2；模板三防御300普通示范0伤害 → 只出招 Lv1
    const lvPart = lv >= 2
        ? '出招 +1、被木偶命中扣血 +1 → 已升至 <b>Lv 2</b>，基础伤害 <b>+50</b>！'
        : `出招 +1 → 已累积 <b>Lv ${lv}</b>（防御太高木偶没打伤你），被命中扣血或击杀还会继续升级`;
    return `⑧ 💢 <b>情感激荡</b>（敌我通用）：战斗中<b>攻击、受击、击杀、队友死亡</b>都会 +1 级。<br>` +
        `你的角色${lvPart}<br>` +
        `看<b>训练木偶</b>的卡片——它也有「情感激荡」！（敌方同样会累积）<br>` +
        `等级加成：Lv 2 基础伤害 +50、Lv 4 算力回复 +50（覆盖式）。<br>` +
        `点【知道了】继续 → 下一课「状态与持续伤害」`;
}

const Tutorial = {
    active: false,
    step: null,
    collapsed: false,   // v0.61：手机端收起态——收成一条标题栏不挡战斗画面（每步展示时自动复位展开）
    isTutorial: () => typeof battleState !== 'undefined' && battleState.currentLevel === -2,
    // 由 confirmLevel 保证仅在教程关(currentSelectedLevel === -2)调用；
    // 此处不能依赖 battleState.currentLevel（选角阶段尚未 startBattle，仍为旧值）
    begin() {
        this.active = true;
        this.step = TUTORIAL_STEPS[0].id;
        this.showCurrent();
    },
    // 完成当前步骤 → 推进到下一步并显示对应弹窗；已是结束步则结束
    advance(id) {
        if (!this.active || this.step !== id) return;
        const i = TUTORIAL_STEPS.findIndex(s => s.id === id);
        if (i < 0 || i + 1 >= TUTORIAL_STEPS.length) { this.end(); return; }
        this.step = TUTORIAL_STEPS[i + 1].id;
        this.showCurrent();
    },
    showCurrent() {
        const def = TUTORIAL_STEPS.find(s => s.id === this.step);
        if (def) this.show(def);
        else this.end();
    },
    show(def) {
        const overlay = document.getElementById('tutorialOverlay');
        if (!overlay) return;
        this.collapsed = false;   // v0.61：每步展示自动展开，玩家收起只影响当前步
        document.getElementById('tutorialStepNum').textContent =
            `🎓 新手教程 · 步骤 ${TUTORIAL_STEPS.findIndex(s => s.id === def.id) + 1} / ${TUTORIAL_STEPS.length}`;
        document.getElementById('tutorialText').innerHTML = renderGlossaryText(typeof def.text === 'function' ? def.text() : def.text);
        // v0.65：点状步骤进度条（桌面 ≥901 显示；手机端 display:none 保高度预算）
        this.renderProgress();
        // 结束步（自由练习）：解除强制，弹窗可手动关闭
        if (def.end) this.active = false;
        const okBtn = document.getElementById('tutorialOkBtn');
        okBtn.style.display = (def.dismissable || def.end) ? 'block' : 'none';
        this.clearHighlight();
        overlay.style.display = 'block';
        // v0.61：选角页（步骤①）在竖屏贴底部空档，避免盖住顶部出战槽位；战斗页保持贴顶部
        // v0.662：贴边/限高统一收进 syncPosition()（页面切换/尺寸变化后也可重算，修复弹窗遮挡）
        this.updateCollapseUI();   // v0.61：同步收起态与 ▾/▸ 按钮
        this.syncPosition();       // v0.662：重算贴边位置与战斗页限高
        if (def.highlight) {
            // 目标元素可能尚未渲染（如技能按钮），延迟一拍再高亮
            setTimeout(() => this.highlight(def.highlight), 80);
        }
    },
    // v0.662：弹窗位置/限高同步（修复手机端教程关遮挡问题）：
    // ① 竖屏选角页仅步骤①贴底（此时「确认出战」在弹窗上方，不冲突）；步骤②起改贴顶——
    //    点角色卡后详情面板展开会把「确认出战」按钮推入贴底弹窗下方，框体拦截点击（真实玩家点不到）；
    // ② 战斗页（≤900 触屏布局）弹窗动态限高至与它水平相交的第一张角色卡顶边，正文压缩内部滚动，
    //    保证弹窗永不遮住角色卡（修复竖屏步骤⑧情感激荡弹窗遮卡 50%、667 横屏图文步遮木偶卡）；
    // ③ 由 show()、ui.js showPage()、窗口 resize/orientationchange、收起/展开统一调用，
    //    页面切换后立即重算（修复步骤③弹窗带 .tutorial-select 残留贴底的时序问题）。
    syncPosition() {
        const overlay = document.getElementById('tutorialOverlay');
        if (!overlay || overlay.style.display === 'none') return;
        const def = TUTORIAL_STEPS.find(s => s.id === this.step) || null;
        const selectPage = document.getElementById('pageSelectChar');
        const battlePage = document.getElementById('pageBattle');
        const onSelect = !!(selectPage && selectPage.classList.contains('active'));
        const onBattle = !!(battlePage && battlePage.classList.contains('active'));
        if (def) overlay.dataset.step = def.id;
        overlay.classList.toggle('tutorial-select', onSelect && def && def.id === 'char-select');
        overlay.classList.toggle('tutorial-battle', onBattle);
        const popup = overlay.querySelector('.buff-popup');
        if (!popup) return;
        if (onBattle && window.innerWidth <= 900) {
            // 与弹窗水平相交的卡片中取最靠上者：弹窗限高到其顶边，保证垂直方向永不遮卡；
            // 无相交（如 844 横屏卡片居左、弹窗居右）则不限高，正文可完整展示
            const ovBox = overlay.getBoundingClientRect();
            const cards = [...document.querySelectorAll('.all-characters .character-card')]
                .filter(c => c.getBoundingClientRect().height > 0);
            let limit = null;
            cards.forEach(c => {
                const b = c.getBoundingClientRect();
                const hOverlap = Math.min(b.right, ovBox.right) - Math.max(b.left, ovBox.left);
                if (hOverlap > 4) {
                    const l = Math.floor(b.top - ovBox.top - 4);
                    limit = limit === null ? l : Math.min(limit, l);
                }
            });
            popup.style.maxHeight = (limit !== null)
                ? Math.max(80, Math.min(limit, Math.round(window.innerHeight * 0.5))) + 'px'
                : '';
            // 限高激活时解除正文固定上限（改由 flex 收缩滚动）；未激活保持断点正文上限，不高耸遮底部面板
            overlay.classList.toggle('tutorial-clipped', limit !== null);
        } else {
            popup.style.maxHeight = '';
            overlay.classList.remove('tutorial-clipped');
        }
    },
    highlight(selector) {
        this.clearHighlight();
        document.querySelectorAll(selector).forEach(el => el.classList.add('tutorial-highlight'));
    },
    clearHighlight() {
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
    },
    // v0.65：点状步骤进度条——每步一个圆点，当前步 .current 金色高亮、已过步 .done（手机端 ≤900 隐藏）
    renderProgress() {
        const bar = document.getElementById('tutorialProgress');
        if (!bar) return;
        const idx = TUTORIAL_STEPS.findIndex(s => s.id === this.step);
        bar.innerHTML = TUTORIAL_STEPS.map((s, i) =>
            `<span class="dot${i === idx ? ' current' : (i < idx ? ' done' : '')}"></span>`
        ).join('');
    },
    // v0.61：收起/展开切换 + UI 同步（收起态由 #tutorialOverlay.collapsed 驱动 CSS 隐藏正文）
    toggleCollapse() {
        this.collapsed = !this.collapsed;
        this.updateCollapseUI();
        this.syncPosition();   // v0.662：展开时重算战斗页限高，避免遮卡
    },
    updateCollapseUI() {
        const overlay = document.getElementById('tutorialOverlay');
        if (!overlay) return;
        overlay.classList.toggle('collapsed', this.collapsed);
        const btn = document.getElementById('tutorialToggleBtn');
        if (btn) btn.textContent = this.collapsed ? '▸' : '▾';
    },
    // 关闭弹窗：强制步骤不可关（做操作才推进）；可关闭步骤点按钮/✕/遮罩关闭
    // v0.63：okAdvance 标记的讲解步（如情感激荡）点「知道了」→ 推进到下一步（showCurrent 会清高亮并显示新弹窗）
    hide() {
        if (this.active) {
            const def = TUTORIAL_STEPS.find(s => s.id === this.step);
            if (def && !def.dismissable && !def.end) return;
            if (def && def.okAdvance) { this.advance(this.step); return; }
        }
        this.clearHighlight();
        const overlay = document.getElementById('tutorialOverlay');
        if (overlay) overlay.style.display = 'none';
    },
    end() {
        this.active = false;
        this.collapsed = false;   // v0.61：复位收起态
        this.clearHighlight();
        const overlay = document.getElementById('tutorialOverlay');
        if (overlay) {
            overlay.style.display = 'none';
            const popup = overlay.querySelector('.buff-popup');
            if (popup) popup.style.maxHeight = '';   // v0.662：清理战斗页限高，避免残留影响后续弹窗
        }
    }
};

// v0.662：窗口尺寸/横竖屏切换后重算弹窗贴边位置与限高（贴边断点可能随视口变化）
window.addEventListener('resize', () => Tutorial.syncPosition());
window.addEventListener('orientationchange', () => setTimeout(() => Tutorial.syncPosition(), 120));
