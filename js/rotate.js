// v0.42：旋转模式——竖屏手机直接横屏显示游戏，玩家无需转手机。
// 检测竖屏触屏（视口≤767 + 宽<高 + 触屏）→ html 加 .rotate-mode，
// CSS 将 .container 旋转 90° 并按横屏 844 布局渲染（覆盖 ≤767 竖屏断点）。
// 桌面 / 平板竖屏(>767) / 横屏手机不启用；非 rotate-mode 时本文件零副作用。
(function () {
    'use strict';

    function update() {
        const isNarrow = window.matchMedia('(max-width: 767px)').matches;
        const isPortrait = window.innerHeight > window.innerWidth;
        const isCoarse = window.matchMedia('(pointer: coarse)').matches;
        const isTouch = window.matchMedia('(hover: none)').matches;
        const on = isNarrow && isPortrait && isCoarse && isTouch;
        document.documentElement.classList.toggle('rotate-mode', on);
        window._rotateMode = on;   // 验证探针
    }

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    update();
})();
