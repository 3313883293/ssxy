// tutorial.js - 新手教程教学引导状态机（v0.310 教程关 level === -2；v0.65 扩为 12 步）
//
// ==================== v0.694 架构：声明式步骤表 + 事件通知 ====================
// 旧实现的病根：推进判据是「当前步 id」散落在 5 个文件的 10 处特判里（各处自行比较当前步 id 后调 advance），
// 自证式接口 advance(id) 一旦漏改就**静默卡死且无任何报错**；步骤编号 ①~⑫ 还硬编码在文案里，
// 与步骤号/进度条三处不同源。本版把「谁在什么时候调我」从业务代码里整体搬进本文件的步骤表：
//
// ① 步骤表 TUTORIAL_STEPS 只声明语义，不含任何调用点知识：
//      { id, page: 'select'|'battle', text, mode: 'force'|'info'|'end', advanceOn, refreshOn, gates, highlight }
//    mode 语义：force = 强制步（无「知道了」、✕ 不可关，只能靠 advanceOn 事件推进）；
//               info  = 图文步（可 ✕/「知道了」关闭；**声明了 advanceOn 就只关不推进**，未声明则关闭即推进）；
//               end   = 结束步（显示「知道了」，点击关闭教学，active = false）。
// ② 业务代码只发事件：tutNotify(TUT_EVENTS.XXX)（一行、不带步骤 id、无需 typeof 守卫）——
//    推进（advanceOn）/ 每回合重刷（refreshOn）/ 按钮门控（gate）全由本文件比对，改步骤顺序或增删步骤
//    只需动这张表，charSelect / battleFlow / battleActions / battleUI 零改动。
// ③ 编号自动生成：文案不再硬编码 ①~⑫，由 TUTORIAL_NUMBERING[步骤索引] 生成，
//    与「步骤 N / 12」标题、进度条圆点三者同源（改顺序不会留下编号错位）。
// ④ 推进可观测：notify/advance 未命中写入 Tutorial.trace（+ console.debug），异常写 Tutorial.warnings（+ console.warn）——
//    不再出现「教程静默卡住却没有任何报错」。
// ⑤ 步骤表自检：载入时 Tutorial.selfCheck() 校验 id 唯一 / 事件唯一 / 推进来源 / 字段合法 / gates 显式声明，
//    问题数组写入 warnings 并 console.warn；验证脚本可直接断言 issues.length === 0。
// ⑥ 教程进度存档（v0.694）：pwgame_tutorial_step 记录当前步，pwgame_tutorial_done 记录已完成；
//    刷新后从主界面「继续战斗」或在教程关点「再来一局」都会恢复到离开时的那一步（原先完全没有引导）。
//    这两个 key 独立于 pwgame_battle_save，不改战斗存档结构。

// ==================== 事件常量（业务代码唯一需要认识的东西） ====================
const TUT_EVENTS = {
    CHAR_SLOTTED:     'char-slotted',      // 选角页：角色填入出战槽
    LEVEL_CONFIRMED:  'level-confirmed',   // 选角页：点【确认出战】
    ROUND_STARTED:    'round-started',     // 战斗页：点【▶ 开始回合】（每回合开始时）
    SKILL_PICKED:     'skill-picked',      // 选定技能（进入选目标阶段）
    TARGET_PICKED:    'target-picked',     // 首次选中一个敌方目标
    ACTION_CONFIRMED: 'action-confirmed',  // 点【✅ 确认】执行技能
    ENEMY_ACTED:      'enemy-acted',       // 敌方出手结算完成
    TURN_SKIPPED:     'turn-skipped'       // 点【⏭ 跳过本回合】
};
// 事件名清单（notify 校验与自检用；由上面的常量表派生，避免第二处事实来源）
const TUT_EVENT_NAMES = Object.keys(TUT_EVENTS).map(k => TUT_EVENTS[k]);

// 业务代码发事件入口：一行、不带步骤 id。tutorial.js 在 index.html 里先于其余业务文件加载，
// 内部仍做 typeof 兜底，任何调用点都不需要再写守卫。
function tutNotify(ev) {
    if (typeof Tutorial !== 'undefined') Tutorial.notify(ev);
}

// 步骤编号表（自动编号的唯一来源；步骤数超过表长时 selfCheck 会告警）
const TUTORIAL_NUMBERING = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];

// ==================== 步骤表 ====================
const TUTORIAL_STEPS = [
    // ① 选角：本次只 1 个出战槽；点角色卡看面板/技能/被动 → 点空格放入
    { id: 'char-select',    page: 'select', mode: 'force', advanceOn: TUT_EVENTS.CHAR_SLOTTED, gates: { skipTurn: false }, highlight: '.roster-card',
      text: '本关只需选<b>1 名角色</b>出战。三模板定位：<br>模板一【均衡】中速中防 / 模板二【高速远程】速度快但身板脆 / 模板三【近战爆发】防御极高擅长贴身爆发<br>点<b>角色卡</b>可看完整面板（血量/算力/防御/速度）、技能与被动 → 再点下方出战空格放入' },
    // ② 确认出战
    { id: 'confirm',        page: 'select', mode: 'force', advanceOn: TUT_EVENTS.LEVEL_CONFIRMED, gates: { skipTurn: false }, highlight: null,
      text: '选好出战角色后，点下方【确认出战】进入战斗。教程关只有 1 名角色对 1 个敌人，可以放心试错' },
    // ③ 开始回合：行动顺序 + 速度区间重随机 + 意图徽章
    { id: 'start-round',    page: 'battle', mode: 'force', advanceOn: TUT_EVENTS.ROUND_STARTED, gates: { skipTurn: false }, highlight: '#nextRoundBtn',
      text: '点击【▶ 开始回合】开始本回合。<b>速度决定行动顺序</b>：速度高的先出手，而且每回合开始时会在本角色的速度区间内重新随机（点角色卡可看区间）。敌方头顶的 <b>🔮 预计使用</b> 徽章会预告它本回合要用的技能，可用来预判布防' },
    // ④ 选技能：基础伤害/每硬币加成/硬币数/攻击距离/消耗算力
    { id: 'pick-skill',     page: 'battle', mode: 'force', advanceOn: TUT_EVENTS.SKILL_PICKED, gates: { skipTurn: false }, highlight: '.skill-btn',
      text: '从下方技能按钮选一个技能。每个技能标注：<b>基础伤害 + 每枚硬币加成</b>、<b>硬币数</b>（掷硬币，正面越多伤害越高，也决定最多选几个目标）、<b>攻击距离</b>、<b>消耗算力</b>（算力不足则无法使用）' },
    // ⑤ 选目标：目标数 = 硬币数；状态角标读法（教程关三模板无状态技 → 只讲读法，具体状态见 ⑨）
    { id: 'pick-target',    page: 'battle', mode: 'force', advanceOn: TUT_EVENTS.TARGET_PICKED, gates: { skipTurn: false }, highlight: '.character-card.selectable',
      text: '点击射程内的敌方角色卡选目标（<b>目标数 = 硬币数</b>）；点错再点一下可取消。命中后附加的状态会显示成卡片下方的<b>彩色角标</b>，点角标可以查看它是什么' },
    // ⑥ 确认执行
    { id: 'confirm-action', page: 'battle', mode: 'force', advanceOn: TUT_EVENTS.ACTION_CONFIRMED, gates: { skipTurn: false }, highlight: '#confirmTargetBtn',
      text: '选好目标后，点【✅ 确认】执行技能；点【❌ 取消】可以重新选技能' },
    // ⑦ 防御机制（图文步：可在敌方出手前关掉，敌方出手结算后自动推进）
    { id: 'defense',        page: 'battle', mode: 'info',  advanceOn: TUT_EVENTS.ENEMY_ACTED, gates: { skipTurn: false }, highlight: null,
      text: '看敌方出手——<b>【普通示范】</b>会被你的防御减免，伤害不超过防御时完全「格挡」为 0；<b>【破防示范】</b>无视防御直接命中。此外还有<b>真实伤害</b>（如「燃烧」），无视防御与减伤直接扣血' },
    // ⑧ 情感激荡（文本按玩家实际情感等级动态生成；点「知道了」推进）
    { id: 'emotion',        page: 'battle', mode: 'info',  gates: { skipTurn: false }, highlight: '.emotion-line', text: emotionTutorialText },
    // ⑨ 状态与持续伤害 + 被动（v0.694：长解释交给可点词条与机制图鉴，本条只留「是什么 / 怎么读」）
    { id: 'buff-dot',       page: 'battle', mode: 'info',  gates: { skipTurn: false }, highlight: null,
      text: '📚 <b>状态与持续伤害</b>：技能命中会附加状态，显示成卡片下方的彩色角标——点角标就能看它是什么。持续伤害有三种：<b>「燃烧」</b>（回合结束时造成 等级×50 真实伤害）、<b>「混乱」</b>（受到伤害后按本次攻击的硬币数反噬）、<b>「创伤」</b>（自己投币时伤口崩裂）——它们无视防御与减伤。控制类「昏迷」（轮到行动时跳过本次行动）；<b>「恶」</b>在伤害计算时每层使鲁盼旋无视对方 50 防御。<br>此外，<b>被动</b>——满足条件自动触发，不用你点；点角色卡可看它的被动与状态，主界面【📖 机制图鉴】里有全部状态一览' },
    // ⑩ 跳过本回合：强制步，但按钮只在轮到该角色行动时渲染 → refreshOn 每回合重刷弹窗与高亮
    { id: 'skip-turn',      page: 'battle', mode: 'force', advanceOn: TUT_EVENTS.TURN_SKIPPED, refreshOn: TUT_EVENTS.ROUND_STARTED, gates: { skipTurn: true }, highlight: '#skipTurnBtn',
      text: '不想出手时，点【⏭ 跳过本回合】直接结束本角色行动——这里试一次' },
    // ⑪ 待命与补位（图文步）：每边至多 3 名 + 下一回合开始补位 + 胜利条件含待命角色
    { id: 'bench',          page: 'battle', mode: 'info',  gates: { skipTurn: false }, highlight: null,
      text: '🚑 <b>待命与补位</b>：场上每边至多 <b>3 名</b>，其余放在<b>待命区</b>。部分关卡的敌人带「＋X 待命」——前方角色死亡后，待命角色会在<b>下一回合开始</b>入场补位；我方 Boss 关也能带 1 名待命。注意：要<b>击败全部敌人（含待命角色）</b>才算胜利' },
    // ⑫ 自由练习（结束步）：结算页 + 星级/特殊胜利 + 自动存档与「继续战斗」
    { id: 'free',           page: 'battle', mode: 'end',   gates: { skipTurn: true }, highlight: null,
      text: '教学完成！自由战斗到胜利吧——胜利后<b>结算页</b>可查看伤害统计、Dot 明细与完整战斗日志。正式关卡通关得 1 星、达成<b>特殊胜利</b>再加 1 星（条件见关卡简介）；每回合开始都会自动存档，中途退出后主界面会出现【▶️ 继续战斗】接着打' }
];

// v0.694：mode → 派生字段（单一事实来源仍是 mode；渲染与外部读取统一走这三个派生量）
//   dismissable 可关闭（info/end）／okAdvance 点「知道了」即推进（info 且未声明 advanceOn）／end 结束步
TUTORIAL_STEPS.forEach(s => {
    s.dismissable = (s.mode === 'info' || s.mode === 'end');
    s.okAdvance = (s.mode === 'info' && !s.advanceOn);
    s.end = (s.mode === 'end');
});

// ⑧ 情感激荡教学弹窗文本（读取玩家出战角色实际情感等级，精确显示 Lv1/Lv2 两种情况）
function emotionTutorialText() {
    const me = (typeof battleState !== 'undefined' && battleState.playerTeam.find(c => c.alive)) || null;
    const lv = me ? me.emotionLevel : 0;
    // 模板一/二被木偶命中扣血 → Lv2；模板三防御300普通示范0伤害 → 只出招 Lv1
    const lvPart = lv >= 2
        ? '出招 +1、被木偶命中扣血 +1 → 已升至 <b>Lv 2</b>，基础伤害 <b>+50</b>！'
        : `出招 +1 → 已累积 <b>Lv ${lv}</b>（防御太高，木偶没打伤你），被命中扣血或击杀还会继续升级`;
    return `💢 <b>情感激荡</b>（敌我通用）：战斗中<b>攻击、受击、击杀、队友死亡</b>各 +1 级。<br>` +
        `你的角色${lvPart}<br>` +
        `看<b>训练木偶</b>的卡片——它也有「情感激荡」！（敌方同样会累积）<br>` +
        `档位加成：Lv 2 基础伤害 +50、Lv 4 算力回复 +50（覆盖式，完整档位点词条看）。<br>` +
        `点【知道了】继续 → 下一课「状态与持续伤害」`;
}

// ==================== 教程进度存档（v0.694，独立于 pwgame_battle_save） ====================
const TUTORIAL_STEP_KEY = 'pwgame_tutorial_step';
const TUTORIAL_DONE_KEY = 'pwgame_tutorial_done';

const Tutorial = {
    active: false,
    step: null,
    collapsed: false,   // v0.61：手机端收起态——收成一条标题栏不挡战斗画面（每步展示时自动复位展开）
    trace: [],          // v0.694：推进可观测性（有界环形缓冲：begin/advance/refresh/miss/inactive）
    warnings: [],       // v0.694：自检与运行时异常（高亮目标缺失、事件名未知、advance 未命中…）
    // 由 confirmLevel 保证仅在教程关(currentSelectedLevel === -2)调用；
    // 此处不能依赖 battleState.currentLevel（选角阶段尚未 startBattle，仍为旧值）
    isTutorial: () => typeof battleState !== 'undefined' && battleState.currentLevel === -2,

    // v0.694：index 可选——读档 / 「继续战斗」/「再来一局」时用 Tutorial.resume() 恢复到离开时那一步
    begin(index = 0) {
        const i = Math.max(0, Math.min(index | 0, TUTORIAL_STEPS.length - 1));
        this.active = true;
        this.collapsed = false;
        this.step = TUTORIAL_STEPS[i].id;
        if (i === 0) this.clearDone();   // 从①重看教程 = 重新开始，清掉完成标记
        this._trace('begin', `index:${i}`);
        this.showCurrent();
    },
    // v0.694：读档 / 「继续战斗」/「再来一局」后恢复教学进度（已完成则不再打扰）
    resume() {
        if (this.active) return false;
        if (this.isDone()) { this._trace('resume-skip', 'done'); return false; }
        const idx = this.loadProgress();
        if (idx === null) { this._trace('resume-skip', 'nostep'); return false; }
        this.begin(idx);
        return true;
    },

    // ==================== 事件通知（业务代码唯一入口） ====================
    // 返回值：true = 本次事件被消费（推进或重刷）；false = 与本步无关或教程未激活
    notify(ev) {
        if (!TUT_EVENT_NAMES.includes(ev)) {
            this._warn(`notify(${ev}) 未知事件名：请使用 TUT_EVENTS 里的常量`);
            return false;
        }
        if (!this.active) { this._trace('inactive', ev); return false; }
        const def = this.current();
        if (!def) { this._warn(`notify(${ev}) 找不到当前步 ${this.step}`); return false; }
        if (def.advanceOn === ev) return this.advance(def.id, `event:${ev}`);
        if (def.refreshOn === ev) { this.showCurrent(); this._trace('refresh', ev, def.id); return true; }
        // 与本步无关的事件（每回合都会发生）：属正常情况，只记 trace 不告警
        this._trace('miss', ev, def.id);
        return false;
    },
    // 完成当前步骤 → 推进到下一步并显示对应弹窗；已是结束步则结束
    // v0.694：自证式接口——id 与当前步不符时不再静默 return，而是告警（漏改调用点会被立刻发现）
    advance(id, source) {
        if (!this.active) { this._warn(`advance(${id}) 未生效：教程未激活（来源 ${source || '直接调用'}）`); return false; }
        if (this.step !== id) {
            this._warn(`advance(${id}) 未生效：当前步为 ${this.step}（来源 ${source || '直接调用'}）——步骤 id 不匹配`);
            return false;
        }
        const i = this.indexOf(id);
        if (i < 0 || i + 1 >= TUTORIAL_STEPS.length) { this.end(); return true; }
        this.step = TUTORIAL_STEPS[i + 1].id;
        this._trace('advance', source || 'direct', id);
        this.showCurrent();
        return true;
    },
    // v0.694：按钮门控查询（战斗页「⏭ 跳过本回合」显隐等）——业务代码不再认识步骤 id。
    // 非教程关 / 教程未激活（自由练习）/ 该步未声明该 gate → 一律放行。
    gate(name) {
        if (!this.isTutorial()) return true;
        if (!this.active) return true;
        const def = this.current();
        if (!def) return true;
        const g = def.gates || {};
        return g[name] !== false;
    },

    // ==================== 渲染 ====================
    current() { return TUTORIAL_STEPS.find(s => s.id === this.step) || null; },
    indexOf(id) { return TUTORIAL_STEPS.findIndex(s => s.id === id); },
    numberOf(id) {
        const i = this.indexOf(id);
        return (i >= 0 && TUTORIAL_NUMBERING[i]) ? TUTORIAL_NUMBERING[i] : '';
    },
    showCurrent() {
        const def = this.current();
        if (def) this.show(def);
        else this.end();
    },
    show(def) {
        const overlay = document.getElementById('tutorialOverlay');
        if (!overlay) return;
        const idx = this.indexOf(def.id);
        this.collapsed = false;   // v0.61：每步展示自动展开，玩家收起只影响当前步
        document.getElementById('tutorialStepNum').textContent =
            `🎓 新手教程 · 步骤 ${idx + 1} / ${TUTORIAL_STEPS.length}`;
        // v0.694：编号由步骤索引生成（与上面「步骤 N / N」、进度条圆点同源），文案内不再硬编码 ①~⑫
        const raw = (typeof def.text === 'function') ? def.text() : def.text;
        document.getElementById('tutorialText').innerHTML =
            renderGlossaryText(`${TUTORIAL_NUMBERING[idx] || (idx + 1) + '.'} ${raw}`);
        // v0.65：点状步骤进度条（桌面 ≥901 显示；手机端 display:none 保高度预算）
        this.renderProgress();
        // v0.694：记录当前步（结束步随后被 markDone 清掉进度 key）
        this.saveProgress(idx);
        // 结束步（自由练习）：解除强制，弹窗可手动关闭；v0.694：写入完成标记并清掉进度（此后不再打扰）
        if (def.end) { this.active = false; this.markDone(); }
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
    // v0.694：贴底判据由 def.id === 'char-select' 改为 def.page === 'select'
    //    （CSS 侧 #tutorialOverlay.tutorial-select:not([data-step="char-select"]) 早已为「选角页其余步骤」写好贴顶兜底）。
    syncPosition() {
        const overlay = document.getElementById('tutorialOverlay');
        if (!overlay || overlay.style.display === 'none') return;
        const def = this.current();
        const selectPage = document.getElementById('pageSelectChar');
        const battlePage = document.getElementById('pageBattle');
        const onSelect = !!(selectPage && selectPage.classList.contains('active'));
        const onBattle = !!(battlePage && battlePage.classList.contains('active'));
        if (def) overlay.dataset.step = def.id;
        overlay.classList.toggle('tutorial-select', onSelect && !!def && def.page === 'select');
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
        const els = document.querySelectorAll(selector);
        // v0.694：目标不存在不再静默失效（技能按钮/角色卡/确认按钮都是运行时才渲染的元素）
        if (els.length === 0) {
            this._warn(`高亮目标未找到：${selector}（步骤 ${this.step}）`);
            return false;
        }
        els.forEach(el => el.classList.add('tutorial-highlight'));
        return true;
    },
    clearHighlight() {
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
    },
    // v0.65：点状步骤进度条——每步一个圆点，当前步 .current 金色高亮、已过步 .done（手机端 ≤900 隐藏）
    renderProgress() {
        const bar = document.getElementById('tutorialProgress');
        if (!bar) return;
        const idx = this.indexOf(this.step);
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
    // v0.63：okAdvance 标记的讲解步（如情感激荡）点「知道了」→ 推进到下一步
    // v0.694：判据改走 mode 派生字段（dismissable / okAdvance），行为不变
    hide() {
        if (this.active) {
            const def = this.current();
            if (def && !def.dismissable && !def.end) return;
            if (def && def.okAdvance) { this.advance(def.id, 'ok-button'); return; }
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
    },

    // ==================== 步骤表自检（v0.694） ====================
    // 返回问题数组（空数组 = 通过）；构造时已跑一次并写入 warnings
    selfCheck() {
        const issues = [];
        const ids = new Set();
        const events = new Set();
        const known = TUT_EVENT_NAMES;
        TUTORIAL_STEPS.forEach((s, i) => {
            const tag = s.id || `#${i + 1}`;
            if (!s.id) issues.push(`步骤 ${i + 1} 缺少 id`);
            else if (ids.has(s.id)) issues.push(`步骤 id 重复：${s.id}`);
            else ids.add(s.id);
            if (s.page !== 'select' && s.page !== 'battle') issues.push(`步骤 ${tag} 的 page 非法：${s.page}`);
            if (!['force', 'info', 'end'].includes(s.mode)) issues.push(`步骤 ${tag} 的 mode 非法：${s.mode}`);
            if (!s.text) issues.push(`步骤 ${tag} 缺少 text`);
            if (typeof s.text === 'string' && TUTORIAL_NUMBERING.some(n => s.text.includes(n))) {
                issues.push(`步骤 ${tag} 的文案内硬编码了编号（编号必须由步骤索引自动生成）`);
            }
            if (s.advanceOn) {
                if (!known.includes(s.advanceOn)) issues.push(`步骤 ${tag} 的 advanceOn 不是 TUT_EVENTS 事件：${s.advanceOn}`);
                else if (events.has(s.advanceOn)) issues.push(`推进事件重复：${s.advanceOn}（一步只声明一个推进事件）`);
                else events.add(s.advanceOn);
            }
            if (s.refreshOn && !known.includes(s.refreshOn)) issues.push(`步骤 ${tag} 的 refreshOn 不是 TUT_EVENTS 事件：${s.refreshOn}`);
            if (s.refreshOn && s.refreshOn === s.advanceOn) issues.push(`步骤 ${tag} 的 advanceOn 与 refreshOn 相同`);
            if (s.mode !== 'end') {
                // 推进来源：force 步必须声明 advanceOn；info 步未声明 advanceOn 时靠「知道了」推进（okAdvance）
                if (!s.advanceOn && s.mode !== 'info') issues.push(`步骤 ${tag} 没有任何推进来源`);
                if (!s.gates || typeof s.gates !== 'object') issues.push(`步骤 ${tag} 未声明 gates（按钮门控须显式声明）`);
            }
        });
        if (TUTORIAL_STEPS.length > TUTORIAL_NUMBERING.length) issues.push('步骤数超过编号表长度');
        return issues;
    },

    // ==================== 内部：可观测性 ====================
    _trace(action, ev, stepId) {
        const entry = `${action}${ev ? ' ' + ev : ''}${stepId ? ' @' + stepId : ''}`;
        this.trace.push(entry);
        if (this.trace.length > 60) this.trace.shift();
        try { console.debug(`[教程] ${entry}`); } catch (e) {}
    },
    _warn(msg) {
        this.warnings.push(msg);
        if (this.warnings.length > 40) this.warnings.shift();
        try { console.warn(`[教程] ${msg}`); } catch (e) {}
    },

    // ==================== 内部：进度存档 ====================
    saveProgress(idx) {
        try { localStorage.setItem(TUTORIAL_STEP_KEY, String(idx)); } catch (e) {}
    },
    loadProgress() {
        try {
            const raw = localStorage.getItem(TUTORIAL_STEP_KEY);
            if (raw === null) return null;
            const n = parseInt(raw, 10);
            if (isNaN(n) || n < 0 || n >= TUTORIAL_STEPS.length) return null;
            return n;
        } catch (e) { return null; }
    },
    markDone() {
        try { localStorage.setItem(TUTORIAL_DONE_KEY, '1'); localStorage.removeItem(TUTORIAL_STEP_KEY); } catch (e) {}
    },
    clearDone() {
        try { localStorage.removeItem(TUTORIAL_DONE_KEY); } catch (e) {}
    },
    isDone() {
        try { return localStorage.getItem(TUTORIAL_DONE_KEY) === '1'; } catch (e) { return false; }
    }
};

// v0.694：载入即自检（id 唯一 / 事件唯一 / 推进来源 / 字段合法 / gates 显式声明 / 文案无硬编码编号）
Tutorial.selfCheck().forEach(msg => Tutorial._warn(`步骤表自检失败：${msg}`));

// v0.662：窗口尺寸/横竖屏切换后重算弹窗贴边位置与限高（贴边断点可能随视口变化）
window.addEventListener('resize', () => Tutorial.syncPosition());
window.addEventListener('orientationchange', () => setTimeout(() => Tutorial.syncPosition(), 120));
