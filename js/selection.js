// selection.js - 选角模式设置 + 通用选取模块（我方/敌方共用）
// 说明：设置界面可切换选角模式（一步式/两步式，localStorage 持久化）；敌我选取走同一套模块，仅由配置差异区分

// ==================== 选角模式（默认两步式，localStorage 持久化） ====================
let selectionMode = 'two-step';   // 'one-step' | 'two-step'
try {
    const saved = localStorage.getItem('pwgame_select_mode');
    if (saved === 'one-step' || saved === 'two-step') selectionMode = saved;
} catch (e) { /* file:// 或隐私模式下 localStorage 不可用，保持默认 */ }

// 函数声明（成为 window 属性），供 HTML 内联 onclick 调用
function setSelectionMode(m) {
    if (m !== 'one-step' && m !== 'two-step') return;
    selectionMode = m;
    try { localStorage.setItem('pwgame_select_mode', m); } catch (e) { /* 同上兜底 */ }
    updateSettingsUI();
}

// ==================== 设置弹窗 ====================
function openSettings() {
    updateSettingsUI();
    document.getElementById('settingsOverlay').style.display = 'flex';
}
function closeSettings() {
    document.getElementById('settingsOverlay').style.display = 'none';
}

function updateSettingsUI() {
    const one = document.getElementById('modeOneStep');
    const two = document.getElementById('modeTwoStep');
    if (one) one.classList.toggle('active', selectionMode === 'one-step');
    if (two) two.classList.toggle('active', selectionMode === 'two-step');
    // 音效开关（v0.309：声音开关移入设置弹窗，同步 Sfx.muted 状态）
    const sfxName = document.getElementById('sfxOptionName');
    const sfxOpt = document.getElementById('sfxOption');
    const on = !Sfx.muted;
    if (sfxName) sfxName.textContent = on ? '🔊 音效：开' : '🔇 音效：关';
    if (sfxOpt) sfxOpt.classList.toggle('active', on);
    updateSelectionHints();
}

// 音效开关切换（HTML 内联 onclick 调用；包装 Sfx.toggle 并刷新设置弹窗 UI）
function toggleSfx() {
    Sfx.toggle();
    updateSettingsUI();
}

function updateSelectionHints() {
    const c = document.getElementById('charModeHint');
    const e = document.getElementById('enemyModeHint');
    if (c) c.textContent = selectionMode === 'one-step'
        ? '一步式：点角色卡直接填入第一个空槽；点已上阵空格移除'
        : '两步式：先点空格标记位置，或先点角色卡待选，再点空格填充';
    if (e) e.textContent = selectionMode === 'one-step'
        ? '一步式：点敌方卡直接填入第一个空槽；点已上阵空格移除'
        : '两步式：先点空格标记位置，或先点敌方卡待选，再点空格填充';
}
updateSettingsUI();   // 启动时同步一次（持久化模式 → 高亮 + 提示文案）

// ==================== 通用选取模块工厂（我方/敌方共用） ====================
// opts：{
//   slotsId, rosterId, detailPanelId,   // DOM 容器 id
//   rosterSource,                       // 数据源数组引用（AVAILABLE_CHARS / AVAILABLE_ENEMIES）
//   getSlots, setSlots,                 // 读取/重绑全局数组的回调（现取现用，勿缓存）
//   fillColor,                          // 已填槽边框色：我方 #2ecc71 / 敌方 #e74c3c
//   emptyPendingDesc, emptyDesc,        // 两步式空槽文案（'点击选人'/'点击空格选人' 或 '点击选敌'/'点击空格选敌'）
//   rosterClickExtra,                   // 点角色卡额外回调（打开详情面板）
//   slotCount,                          // 槽总数（缺省 3）；slotGroups 存在时由各组 count 之和决定
//   slotGroups                          // 可选：分组渲染 [{ label, count }]，敌方出场/后备；缺省单组无标题
// }
function createSelectionModule(opts) {
    let pendingIndex = -1;   // 两步式：先点空格标记的槽下标
    let pendingRole = null;  // 两步式：先点角色卡待选的角色
    let slotGroups = opts.slotGroups || [{ count: opts.slotCount || 3 }];
    let totalSlots = slotGroups.reduce((sum, g) => sum + g.count, 0);
    let lockedSlot = null;   // v0.311：锁定槽 { index, roleName }——预填、不可移除不可覆盖（第四关 1 号鲁盼旋 AI）

    function init() {
        const arr = Array.from({ length: totalSlots }, () => null);
        if (lockedSlot && lockedSlot.index >= 0 && lockedSlot.index < totalSlots) {
            arr[lockedSlot.index] = lockedSlot.roleName;   // v0.311：锁定槽预填
        }
        opts.setSlots(arr);   // 重绑全局数组（保持 selectedSlots/enemySlots 名字与形状）
        pendingIndex = -1;
        pendingRole = null;
        document.getElementById(opts.detailPanelId).style.display = 'none';
        renderSlots();
        renderRoster();
    }

    // 动态调整槽数（仅无分组的单组场景；教程关 1 槽）。调用方设置后需再 init() 生效
    function setSlotCount(n) {
        slotGroups = [{ count: n }];
        totalSlots = n;
    }

    // v0.311：分组设置（第四关 出战3+待命1）。传 null 恢复单组默认槽数。调用方设置后需再 init() 生效
    function setSlotGroups(groups) {
        slotGroups = groups === null ? [{ count: opts.slotCount || 3 }] : groups;
        totalSlots = slotGroups.reduce((sum, g) => sum + g.count, 0);
    }

    // v0.311：锁定槽（index, roleName）——预填、不可移除不可覆盖。传 (null, null) 清除。调用方设置后需再 init() 生效
    function setLockedSlot(index, roleName) {
        lockedSlot = (index === null || index === undefined) ? null : { index, roleName };
    }

    function clickSlot(index) {
        if (lockedSlot && lockedSlot.index === index) return;   // v0.311：锁定槽不可点击操作
        const slots = opts.getSlots();   // 每次现取，避免缓存旧数组引用
        if (slots[index] !== null) {
            // 点已上阵空格：移除该角色并清空待选
            slots[index] = null;
            pendingIndex = -1;
            pendingRole = null;
        } else if (selectionMode === 'two-step') {
            if (pendingRole !== null) {
                slots[index] = pendingRole;
                pendingRole = null;
                pendingIndex = -1;
            } else {
                pendingIndex = index;   // 先标记空槽，待点角色卡填充
            }
        }
        // 一步式：点空槽无操作（填入只由点角色卡触发）
        if (opts.onSlotsChange) opts.onSlotsChange(opts.getSlots());   // v0.310：教程选角引导推进钩子
        renderSlots();
        renderRoster();
    }

    function selectRole(roleName) {
        const slots = opts.getSlots();
        if (selectionMode === 'one-step') {
            // 一步式：直接填入第一个空槽；满则无操作
            const idx = slots.indexOf(null);
            if (idx !== -1) slots[idx] = roleName;
            pendingIndex = -1;
            pendingRole = null;
        } else {
            // 两步式
            if (pendingIndex !== -1) {
                slots[pendingIndex] = roleName;
                pendingIndex = -1;
            } else if (pendingRole === roleName) {
                pendingRole = null;   // 再点同一张卡取消待选
            } else {
                pendingRole = roleName;
            }
        }
        if (opts.onSlotsChange) opts.onSlotsChange(opts.getSlots());   // v0.310：教程选角引导推进钩子
        renderSlots();
        renderRoster();
    }

    function renderSlots() {
        const container = document.getElementById(opts.slotsId);
        container.innerHTML = '';
        const slots = opts.getSlots();
        let globalIdx = 0;   // 全局槽下标 = 组偏移 + 组内 idx
        slotGroups.forEach(group => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'char-slot-group';
            if (group.label) {
                const label = document.createElement('div');
                label.className = 'char-slot-group-label';
                label.textContent = group.label;
                groupDiv.appendChild(label);
            }
            const rowDiv = document.createElement('div');
            rowDiv.className = 'char-slot-row';
            for (let g = 0; g < group.count; g++, globalIdx++) {
                const idx = globalIdx;
                const role = slots[idx];
                const div = document.createElement('div');
                div.className = 'char-slot';
                if (lockedSlot && lockedSlot.index === idx) {
                    // v0.311：锁定槽（AI 操控）——预填角色、固定边框色、不可点击
                    div.style.borderColor = opts.fillColor;
                    div.innerHTML = `<div class="name">🔒 ${lockedSlot.roleName}</div><div class="desc">站位${idx + 1} · AI 操控</div>`;
                    div.style.cursor = 'default';
                } else if (role === null) {
                    const isPendingSlot = (idx === pendingIndex);
                    const hasPendingRole = (pendingRole !== null);
                    div.style.borderColor = (isPendingSlot || hasPendingRole) ? '#f9ca24' : '#555';
                    if (isPendingSlot || hasPendingRole) div.style.boxShadow = '0 0 10px #f9ca24';
                    let desc;
                    if (selectionMode === 'one-step') {
                        desc = '空位 · 点角色卡填入';
                    } else if (hasPendingRole) {
                        desc = `准备填充：${pendingRole}`;
                    } else if (isPendingSlot) {
                        desc = opts.emptyPendingDesc;
                    } else {
                        desc = opts.emptyDesc;
                    }
                    div.innerHTML = `<div class="name">空位</div><div class="desc">${desc}</div>`;
                } else {
                    div.style.borderColor = opts.fillColor;
                    div.innerHTML = `<div class="name">${role}</div><div class="desc">站位${idx + 1}</div>`;
                }
                div.onclick = () => clickSlot(idx);
                rowDiv.appendChild(div);
            }
            groupDiv.appendChild(rowDiv);
            container.appendChild(groupDiv);
        });
    }

    function renderRoster() {
        const container = document.getElementById(opts.rosterId);
        container.innerHTML = '';
        opts.rosterSource.forEach(roleName => {
            const div = document.createElement('div');
            div.className = 'roster-card';
            const count = opts.getSlots().filter(r => r === roleName).length;
            const isPending = (pendingRole === roleName);
            if (isPending) {
                div.style.borderColor = '#f9ca24';
                div.style.boxShadow = '0 0 10px #f9ca24';
            }
            let desc;
            if (selectionMode === 'one-step') {
                desc = count > 0 ? `已上场×${count}` : '点击上阵';
            } else if (isPending) {
                desc = '请点击上方空格上阵';
            } else {
                desc = count > 0 ? `已上场×${count}` : '点击查看详情';
            }
            div.innerHTML = `
                <div class="name">${isPending ? '⬆ ' : ''}${roleName}</div>
                <div class="desc">${desc}</div>
            `;
            div.onclick = () => { selectRole(roleName); opts.rosterClickExtra(roleName); };
            container.appendChild(div);
        });
    }

    // v0.316：运行时更换数据源（解锁鲁盼旋后同会话刷新选角列表）
    function setRosterSource(source) {
        opts.rosterSource = source;
        renderRoster();
    }

    return { init, clickSlot, selectRole, renderSlots, renderRoster, setSlotCount, setSlotGroups, setLockedSlot, setRosterSource };
}

// ==================== 右下角设置图标（v0.309：主菜单按钮改为全局悬浮图标） ====================
function mountSettingsButton() {
    if (document.getElementById('settingsBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'settingsBtn';
    btn.textContent = '⚙️';
    btn.title = '设置';
    btn.onclick = openSettings;
    document.body.appendChild(btn);
}
mountSettingsButton();   // selection.js 加载时 body 已就绪，直接挂载
