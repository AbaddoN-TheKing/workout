// Estatísticas por perfil: totais, treinos por semana, calendário de atividade, músculos e recordes.
(() => {
    'use strict';
    const { h, svg, field, select } = window.Fit;
    const DAY = 864e5;
    const ui = { member: '', range: '90' };

    const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
    const addDays = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };
    const monday = (t) => { const d = new Date(startOfDay(t)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };

    function ensureMember() {
        if (!Fit.member(ui.member)) ui.member = Fit.me() || Fit.members()[0]?.id || '';
    }

    const logsOf = (id, since = 0) => Fit.data().log.filter((l) => l.m === id && l.t >= since);

    function totals(id, since) {
        const sessions = new Map();
        logsOf(id, since).forEach((l) => {
            const k = l.sid || `d${startOfDay(l.t)}`;
            const s = sessions.get(k) || { dur: 0 };
            s.dur = Math.max(s.dur, l.dur || 0);
            sessions.set(k, s);
        });
        const base = Fit.stats(id, since);
        const minutes = [...sessions.values()].reduce((a, s) => a + s.dur, 0);
        return { ...base, minutes, count: sessions.size };
    }

    // ---------- Gráficos ----------
    function barChart(values, labels, goal) {
        const W = 320, H = 150, L = 24, R = 8, T = 14, B = 24;
        const max = Math.max(goal || 0, ...values, 1);
        const bw = (W - L - R) / values.length;
        const Y = (v) => T + (1 - v / max) * (H - T - B);
        const label = { style: 'fill:var(--text-sub);font-size:10px' };
        return h('div', { class: 'chart' }, svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': t('Treinos por semana'), style: 'width:100%;height:auto' },
            svg('line', { x1: L, x2: W - R, y1: Y(0), y2: Y(0), style: 'stroke:var(--line)' }),
            goal ? svg('line', { x1: L, x2: W - R, y1: Y(goal), y2: Y(goal), 'stroke-dasharray': '4 4', style: 'stroke:var(--hot)' }) : null,
            goal ? svg('text', { ...label, x: L - 4, y: Y(goal) + 3, 'text-anchor': 'end' }, String(goal)) : null,
            values.map((v, i) => svg('rect', {
                x: L + i * bw + 3, y: Y(v), width: Math.max(2, bw - 6), height: Math.max(v ? 2 : 0, Y(0) - Y(v)), rx: 4,
                style: `fill:${v >= (goal || 1) ? 'var(--primary)' : 'var(--text-sub)'};opacity:${v ? 1 : 0.25}`,
            }, svg('title', {}, `${labels[i]}: ${v}`))),
            values.map((v, i) => (v ? svg('text', { ...label, x: L + i * bw + bw / 2, y: Y(v) - 3, 'text-anchor': 'middle' }, String(v)) : null)),
            [0, Math.floor(values.length / 2), values.length - 1].map((i) => svg('text', { ...label, x: L + i * bw + bw / 2, y: H - 6, 'text-anchor': 'middle' }, labels[i]))));
    }

    function weeklyPanel(m) {
        const weeks = 12;
        const first = addDays(monday(Date.now()), -(weeks - 1) * 7);
        const days = Array.from({ length: weeks }, () => new Set());
        logsOf(m.id, first).forEach((l) => {
            const i = Math.floor((startOfDay(l.t) - first) / (7 * DAY));
            if (i >= 0 && i < weeks) days[i].add(startOfDay(l.t));
        });
        const values = days.map((s) => s.size);
        const labels = values.map((_, i) => Fit.fmtShort(addDays(first, i * 7)));
        return h('div', { class: 'panel' }, h('h2', {}, t('Treinos por semana')), barChart(values, labels, m.goal || 3),
            h('small', { class: 'muted' }, t('Últimas 12 semanas · linha tracejada = meta ({goal})', { goal: m.goal || 3 })));
    }

    function heatPanel(m) {
        const weeks = 14;
        const first = addDays(monday(Date.now()), -(weeks - 1) * 7);
        const byDay = new Map();
        logsOf(m.id, first).forEach((l) => {
            const k = startOfDay(l.t);
            byDay.set(k, (byDay.get(k) || 0) + Fit.points(l));
        });
        const max = Math.max(1, ...byDay.values());
        const today = startOfDay(Date.now());
        const grid = h('div', { class: 'heat' }, Array.from({ length: weeks * 7 }, (_, i) => {
            const col = Math.floor(i / 7);
            const row = i % 7;
            const day = addDays(first, col * 7 + row);
            const v = byDay.get(day) || 0;
            const lvl = !v ? 0 : Math.min(4, 1 + Math.floor((v / max) * 3.99));
            return h('i', { class: `hc l${lvl}${day > today ? ' fut' : ''}`, title: `${Fit.fmtShort(day)}: ${v} ${t('pts')}`, style: `grid-column:${col + 1};grid-row:${row + 1}` });
        }));
        return h('div', { class: 'panel' }, h('h2', {}, t('Calendário de atividade')), grid,
            h('div', { class: 'heat-legend' }, h('small', { class: 'muted' }, t('Menos')),
                [0, 1, 2, 3, 4].map((l) => h('i', { class: `hc l${l}` })), h('small', { class: 'muted' }, t('Mais'))));
    }

    function musclePanel(m, since) {
        const sums = new Map();
        logsOf(m.id, since).forEach((l) => {
            const ex = Fit.byId(l.e);
            if (ex) sums.set(ex.muscle, (sums.get(ex.muscle) || 0) + Fit.points(l));
        });
        const total = [...sums.values()].reduce((a, b) => a + b, 0);
        const rows = [...sums.entries()].sort((a, b) => b[1] - a[1]);
        return h('div', { class: 'panel' }, h('h2', {}, t('Músculos trabalhados')),
            rows.length ? h('div', { class: 'bars' }, rows.map(([name, v]) => h('div', { class: 'bar-row' },
                h('div', { class: 'grow' }, h('span', { class: 'bar-name' }, t(name)),
                    h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill', style: `width:${(v / total) * 100}%;background:var(--primary)` }))),
                h('b', {}, `${Math.round((v / total) * 100)}%`))))
                : h('p', { class: 'empty' }, t('Sem treinos neste período.')),
            rows.length && rows.length < 3 ? h('p', { class: 'muted small' }, t('Dica: varia os grupos musculares para um corpo equilibrado.')) : null);
    }

    function recordsPanel(m) {
        const ids = [...new Set(logsOf(m.id).map((l) => l.e))].filter((id) => Fit.byId(id));
        const rows = ids.map((id) => ({ ex: Fit.byId(id), best: Fit.best(m.id, id), n: Fit.series(m.id, id).length }))
            .filter((r) => r.best).sort((a, b) => b.n - a.n).slice(0, 8);
        return h('div', { class: 'panel' }, h('h2', {}, t('🏆 Recordes pessoais')),
            rows.length ? h('ul', { class: 'list' }, rows.map((r) => {
                const metric = Fit.metric(r.ex.kind);
                return h('li', {}, h('div', { class: 'grow' }, r.ex.name, h('small', {}, `${tn(r.n, '{n} sessão', '{n} sessões')} · ${Fit.fmtDate(r.best.t)}`)),
                    h('b', { class: 'pr' }, `${Fit.fmtNum(r.best.v)} ${metric.unit}`));
            })) : h('p', { class: 'empty' }, t('Os recordes aparecem depois de registares treinos.')));
    }

    function fmtTime(min) {
        if (!min) return '—';
        return min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `${min} ${t('min')}`;
    }

    function render() {
        const root = document.getElementById('view-insights');
        root.replaceChildren();
        if (!Fit.members().length) { root.append(Fit.onboarding()); return; }
        ensureMember();
        const m = Fit.member(ui.member);
        const since = ui.range === 'all' ? 0 : Date.now() - Number(ui.range) * DAY;
        const tot = totals(m.id, since);
        const st = Fit.streaks(m.id);
        root.append(
            h('div', { class: 'panel' }, h('h2', {}, t('Estatísticas')),
                Fit.members().length > 1 ? field(t('Perfil'), select('m', Fit.members().map((x) => [x.id, x.name]), ui.member, (v) => { ui.member = v; render(); })) : null,
                h('div', { class: 'seg' }, [['30', t('30 dias')], ['90', t('90 dias')], ['all', t('Sempre')]].map(([v, text]) =>
                    h('button', { type: 'button', class: ui.range === v ? 'on' : '', onclick: () => { ui.range = v; render(); } }, text))),
                h('div', { class: 'tiles' },
                    h('div', { class: 'tile static' }, h('small', {}, t('Treinos')), h('b', {}, String(tot.count))),
                    h('div', { class: 'tile static' }, h('small', {}, t('Tempo total')), h('b', {}, fmtTime(tot.minutes))),
                    h('div', { class: 'tile static' }, h('small', {}, t('Volume')), h('b', {}, tot.volume >= 1000 ? `${(tot.volume / 1000).toFixed(1)} t` : `${tot.volume} kg`)),
                    h('div', { class: 'tile static' }, h('small', {}, t('Pontos')), h('b', {}, String(tot.points))),
                    h('div', { class: 'tile static' }, h('small', {}, t('Sequência atual')), h('b', {}, `🔥 ${st.current}`)),
                    h('div', { class: 'tile static' }, h('small', {}, t('Melhor sequência')), h('b', {}, `⚡ ${st.best}`)))),
            weeklyPanel(m), heatPanel(m), musclePanel(m, since), recordsPanel(m));
    }

    document.addEventListener('fit:change', render);
    render();
})();
