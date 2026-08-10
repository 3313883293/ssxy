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
    }
}
