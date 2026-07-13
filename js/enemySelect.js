// enemySelect.js - 自选敌人界面

function initEnemySelection() {
    enemySlots = [null, null, null];
    pendingEnemyIndex = -1;
    renderEnemySlots();
    renderEnemyRoster();
}

function clickEnemySlot(index) {
    if (enemySlots[index] !== null) { enemySlots[index] = null; pendingEnemyIndex = -1; }
    else { pendingEnemyIndex = index; }
    renderEnemySlots();
    renderEnemyRoster();
}

function selectRosterEnemy(roleName) {
    if (pendingEnemyIndex === -1) {
        const emptyIdx = enemySlots.indexOf(null);
        if (emptyIdx === -1) { alert('敌方阵容已满！'); return; }
        enemySlots[emptyIdx] = roleName;
    } else {
        enemySlots[pendingEnemyIndex] = roleName;
        pendingEnemyIndex = -1;
    }
    renderEnemySlots();
    renderEnemyRoster();
}

function renderEnemySlots() {
    const container = document.getElementById('enemySlots');
    container.innerHTML = '';
    enemySlots.forEach((role, idx) => {
        const div = document.createElement('div');
        div.className = 'char-slot';
        if (role === null) {
            div.style.borderColor = idx === pendingEnemyIndex ? '#f9ca24' : '#555';
            if (idx === pendingEnemyIndex) div.style.boxShadow = '0 0 10px #f9ca24';
            div.innerHTML = `<div class="name">空位</div><div class="desc">点击选敌</div>`;
        } else {
            div.style.borderColor = '#e74c3c';
            div.innerHTML = `<div class="name">${role}</div><div class="desc">站位${idx + 1}</div>`;
        }
        div.onclick = () => clickEnemySlot(idx);
        container.appendChild(div);
    });
}

function renderEnemyRoster() {
    const container = document.getElementById('enemyRoster');
    container.innerHTML = '';
    AVAILABLE_ENEMIES.forEach(roleName => {
        const div = document.createElement('div');
        div.className = 'roster-card';
        const count = enemySlots.filter(r => r === roleName).length;
        div.innerHTML = `<div class="name">${roleName}</div><div class="desc">${count > 0 ? `已选×${count}` : '点击上阵'}</div>`;
        div.onclick = () => selectRosterEnemy(roleName);
        container.appendChild(div);
    });
}
