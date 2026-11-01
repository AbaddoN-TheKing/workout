// Navegação por separadores (hash): #treinos (início), #plano, #exercicios, #medidas, #ranking, #perfis, #qr
(() => {
    'use strict';
    const views = [...document.querySelectorAll('[data-view]')];
    const links = [...document.querySelectorAll('#appNav a')];
    const names = views.map((v) => v.dataset.view);

    function show() {
        const name = location.hash.slice(1);
        const active = names.includes(name) ? name : 'treinos';
        views.forEach((v) => { v.hidden = v.dataset.view !== active; });
        links.forEach((a) => {
            if (a.getAttribute('href') === `#${active}`) a.setAttribute('aria-current', 'page');
            else a.removeAttribute('aria-current');
        });
        if (active !== show.last) window.scrollTo(0, 0);
        show.last = active;
        document.dispatchEvent(new CustomEvent('viewchange', { detail: active }));
    }

    window.addEventListener('hashchange', show);
    show();
})();
