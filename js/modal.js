// modal.js - 游戏内自定义弹窗（v0.319：替代浏览器原生 alert/confirm，样式与游戏风格一致）
// showModal({ title, message, type:'info'|'confirm', confirmText, cancelText, onConfirm, onCancel })
//   - type:'info'    单个「知道了」按钮，点击关闭
//   - type:'confirm' 确定/取消：点「确定」触发 onConfirm（对应原 confirm()===true 的分支），点「取消」触发 onCancel
// 点击覆盖层背景 = 关闭弹窗但不触发任何回调（不会误确认）

let _gameModalCb = null;

function showModal(opts) {
    opts = opts || {};
    const overlay = document.getElementById('gameModalOverlay');
    if (!overlay) return;
    document.getElementById('gameModalTitle').textContent = opts.title || '提示';
    document.getElementById('gameModalMessage').textContent = opts.message || '';
    const btnRow = document.getElementById('gameModalButtons');
    if (opts.type === 'confirm') {
        btnRow.innerHTML =
            `<button class="btn-main" style="background:#555;" onclick="gameModalCancel()">${opts.cancelText || '取消'}</button>` +
            `<button class="btn-main" style="background:#e94560;" onclick="gameModalOk()">${opts.confirmText || '确定'}</button>`;
    } else {
        btnRow.innerHTML =
            `<button class="btn-main" style="background:#3498db;" onclick="gameModalOk()">${opts.confirmText || '知道了'}</button>`;
    }
    _gameModalCb = { onConfirm: opts.onConfirm || null, onCancel: opts.onCancel || null };
    overlay.style.display = 'flex';
}

function closeGameModal() {
    const overlay = document.getElementById('gameModalOverlay');
    if (overlay) overlay.style.display = 'none';
    _gameModalCb = null;
}

function gameModalOk() {
    const cb = _gameModalCb;
    closeGameModal();
    if (cb && cb.onConfirm) cb.onConfirm();
}

function gameModalCancel() {
    const cb = _gameModalCb;
    closeGameModal();
    if (cb && cb.onCancel) cb.onCancel();
}
