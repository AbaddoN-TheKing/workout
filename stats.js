// Estatísticas, níveis, conquistas, classificações e o painel motivacional ("hero").
(() => {
    'use strict';
    const { h, svg } = window.Fit;
    const DAY = 864e5;

    const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
    const prevDay = (t) => { const d = new Date(t); d.setDate(d.getDate() - 1); return d.getTime(); };
    const weekStart = () => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return d.getTime();
    };
    const dayKey = (t) => startOfDay(t);

    // ---------- Números de um perfil ----------
    function stats(id, since = 0) {
        const sessions = new Set();
        const days = new Set();
        let points = 0;
        let volume = 0;
        Fit.data().log.forEach((l) => {
            if (l.m !== id || l.t < since) return;
            sessions.add(l.sid || `d${dayKey(l.t)}`);
            days.add(dayKey(l.t));
            points += Fit.points(l);
            if (Fit.byId(l.e)?.kind === 'load') {
                if (l.sets) l.sets.forEach((s) => { volume += (s.kg || 0) * (s.r || 0); });
                else volume += (l.s || 0) * (l.r || 0) * (l.kg || 0);
            }
        });
        return { sessions: sessions.size, days: days.size, points, volume: Math.round(volume) };
    }

    function streaks(id) {
        const set = new Set();
        Fit.data().log.forEach((l) => { if (l.m === id) set.add(dayKey(l.t)); });
        const days = [...set].sort((a, b) => a - b);
        let best = 0;
        let run = 0;
        let prev = null;
        days.forEach((d) => {
            run = prev !== null && Math.round((d - prev) / DAY) === 1 ? run + 1 : 1;
            best = Math.max(best, run);
            prev = d;
        });
        const today = startOfDay(Date.now());
        let cursor = set.has(today) ? today : prevDay(today);
        let current = 0;
        while (set.has(cursor)) { current++; cursor = prevDay(cursor); }
        return { current, best, trainedToday: set.has(today) };
    }

    // Dias da semana atual (Seg..Dom) em que treinou
    function weekGrid(id) {
        const start = weekStart();
        const trained = new Set();
        Fit.data().log.forEach((l) => { if (l.m === id && l.t >= start) trained.add(dayKey(l.t)); });
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            return trained.has(d.getTime());
        });
    }

    // ---------- Níveis e conquistas ----------
    const TITLES = [t('Caloiro'), t('Ativo'), t('Dedicado'), t('Atleta'), t('Guerreiro'), t('Elite'), t('Lenda')];

    function level(points) {
        const lv = Math.floor(Math.sqrt(points / 40)) + 1;
        const lo = (lv - 1) ** 2 * 40;
        const hi = lv ** 2 * 40;
        return { lv, title: TITLES[Math.min(lv - 1, TITLES.length - 1)], pct: (points - lo) / (hi - lo), next: hi - points };
    }

    const BADGES = [
        ['first', '🎯', t('Primeiro treino'), (a) => a.sessions >= 1],
        ['s5', '💪', t('5 treinos'), (a) => a.sessions >= 5],
        ['s25', '🏅', t('25 treinos'), (a) => a.sessions >= 25],
        ['s100', '🏆', t('100 treinos'), (a) => a.sessions >= 100],
        ['st3', '🔥', t('3 dias seguidos'), (a) => a.best >= 3],
        ['st7', '⚡', t('7 dias seguidos'), (a) => a.best >= 7],
        ['v1', '🏗️', t('1 tonelada levantada'), (a) => a.volume >= 1000],
        ['v10', '🚛', t('10 toneladas'), (a) => a.volume >= 10000],
        ['goal', '⭐', t('Meta semanal cumprida'), (a) => a.weekDone],
    ];

    function badges(id) {
        const total = stats(id);
        const { best } = streaks(id);
        const m = Fit.member(id);
        const week = stats(id, weekStart());
        const a = { ...total, best, weekDone: week.days >= (m?.goal || 3) };
        return BADGES.map(([key, icon, label, test]) => ({ key, icon, label, on: test(a) }));
    }

    // ---------- Classificações ----------
    const PERIODS = { week: 7 * DAY, month: 30 * DAY, all: 0 };

    function leaderboard(metric, period = 'week') {
        const since = PERIODS[period] ? Date.now() - PERIODS[period] : 0;
        return Fit.members().map((m) => {
            const s = stats(m.id, since);
            const v = metric === 'streak' ? streaks(m.id).current : s[metric === 'sessions' ? 'days' : metric];
            return { m, v };
        }).sort((a, b) => b.v - a.v || a.m.name.localeCompare(b.m.name));
    }

    function rankMessage(id) {
        const board = leaderboard('points', 'week');
        if (board.length < 2) return t('Convida a família: importa os perfis deles no separador Perfis e começa a competição!');
        const i = board.findIndex((r) => r.m.id === id);
        if (i < 0) return '';
        if (board.every((r) => r.v === 0)) return t('Semana nova, tabela a zeros. Quem treinar primeiro, lidera!');
        if (i === 0) {
            const gap = board[0].v - board[1].v;
            return gap > 0 ? t('Lideras a semana! {name} está a {gap} pts — não abrandes! 🔥', { name: board[1].m.name, gap }) : t('Empate no topo com {name}. Desempata hoje! 💥', { name: board[1].m.name });
        }
        const gap = board[i - 1].v - board[i].v;
        return gap > 0 ? t('Faltam {gap} pts para passares {name}! 💪', { gap: gap + 1, name: board[i - 1].m.name }) : t('Empatado com {name}. Um treino e passas à frente! ⚡', { name: board[i - 1].m.name });
    }

    // ---------- Painel motivacional ----------
    const QUOTES = [
        t('A disciplina vence a motivação.'),
        t('Hoje é dia de superar o treino de ontem.'),
        t('Não precisas de ser perfeito. Só precisas de começar.'),
        t('Um treino mau é melhor do que nenhum.'),
        t('O corpo alcança aquilo em que a mente acredita.'),
        t('Cada repetição é um voto no atleta que queres ser.'),
        t('Suor hoje, orgulho amanhã.'),
        t('A consistência bate o talento.'),
        t('Vem treinar. A família está a ver os pontos! 😄'),
        t('Mais um dia, mais uma oportunidade de ficares mais forte.'),
    ];
    const quote = () => QUOTES[Math.floor(Date.now() / DAY) % QUOTES.length];

    function ring(value, goal, size = 84) {
        const r = 34;
        const c = 2 * Math.PI * r;
        const pct = Math.min(1, value / Math.max(1, goal));
        return h('div', { class: 'ring', style: `width:${size}px;height:${size}px` },
            svg('svg', { viewBox: '0 0 84 84' },
                svg('circle', { cx: 42, cy: 42, r, fill: 'none', 'stroke-width': 8, style: 'stroke:var(--line)' }),
                svg('circle', {
                    cx: 42, cy: 42, r, fill: 'none', 'stroke-width': 8, 'stroke-linecap': 'round',
                    'stroke-dasharray': `${(c * pct).toFixed(1)} ${c.toFixed(1)}`, transform: 'rotate(-90 42 42)',
                    style: `stroke:${pct >= 1 ? 'var(--success)' : 'var(--primary)'}`,
                })),
            h('div', { class: 'ring-text' }, h('b', {}, String(value)), h('small', {}, `/${goal}`)));
    }

    const DAY_LETTERS = I18n.weekdays('narrow');

    function weekStrip(id) {
        const grid = weekGrid(id);
        const today = (new Date().getDay() + 6) % 7;
        return h('div', { class: 'week-strip' }, grid.map((on, i) =>
            h('span', { class: `wd${on ? ' on' : ''}${i === today ? ' today' : ''}` }, on ? '✓' : DAY_LETTERS[i])));
    }

    function heroPanel(id) {
        const m = Fit.member(id);
        if (!m) return null;
        const total = stats(id);
        const lv = level(total.points);
        const st = streaks(id);
        const week = stats(id, weekStart());
        const goal = m.goal || 3;
        return h('div', { class: 'hero' },
            h('div', { class: 'hero-top' },
                Fit.avatar(m, 58),
                h('div', { class: 'grow' },
                    h('small', { class: 'kicker' }, st.trainedToday ? t('Treino feito hoje') : t('Bora treinar,')),
                    h('div', { class: 'hero-name' }, m.name),
                    h('span', { class: 'chip lv' }, `${t('Nível {lv}', { lv: lv.lv })} · ${lv.title}`)),
                ring(week.days, goal)),
            h('div', { class: 'xp' }, h('i', { style: `width:${Math.round(lv.pct * 100)}%` })),
            h('div', { class: 'hero-stats' },
                h('div', {}, h('b', {}, `🔥 ${st.current}`), h('small', {}, st.current === 1 ? t('dia seguido') : t('dias seguidos'))),
                h('div', {}, h('b', {}, String(total.points)), h('small', {}, t('pontos'))),
                h('div', {}, h('b', {}, String(total.sessions)), h('small', {}, t('treinos')))),
            weekStrip(id),
            h('p', { class: 'quote' }, rankMessage(id) || quote()));
    }

    function onboarding() {
        return h('div', { class: 'panel cta' },
            h('h2', {}, t('Começa por criar um perfil')),
            h('p', { class: 'muted' }, t('Cria o teu perfil (ou importa o de alguém da família) para registares treinos e medidas e entrares no ranking.')),
            h('a', { class: 'btn', href: '#perfis' }, t('Ir para Perfis')));
    }

    Object.assign(window.Fit, {
        onboarding,
        stats, streaks, weekGrid, weekStart, level, badges, leaderboard, rankMessage, quote, ring, weekStrip, heroPanel,
    });
})();
