// audio.js（v0.308）——Web Audio API 合成音效库（零音频文件、零版权问题）
// 用法：Sfx.play('hit')；静音开关 Sfx.toggle()（v0.309：开关移入设置弹窗，状态持久化）；每次播放记录到 Sfx._log（headless 验证探针）
// 浏览器自动播放策略：AudioContext 在首次用户交互后才可靠出声——
// 所有合成调用包 try/catch，静音或不可用时静默跳过，不影响游戏逻辑

// 静音初始状态：读 localStorage（file:// 或隐私模式异常兜底为有声）
function sfxLoadMuted() {
    try { return localStorage.getItem('pwgame_sfx_muted') === '1'; } catch (e) { return false; }
}

// ==================== 合成工具 ====================

// 单音：振荡器 + 指数衰减包络（f0→f1 频率滑动，默认指数斜坡）
function sfxTone(ctx, { type = 'sine', f0, f1 = f0, dur = 0.2, vol = 0.2, when = 0 }) {
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, f0), t0);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
}

// 噪声：白噪声 buffer + 滤波（带通/低通）+ 指数衰减包络（f0→f1 滤波频率滑动）
function sfxNoise(ctx, { dur = 0.2, vol = 0.3, f0 = 2000, f1 = f0, type = 'bandpass', when = 0 }) {
    const t0 = ctx.currentTime + when;
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(Math.max(40, f0), t0);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t0);
}

// ==================== 音效表 ====================

const SFX_TABLE = {
    // 普攻/连线斩击：「嗖」——带通噪声短促下滑（刀/棍/枪挥击）
    strike: (c) => { sfxNoise(c, { dur: 0.18, vol: 0.25, f0: 1800, f1: 350 }); },
    // 一秒十八棍：18 次极短连击「哒哒哒哒…」
    multi: (c) => { for (let i = 0; i < 18; i++) sfxNoise(c, { dur: 0.05, vol: 0.18, f0: 2200, f1: 700, when: i * 0.055 }); },
    // 受击「咚」：低频三角波下坠 + 高频噪声壳
    hit: (c) => { sfxTone(c, { type: 'triangle', f0: 130, f1: 55, dur: 0.22, vol: 0.5 }); sfxNoise(c, { dur: 0.08, vol: 0.15, f0: 3000, f1: 1200, when: 0.01 }); },
    // 格挡「叮」：方波金属短音 + 八度泛音
    blocked: (c) => { sfxTone(c, { type: 'square', f0: 880, f1: 820, dur: 0.12, vol: 0.18 }); sfxTone(c, { type: 'sine', f0: 1760, dur: 0.1, vol: 0.07, when: 0.005 }); },
    // 死亡「轰」：锯齿波低频下坠 + 噪声爆炸
    death: (c) => { sfxTone(c, { type: 'sawtooth', f0: 160, f1: 40, dur: 0.5, vol: 0.45 }); sfxNoise(c, { dur: 0.4, vol: 0.4, f0: 900, f1: 100, type: 'lowpass' }); },
    // 十二连「刷刷刷」：12 次短打击快速连发（对应十二剑）
    slash: (c) => { for (let i = 0; i < 12; i++) sfxNoise(c, { dur: 0.07, vol: 0.2, f0: 2500, f1: 600, when: i * 0.07 }); },
    // 亮剑「铮」：金属上扫 + 斩击噪声
    slashSingle: (c) => { sfxTone(c, { type: 'sine', f0: 600, f1: 1200, dur: 0.15, vol: 0.15 }); sfxNoise(c, { dur: 0.15, vol: 0.22, f0: 2000, f1: 500, when: 0.02 }); },
    // 剑气「咻」：带通噪声上扫（呼啸穿行）
    swordWave: (c) => { sfxNoise(c, { dur: 0.5, vol: 0.3, f0: 300, f1: 2400 }); },
    // 开创「引擎加速冲过」：锯齿波频率上爬（加速感）+ 轰鸣噪声 + 撞击「砰」低频
    carRush: (c) => {
        sfxTone(c, { type: 'sawtooth', f0: 55, f1: 220, dur: 0.8, vol: 0.3 });
        sfxNoise(c, { dur: 0.6, vol: 0.12, f0: 800, f1: 3000 });
        sfxNoise(c, { dur: 0.15, vol: 0.5, f0: 2500, f1: 300, when: 0.3 });
        sfxTone(c, { type: 'sine', f0: 70, f1: 40, dur: 0.3, vol: 0.4, when: 0.3 });
    },
    // 持盾猛击/格挡反伤「咚」：低频闷响
    bash: (c) => { sfxTone(c, { type: 'sine', f0: 90, f1: 45, dur: 0.3, vol: 0.5 }); sfxNoise(c, { dur: 0.12, vol: 0.3, f0: 1500, f1: 250 }); },
    // 加油「叮咚」：上行双音（能量提升）
    buffUp: (c) => { sfxTone(c, { type: 'sine', f0: 523, dur: 0.12, vol: 0.18 }); sfxTone(c, { type: 'sine', f0: 659, dur: 0.15, vol: 0.18, when: 0.1 }); },
    // 刹车「吱——」：下行双音 + 摩擦噪声（制动感）
    buffDown: (c) => { sfxTone(c, { type: 'sine', f0: 494, dur: 0.15, vol: 0.18 }); sfxTone(c, { type: 'sine', f0: 392, dur: 0.18, vol: 0.18, when: 0.1 }); sfxNoise(c, { dur: 0.25, vol: 0.12, f0: 3000, f1: 900 }); },
    // 催眠气体：柔软长下行（雾气弥漫）
    gas: (c) => { sfxTone(c, { type: 'sine', f0: 500, f1: 180, dur: 0.8, vol: 0.15 }); },
    // 噼啪（snap 类短促声）
    snap: (c) => { sfxNoise(c, { dur: 0.06, vol: 0.3, f0: 4000, f1: 2000 }); },
    // 燃木火球（v0.5 火焰特效）：低频带通噪声上扫（火球呼啸飞出）+ 发射「噗」短噪声
    flame: (c) => { sfxNoise(c, { dur: 0.5, vol: 0.3, f0: 150, f1: 800, type: 'bandpass' }); sfxNoise(c, { dur: 0.12, vol: 0.22, f0: 2500, f1: 500, when: 0.04 }); },
    // 煽风火柱（v0.5 火焰特效）：多次随机小噪声脆响（火焰噼啪）+ 柔和带通噪声上扫（风声/火势）
    ember: (c) => { for (let i = 0; i < 6; i++) sfxNoise(c, { dur: 0.04, vol: 0.12, f0: 3000 + Math.random() * 2000, f1: 1000, when: i * 0.09 }); sfxNoise(c, { dur: 0.7, vol: 0.15, f0: 300, f1: 1500, type: 'bandpass' }); },
    // 引爆爆炸（v0.5 火焰特效）：锯齿波低频下坠（爆炸轰隆）+ 低通噪声爆轰 + 延迟二次回响
    bomb: (c) => { sfxTone(c, { type: 'sawtooth', f0: 120, f1: 30, dur: 0.6, vol: 0.5 }); sfxNoise(c, { dur: 0.5, vol: 0.45, f0: 1200, f1: 80, type: 'lowpass' }); sfxTone(c, { type: 'sine', f0: 60, f1: 25, dur: 0.7, vol: 0.35, when: 0.25 }); },
    // 回合开始：双音提示
    round: (c) => { sfxTone(c, { type: 'square', f0: 440, dur: 0.08, vol: 0.07 }); sfxTone(c, { type: 'square', f0: 660, dur: 0.1, vol: 0.07, when: 0.09 }); },
    // v0.674 王庄明「抵抗」：护盾嗡鸣（低频正弦起振 + 柔和上扫噪声）
    shieldUp: (c) => { sfxTone(c, { type: 'sine', f0: 220, f1: 440, dur: 0.4, vol: 0.2 }); sfxNoise(c, { dur: 0.3, vol: 0.08, f0: 800, f1: 2000 }); },
    // v0.674 王庄明「守护」：金盾钟鸣（方波金属泛音 + 八度共鸣）
    guardUp: (c) => { sfxTone(c, { type: 'square', f0: 660, f1: 620, dur: 0.5, vol: 0.15 }); sfxTone(c, { type: 'sine', f0: 1320, dur: 0.4, vol: 0.06, when: 0.02 }); },
    // v0.674 曹佳梦「手枪散射」：三连发「啪-啪-啪」（三次高频噪声短促）
    tripleShot: (c) => { for (let i = 0; i < 3; i++) sfxNoise(c, { dur: 0.06, vol: 0.25, f0: 3500, f1: 900, when: i * 0.09 }); },
    // v0.674 曹佳梦「精准狙击」：爆音——高频 crack + 长尾呼啸（远距离贯穿感）
    snipe: (c) => { sfxNoise(c, { dur: 0.1, vol: 0.4, f0: 5000, f1: 1500 }); sfxNoise(c, { dur: 0.4, vol: 0.15, f0: 2000, f1: 300, when: 0.05 }); },
    // v0.674 曹佳梦「创大运吧」：骰子叮铃（三连上行三角波，赌运响起）
    dice: (c) => { [880, 1047, 1319].forEach((f, i) => sfxTone(c, { type: 'triangle', f0: f, dur: 0.1, vol: 0.15, when: i * 0.08 })); },
    // v0.674 曹佳梦「陨星落下」：陨石坠落——锯齿长下坠 + 低通轰鸣 + 延迟大爆轰
    meteor: (c) => { sfxTone(c, { type: 'sawtooth', f0: 200, f1: 40, dur: 0.8, vol: 0.35 }); sfxNoise(c, { dur: 0.7, vol: 0.3, f0: 2000, f1: 100, type: 'lowpass', when: 0.15 }); sfxTone(c, { type: 'sine', f0: 50, f1: 20, dur: 0.9, vol: 0.5, when: 0.7 }); },
    // 胜利：上行琶音 C E G C
    victory: (c) => { [523, 659, 784, 1047].forEach((f, i) => sfxTone(c, { type: 'triangle', f0: f, dur: 0.22, vol: 0.2, when: i * 0.13 })); },
    // 失败：低沉下滑
    defeat: (c) => { sfxTone(c, { type: 'sawtooth', f0: 300, f1: 110, dur: 1.0, vol: 0.2 }); },
};

// 技能动画 type → 音效名（aura 按技能名细分加油/刹车/持盾格挡；v0.674 新角色专属演出）
const SKILL_SFX_MAP = {
    slash: 'slash', slashSingle: 'slashSingle', swordWave: 'swordWave', carRush: 'carRush',
    multi: 'multi', strike: 'strike', snap: 'snap', gas: 'gas',
    flameThrow: 'flame', emberRise: 'ember', fireBomb: 'bomb',   // v0.5 灼华火焰特效
    guardAura: 'guardUp', tripleShot: 'tripleShot', snipe: 'snipe', luckyDice: 'dice', meteorFall: 'meteor'   // v0.674
};
const AURA_SFX_BY_SKILL = { 加油: 'buffUp', 刹车: 'buffDown', 持盾格挡: 'bash', 抵抗: 'shieldUp' };   // v0.674 王庄明抵抗

// ==================== 全局对象 ====================

const Sfx = {
    ctx: null,
    muted: sfxLoadMuted(),    // v0.309：静音状态持久化（localStorage）
    _log: [],                 // 播放记录（headless 验证探针，顺带调试）

    // 懒创建 AudioContext（首次真实播放时）；浏览器策略下需用户交互后才有声
    ensureCtx() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
            return this.ctx;
        }
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            this.ctx = new AC();
        } catch (e) { this.ctx = null; }
        return this.ctx;
    },

    // 播放一个音效（按名字查表；静音/无 AudioContext/未知名全部静默跳过）
    play(name) {
        this._log.push(name);
        if (this.muted) return;
        const ctx = this.ensureCtx();
        if (!ctx) return;
        const fn = SFX_TABLE[name];
        if (!fn) return;
        try { fn(ctx); } catch (e) { /* 合成异常静默，不影响游戏 */ }
    },

    // 技能音：按 SKILL_ANIM_CONFIG.type 映射，aura 按技能名细分
    playSkill(skill) {
        if (!skill) return;
        const cfg = (typeof SKILL_ANIM_CONFIG !== 'undefined') ? SKILL_ANIM_CONFIG[skill.name] : null;
        const type = cfg ? cfg.type : 'strike';
        let name = SKILL_SFX_MAP[type];
        if (type === 'aura' && AURA_SFX_BY_SKILL[skill.name]) name = AURA_SFX_BY_SKILL[skill.name];
        if (name) this.play(name);
    },

    // 静音开关（v0.309：开关移入设置弹窗，由 toggleSfx() 调用；状态持久化）
    toggle() {
        this.muted = !this.muted;
        try { localStorage.setItem('pwgame_sfx_muted', this.muted ? '1' : '0'); } catch (e) { /* 同前兜底 */ }
        if (!this.muted) this.play('buffUp');   // 打开时给个反馈音
        return this.muted;
    }
};

if (typeof window !== 'undefined') {
    window.Sfx = Sfx;
    window.SFX_TABLE = SFX_TABLE;   // 暴露给验证脚本（顶层 const 不挂 window）
}
