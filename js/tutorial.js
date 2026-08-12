// tutorial.js - 新手教程教学引导状态机（v0.310 教程关 level === -2）
// 前半段强制引导：每步弹窗 + 目标高亮，做对应操作即自动推进（游戏流程天然强制）；
// 后半段（⑧）解除强制，自由练习到胜利。
const TUTORIAL_STEPS = [
    { id: 'char-select',    text: '① 本关只需选【1 名角色】出战。三个模板的定位：<br>· 模板一【均衡】— 中速中防，伤害稳定递增<br>· 模板二【高速远程】— 全场最快(速4~7)、多段连击，但较脆(防100)<br>· 模板三【近战爆发】— 防御最高(防300)、高耗高伤，贴身距离1<br>点下方【角色卡】→ 再点出战空格放入', highlight: '.roster-card' },
    { id: 'confirm',        text: '② 选择好出战角色后，点击【确认出战】进入战斗', highlight: null },
    { id: 'start-round',    text: '③ 点击【▶ 开始回合】，进入行动阶段', highlight: '#nextRoundBtn' },
    { id: 'pick-skill',     text: '④ 从下方技能按钮选一个技能——注意上方显示消耗算力与攻击距离', highlight: '.skill-btn' },
    { id: 'pick-target',    text: '⑤ 点击射程内的敌方角色卡选目标（目标数 = 硬币数）；点错再点一下可取消', highlight: '.character-card.selectable' },
    { id: 'confirm-action', text: '⑥ 选好目标后，点击【✅ 确认】执行技能', highlight: '#confirmTargetBtn' },
    { id: 'defense',        text: '⑦ 看敌方出手——【普通示范】会被你的防御(200)减免伤害，【破防示范】无视防御直接命中', highlight: null, dismissable: true },
    // v0.63：情感激荡教学步——玩家出招+1、受击+1 后展示（防御步与跳过回合步之间插入）；
    //        敌我通用机制（训练木偶也累积）；文本按玩家实际情感等级动态生成（模板三防高受击0不触发，等级可能只有1）
    { id: 'emotion',        text: emotionTutorialText, highlight: '.emotion-line', dismissable: true, okAdvance: true },
    { id: 'skip-turn',      text: '⑨ 不想出手时，点【⏭ 跳过本回合】直接结束本角色行动——这里试一次', highlight: '#skipTurnBtn' },
    { id: 'free',           text: '⑩ 教学完成！自由战斗到胜利吧——战斗中随时感受情感激荡的加成', highlight: null, end: true }
];

// v0.63：情感激荡教学弹窗文本（读取玩家出战角色实际情感等级，精确显示 Lv1/Lv2 两种情况）
function emotionTutorialText() {
    const me = (typeof battleState !== 'undefined' && battleState.playerTeam.find(c => c.alive)) || null;
    const lv = me ? me.emotionLevel : 0;
    // 模板一/二被木偶命中扣血 → Lv2；模板三防御300普通示范0伤害 → 只出招 Lv1
    const lvPart = lv >= 2
        ? '出招 +1、被木偶命中扣血 +1 → 已升至 <b>Lv2</b>，基础伤害 <b>+50</b>！'
        : `出招 +1 → 已累积 <b>Lv${lv}</b>（防御太高木偶没打伤你），被命中扣血或击杀还会继续升级`;
    return `⑧ 💢 <b>情感激荡</b>（敌我通用）：战斗中<b>攻击、受击、击杀、队友死亡</b>都会 +1 级。<br>` +
        `你的角色${lvPart}<br>` +
        `看<b>训练木偶</b>的卡片——它也有「情感激荡」！（敌方同样会累积）<br>` +
        `等级加成：Lv2 基础伤害 +50、Lv4 算力回复 +50（覆盖式）。<br>` +
        `点【知道了】继续 → 下一课「跳过回合」`;
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
        // 结束步（自由练习）：解除强制，弹窗可手动关闭
        if (def.end) this.active = false;
        const okBtn = document.getElementById('tutorialOkBtn');
        okBtn.style.display = (def.dismissable || def.end) ? 'block' : 'none';
        this.clearHighlight();
        overlay.style.display = 'block';
        // v0.61：选角页（步骤①②）在竖屏贴底部空档，避免盖住顶部出战槽位；战斗页保持贴顶部
        const selectPage = document.getElementById('pageSelectChar');
        overlay.classList.toggle('tutorial-select', !!(selectPage && selectPage.classList.contains('active')));
        this.updateCollapseUI();   // v0.61：同步收起态与 ▾/▸ 按钮
        if (def.highlight) {
            // 目标元素可能尚未渲染（如技能按钮），延迟一拍再高亮
            setTimeout(() => this.highlight(def.highlight), 80);
        }
    },
    highlight(selector) {
        this.clearHighlight();
        document.querySelectorAll(selector).forEach(el => el.classList.add('tutorial-highlight'));
    },
    clearHighlight() {
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
    },
    // v0.61：收起/展开切换 + UI 同步（收起态由 #tutorialOverlay.collapsed 驱动 CSS 隐藏正文）
    toggleCollapse() {
        this.collapsed = !this.collapsed;
        this.updateCollapseUI();
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
        if (overlay) overlay.style.display = 'none';
    }
};
