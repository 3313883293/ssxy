// Roles.js - 所有角色创建函数

function createTemplateOne(team, position) {
    const skills = [
        new Skill('技能一·突刺', 200, 200, 100, 2, 2),
        new Skill('技能二·重斩', 400, 400, 200, 2, 3),
        new Skill('技能三·终结', 800, 600, 200, 3, 3)
    ];
    return new Character('模板一', 2000, 200, [3,7], 1000, 300, skills, team, position);
}

function createPolice(team, position, initialSP = null) {
    const skills = [
        new Skill('持盾格挡', 0, 100, 200, 1, 1, { type: 'def', value: 100, duration: 'nextHit' }),
        new Skill('持盾猛击', 200, 500, 500, 1, 1, { type: 'def', value: -200, duration: 'nextHit' })
    ];
    const char = new Character('持盾警察', 2000, 300, [2,4], 200, 50, skills, team, position);
    if (initialSP !== null) char.sp = initialSP;
    return char;
}

function createStickPolice(team, position, initialSP = null) {
    const skills = [
        new Skill('棍击', 0, 200, 100, 2, 2),
        new Skill('一秒18棍', 200, 400, 50, 18, 2)
    ];
    const char = new Character('持棍警察', 2000, 200, [3,6], 200, 50, skills, team, position);
    if (initialSP !== null) char.sp = initialSP;
    return char;
}

function createGunPolice(team, position, initialSP = null) {
    const skills = [
        new Skill('开火', 250, 400, 1600, 1, 4)
    ];
    const char = new Character('持枪警察', 2000, 100, [4,8], 300, 50, skills, team, position);
    if (initialSP !== null) char.sp = initialSP;
    return char;
}

function createRoleInstance(roleName, team, position) {
    if (roleName === '模板一') return createTemplateOne(team, position);
    return null;
}
