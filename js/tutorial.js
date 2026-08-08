// tutorial.js - 新手教程教学引导状态机（v0.310 教程关 level === -2）
// 前半段强制引导：每步弹窗 + 目标高亮，做对应操作即自动推进（游戏流程天然强制）；
// 后半段（⑧）解除强制，自由练习到胜利。
const TUTORIAL_STEPS = [
    { id: 'char-select',    text: '① 本关只需选【1 名角色】出战。三个模板的定位：<br>· 模板一【均衡】— 中速中防，伤害稳定递增<br>· 模板二【高速远程】— 全场最快(速4~7)、多段连击，但较脆(防100)<br>· 模板三【近战爆发】— 防御最高(防300)、高耗高伤，贴身距离1<br>点下方【角色卡】→ 再点出战空格放入', highlight: '.roster-card' },
    { id: 'confirm',        text: '② 选择好出战角色后，点击【确认出战】进入战斗', highlight: null },
    { id: 'start-round',    text: '③ 点击【▶ 开始回合】，进入行动阶段', highlight: '#nextRoundBtn' },
    { id: 'pick-skill',     text: '④ 从下方技能按钮选一个技能——注意上方显示消耗算力 SP 与攻击距离', highlight: '.skill-btn' },
    { id: 'pick-target',    text: '⑤ 点击射程内的敌方角色卡选目标（目标数 = 硬币数）；点错再点一下可取消', highlight: '.character-card.selectable' },
    { id: 'confirm-action', text: '⑥ 选好目标后，点击【✅ 确认】执行技能', highlight: '#confirmTargetBtn' },
    { id: 'defense',        text: '⑦ 看敌方出手——【普通示范】会被你的防御(200)减免伤害，【破防示范】无视防御直接命中', highlight: null, dismissable: true },
    { id: 'skip-turn',      text: '⑧ 不想出手时，点【⏭ 跳过本回合】直接结束本角色行动——这里试一次', highlight: '#skipTurnBtn' },
    { id: 'free',           text: '⑨ 教学完成！自由战斗到胜利吧', highlight: null, end: true }
];

const Tutorial = {
    active: false,
    step: null,
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
        document.getElementById('tutorialStepNum').textContent =
            `🎓 新手教程 · 步骤 ${TUTORIAL_STEPS.findIndex(s => s.id === def.id) + 1} / ${TUTORIAL_STEPS.length}`;
        document.getElementById('tutorialText').innerHTML = renderGlossaryText(def.text);
        // 结束步（自由练习）：解除强制，弹窗可手动关闭
        if (def.end) this.active = false;
        const okBtn = document.getElementById('tutorialOkBtn');
        okBtn.style.display = (def.dismissable || def.end) ? 'block' : 'none';
        this.clearHighlight();
        overlay.style.display = 'block';
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
    // 关闭弹窗：强制步骤不可关（做操作才推进）；可关闭步骤点按钮/✕/遮罩关闭
    hide() {
        if (this.active) {
            const def = TUTORIAL_STEPS.find(s => s.id === this.step);
            if (def && !def.dismissable && !def.end) return;
        }
        this.clearHighlight();
        const overlay = document.getElementById('tutorialOverlay');
        if (overlay) overlay.style.display = 'none';
    },
    end() {
        this.active = false;
        this.clearHighlight();
        const overlay = document.getElementById('tutorialOverlay');
        if (overlay) overlay.style.display = 'none';
    }
};
