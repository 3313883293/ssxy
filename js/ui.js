// ui.js - 页面切换

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    // v0.310：离开教程关流程页面（选角/战斗）时清理教学弹窗，避免退出后文本残留
    if (typeof Tutorial !== 'undefined' && Tutorial.active && id !== 'pageSelectChar' && id !== 'pageBattle') {
        Tutorial.end();
    }
    // v0.311：进入关卡选择页时刷新鲁盼旋篇逐关解锁状态
    if (id === 'pageLevel') {
        if (typeof updateLevelLocks === 'function') updateLevelLocks();
        // v0.317：返回关卡选择页时实时刷新 ⭐ 星数与鲁盼旋解锁状态（原只在展开版块时刷新，打完退出星数不更新）
        if (typeof updateLuStars === 'function') updateLuStars();
        // v0.5 改：灼华篇标题星数与解锁区同步实时刷新（打完灼华篇回关卡页即更新）
        if (typeof updateZhStars === 'function') updateZhStars();
        if (typeof updateZhUnlock === 'function') updateZhUnlock();
        // v0.671：灼华篇逐关解锁与卡片星标随返回关卡页实时刷新（此前缺失，仅展开版块时刷新）
        if (typeof updateZhLevelLocks === 'function') updateZhLevelLocks();
        // v0.6：张子曦篇标题星数与解锁区实时刷新
        if (typeof updateZhangStars === 'function') updateZhangStars();
        if (typeof updateZhangUnlock === 'function') updateZhangUnlock();
        if (typeof updateZhangLevelLocks === 'function') updateZhangLevelLocks();
    }
    // v0.662：页面切换后重算教程弹窗贴边位置/限高——「确认出战」时弹窗带着选角页 .tutorial-select
    //         贴底类残留在战斗页显示（步骤③），切换完成后立即按新页面修正；弹窗未显示时 syncPosition 自动跳过
    if (typeof Tutorial !== 'undefined' && Tutorial.syncPosition) Tutorial.syncPosition();
}
