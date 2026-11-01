// Treinos, perfis, equipas (casais) e ranking. Dados em localStorage.
(() => {
    'use strict';

    const KEY = 'fit_data_v1';
    const DAY = 864e5;

    const CATALOG = window.EXERCISES;
    const CUSTOM_KEY = 'fit_custom_ex_v1';
    const KINDS = ['reps', 'load', 'time'];
    const ROLES = ['Homem', 'Mulher', 'Outro'];
    const MEDALS = ['🥇', '🥈', '🥉'];

    // ---------- Dados ----------
    const empty = () => ({ members: [], teams: [], log: [] });

    function load() {
        try { return { ...empty(), ...JSON.parse(localStorage.getItem(KEY)) }; }
        catch { return empty(); }
    }

    let db = load();
    const ui = { member: '', exercise: CATALOG[0].id, period: 'week', more: false };

    // Exercícios criados pelo utilizador (entram no mesmo catálogo)
    function readCustom() {
        try {
            const list = JSON.parse(localStorage.getItem(CUSTOM_KEY));
            return Array.isArray(list) ? list.filter((e) => e && e.id && e.name && KINDS.includes(e.kind)) : [];
        } catch { return []; }
    }
    let custom = readCustom();
    custom.forEach((e) => CATALOG.push({ ...e, custom: true }));
    const saveCustom = () => localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));

    const save = () => localStorage.setItem(KEY, JSON.stringify(db));
    const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}${Math.random()}`);
    const memberById = (id) => db.members.find((m) => m.id === id);
    const exerciseById = (id) => CATALOG.find((e) => e.id === id);

    function points(entry) {
        const ex = exerciseById(entry.e);
        if (!ex) return 0;
        if (entry.sets) {
            return Math.round(entry.sets.reduce((sum, x) => sum + (ex.kind === 'time' ? x.min * ex.k
                : x.r * ex.k * (ex.kind === 'load' ? 1 + x.kg / 20 : 1)), 0));
        }
        if (ex.kind === 'time') return Math.round(entry.min * ex.k);
        const volume = entry.s * entry.r;
        return Math.round(ex.kind === 'load' ? volume * (1 + entry.kg / 20) * ex.k : volume * ex.k);
    }

    function totals(since) {
        const sums = new Map(db.members.map((m) => [m.id, 0]));
        db.log.forEach((l) => {
            if (l.t >= since && sums.has(l.m)) sums.set(l.m, sums.get(l.m) + points(l));
        });
        return sums;
    }

    // ---------- Helpers de DOM (sem innerHTML: seguro contra XSS) ----------
    function h(tag, attrs = {}, ...kids) {
        const el = document.createElement(tag);
        for (const [key, val] of Object.entries(attrs)) {
            if (key === 'class') el.className = val;
            else if (key.startsWith('on')) el.addEventListener(key.slice(2), val);
            else if (val !== false && val != null) el.setAttribute(key, val);
        }
        kids.flat().forEach((c) => { if (c != null && c !== false) el.append(c); });
        return el;
    }

    const field = (label, control) => h('label', { class: 'fld' }, h('span', {}, label), control);

    function select(name, options, current, onChange) {
        const el = h('select', { name }, options.map(([v, text]) => h('option', { value: v }, text)));
        el.value = current;
        el.addEventListener('change', () => onChange(el.value));
        return el;
    }

    const dot = (member) => h('i', { class: 'dot', style: `background:${member.color}` });
    const toast = (msg) => { if (typeof showToast === 'function') showToast(msg); };
    const confirmDialog = (message) =>
        (typeof showDialog === 'function' ? showDialog({ message, type: 'confirm' }) : Promise.resolve(true));

    // ---------- Séries, recordes e gráficos ----------
    const METRICS = {
        load: { label: '1RM estimado', unit: 'kg' },
        reps: { label: 'Máx. reps numa série', unit: 'reps' },
        time: { label: 'Tempo no dia', unit: 'min' },
    };

    function setsOf(l, ex) {
        if (l.sets) return l.sets;
        if (ex.kind === 'time') return [{ min: l.min || 0 }];
        return Array.from({ length: l.s || 0 }, () => ({ r: l.r || 0, kg: l.kg || 0 }));
    }

    // Valor de uma sessão para um exercício (Epley para carga)
    function valueOf(ex, sets) {
        let v;
        if (ex.kind === 'time') v = sets.reduce((a, x) => a + (x.min || 0), 0);
        else {
            const maxReps = Math.max(0, ...sets.map((x) => x.r || 0));
            const rm = Math.max(0, ...sets.map((x) => (x.kg > 0 ? x.kg * (1 + (x.r || 0) / 30) : 0)));
            v = ex.kind === 'load' && rm > 0 ? rm : maxReps;
        }
        return Math.round(v * 10) / 10;
    }

    function series(member, exId) {
        const ex = exerciseById(exId);
        if (!ex) return [];
        return db.log.filter((l) => l.m === member && l.e === exId)
            .map((l) => { const sets = setsOf(l, ex); return { t: l.t, v: valueOf(ex, sets), sets }; })
            .filter((p) => p.v > 0)
            .sort((a, b) => a.t - b.t);
    }

    const best = (member, exId) => series(member, exId).reduce((b, p) => (!b || p.v > b.v ? p : b), null);
    const fmtDate = (t) => new Date(t).toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' });
    const fmtShort = (t) => new Date(t).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
    const fmtNum = (v) => String(Math.round(v * 10) / 10);

    const SVGNS = 'http://www.w3.org/2000/svg';
    function svg(tag, attrs = {}, ...kids) {
        const el = document.createElementNS(SVGNS, tag);
        for (const [key, val] of Object.entries(attrs)) el.setAttribute(key, val);
        kids.flat().forEach((c) => { if (c != null) el.append(c); });
        return el;
    }

    // Gráfico de linha simples: points = [{ t, v }]
    function lineChart(points, unit = '') {
        if (points.length < 2) {
            return h('p', { class: 'empty' }, points.length ? 'Precisas de 2 registos para ver o gráfico.' : 'Sem dados ainda.');
        }
        const W = 320, H = 150, L = 38, R = 12, T = 12, B = 24;
        const xs = points.map((p) => p.t);
        const ys = points.map((p) => p.v);
        const x0 = Math.min(...xs), x1 = Math.max(...xs);
        const y0 = Math.min(...ys), y1 = Math.max(...ys);
        const pad = (y1 - y0) || Math.abs(y1) || 1;
        const lo = y0 - pad * 0.15, hi = y1 + pad * 0.15;
        const X = (t) => L + (x1 === x0 ? 0.5 : (t - x0) / (x1 - x0)) * (W - L - R);
        const Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
        const label = { style: 'fill:var(--text-sub);font-size:10px' };
        const path = points.map((p) => `${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
        const el = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', style: 'width:100%;height:auto', 'aria-label': 'Gráfico de evolução' },
            svg('line', { x1: L, x2: W - R, y1: Y(y1), y2: Y(y1), style: 'stroke:var(--input-border)' }),
            svg('line', { x1: L, x2: W - R, y1: Y(y0), y2: Y(y0), style: 'stroke:var(--input-border)' }),
            svg('text', { ...label, x: L - 4, y: Y(y1) + 3, 'text-anchor': 'end' }, fmtNum(y1)),
            svg('text', { ...label, x: L - 4, y: Y(y0) + 3, 'text-anchor': 'end' }, fmtNum(y0)),
            svg('text', { ...label, x: L, y: H - 6, 'text-anchor': 'start' }, fmtShort(x0)),
            svg('text', { ...label, x: W - R, y: H - 6, 'text-anchor': 'end' }, fmtShort(x1)),
            svg('polyline', { points: path, fill: 'none', 'stroke-width': 2.5, 'stroke-linejoin': 'round', style: 'stroke:var(--primary)' }),
            points.map((p) => svg('circle', { cx: X(p.t), cy: Y(p.v), r: 3.5, style: 'fill:var(--primary)' },
                svg('title', {}, `${fmtShort(p.t)}: ${fmtNum(p.v)} ${unit}`))));
        return h('div', { class: 'chart' }, el);
    }

    // ---------- Treinos (histórico por sessão) ----------
    function logDetail(l, ex) {
        if (l.sets) {
            if (ex.kind === 'time') return `${l.sets.reduce((a, x) => a + x.min, 0)} min`;
            const top = l.sets.reduce((b, x) => (x.kg > b.kg || (x.kg === b.kg && x.r > b.r) ? x : b), l.sets[0]);
            const desc = `${l.sets.length} séries`;
            return ex.kind === 'load' ? `${desc} · melhor ${top.kg} kg × ${top.r}` : `${desc} · melhor ${top.r} reps`;
        }
        return ex.kind === 'time' ? `${l.min} min` : `${l.s}×${l.r}${ex.kind === 'load' ? ` · ${l.kg} kg` : ''}`;
    }

    function groups() {
        const map = new Map();
        db.log.forEach((l) => {
            const k = l.sid || l.id;
            if (!map.has(k)) map.set(k, { k, t: l.t, m: l.m, dur: l.dur, note: l.note, items: [] });
            map.get(k).items.push(l);
        });
        return [...map.values()].sort((a, b) => b.t - a.t);
    }

    function sessionPanel(g) {
        const m = memberById(g.m);
        const total = g.items.reduce((sum, l) => sum + points(l), 0);
        const meta = [fmtDate(g.t), g.dur ? `${g.dur} min` : null].filter(Boolean).join(' · ');
        return h('div', { class: 'panel' },
            h('div', { class: 'row between' },
                h('div', { class: 'row center' }, dot(m), h('div', {}, h('strong', {}, m.name), h('small', { class: 'muted' }, meta))),
                h('div', { class: 'row center' }, h('b', {}, `+${total}`),
                    h('button', { type: 'button', class: 'btn-x', 'aria-label': 'Apagar treino', onclick: () => removeSession(g) }, '×'))),
            h('ul', { class: 'list' }, g.items.map((l) => {
                const e = exerciseById(l.e);
                return e ? h('li', {}, h('div', { class: 'grow' }, e.name, h('small', {}, logDetail(l, e))), h('b', {}, `+${points(l)}`)) : null;
            })),
            g.note ? h('p', { class: 'note' }, g.note) : null);
    }

    function renderTrain() {
        const root = document.getElementById('logBox');
        root.replaceChildren();
        const all = groups().filter((g) => memberById(g.m));
        if (!all.length) {
            root.append(h('div', { class: 'panel' }, h('h2', {}, 'Histórico'), h('p', { class: 'empty' }, 'Ainda sem treinos.')));
            return;
        }
        (ui.more ? all : all.slice(0, 5)).forEach((g) => root.append(sessionPanel(g)));
        if (all.length > 5) {
            root.append(h('button', { type: 'button', class: 'secondary', onclick: () => { ui.more = !ui.more; renderTrain(); } },
                ui.more ? 'Ver menos' : `Ver todos (${all.length})`));
        }
    }

    async function removeSession(g) {
        if (!(await confirmDialog('Apagar este treino do histórico?'))) return;
        const ids = new Set(g.items.map((l) => l.id));
        db.log = db.log.filter((l) => !ids.has(l.id));
        save();
        renderAll();
    }

    // ---------- Exercícios personalizados ----------
    function addExercise({ name, muscle, equip, kind, note }) {
        name = String(name || '').trim().slice(0, 40);
        if (name.length < 2) { toast('Dá um nome ao exercício.'); return null; }
        if (CATALOG.some((e) => e.name.toLowerCase() === name.toLowerCase())) { toast('Já existe um exercício com esse nome.'); return null; }
        const ex = {
            id: `c_${uid().replace(/-/g, '').slice(0, 10)}`,
            name,
            muscle: String(muscle || '').trim().slice(0, 24) || 'Outro',
            equip: String(equip || '').trim().slice(0, 24) || 'Peso corporal',
            kind: KINDS.includes(kind) ? kind : 'reps',
            k: kind === 'time' ? 5 : 1,
            note: String(note || '').trim().slice(0, 300),
        };
        custom.push(ex);
        saveCustom();
        CATALOG.push({ ...ex, custom: true });
        renderAll();
        return ex;
    }

    function removeExercise(id) {
        const i = CATALOG.findIndex((e) => e.id === id && e.custom);
        if (i < 0) return;
        CATALOG.splice(i, 1);
        custom = custom.filter((e) => e.id !== id);
        saveCustom();
        db.log = db.log.filter((l) => l.e !== id);
        save();
        window.Plan?.purge(id);
        renderAll();
    }

    // ---------- Ranking ----------
    function bars(memberIds, sums) {
        const rows = memberIds.map(memberById).filter(Boolean)
            .map((m) => ({ m, pts: sums.get(m.id) || 0 })).sort((a, b) => b.pts - a.pts);
        const max = Math.max(1, ...rows.map((r) => r.pts));
        return h('div', { class: 'bars' }, rows.map((r, i) =>
            h('div', { class: 'bar-row' },
                h('span', { class: 'bar-name' }, MEDALS[i] || '', ' ', r.m.name),
                h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill', style: `width:${(r.pts / max) * 100}%;background:${r.m.color}` })),
                h('b', {}, r.pts))));
    }

    function leadLine(team, sums) {
        const rows = team.memberIds.map(memberById).filter(Boolean)
            .map((m) => ({ m, pts: sums.get(m.id) || 0 })).sort((a, b) => b.pts - a.pts);
        if (rows.length < 2) return '';
        const diff = rows[0].pts - rows[1].pts;
        return diff === 0 ? 'Empate!' : `${rows[0].m.name} lidera por ${diff} pts`;
    }

    function renderRank() {
        const root = document.getElementById('view-rank');
        root.replaceChildren();
        const since = ui.period === 'week' ? Date.now() - 7 * DAY : 0;
        const sums = totals(since);

        const toggle = h('div', { class: 'seg' }, [['week', 'Últimos 7 dias'], ['all', 'Sempre']].map(([v, t]) =>
            h('button', { type: 'button', class: ui.period === v ? 'on' : '', onclick: () => { ui.period = v; renderRank(); } }, t)));

        root.append(toggle);
        if (!db.members.length) { root.append(h('p', { class: 'empty' }, 'Sem perfis ainda.')); return; }

        root.append(h('div', { class: 'panel' }, h('h2', {}, 'Geral'), bars(db.members.map((m) => m.id), sums)));
        db.teams.forEach((t) => {
            root.append(h('div', { class: 'panel' },
                h('h2', {}, `⚔️ ${t.name}`), bars(t.memberIds, sums), h('p', { class: 'lead' }, leadLine(t, sums))));
        });
    }

    // ---------- Perfis e equipas ----------
    function renderProfiles() {
        const root = document.getElementById('view-profiles');
        root.replaceChildren();

        const memberForm = h('form', { class: 'panel', onsubmit: onAddMember },
            h('h2', {}, 'Novo perfil'),
            field('Nome', h('input', { name: 'name', required: true, maxlength: 24, autocomplete: 'off' })),
            h('div', { class: 'row' },
                field('Tipo', h('select', { name: 'role' }, ROLES.map((r) => h('option', { value: r }, r)))),
                field('Cor', h('input', { name: 'color', type: 'color', value: '#7c3aed' }))),
            h('button', { type: 'submit' }, 'Criar perfil'));

        const memberList = db.members.length
            ? h('ul', { class: 'list' }, db.members.map((m) =>
                h('li', {}, dot(m), h('div', { class: 'grow' }, h('strong', {}, m.name), h('small', {}, m.role)),
                    h('button', { class: 'btn-x', 'aria-label': 'Apagar', onclick: () => removeMember(m.id) }, '×'))))
            : null;

        const teamForm = db.members.length >= 2 ? h('form', { class: 'panel', onsubmit: onAddTeam },
            h('h2', {}, 'Nova equipa / casal'),
            field('Nome', h('input', { name: 'name', required: true, maxlength: 24, autocomplete: 'off' })),
            h('div', { class: 'checks' }, db.members.map((m) =>
                h('label', {}, h('input', { type: 'checkbox', name: 'member', value: m.id }), dot(m), m.name))),
            h('button', { type: 'submit' }, 'Criar equipa')) : null;

        const teamList = db.teams.length
            ? h('div', { class: 'panel' }, h('h2', {}, 'Equipas'), h('ul', { class: 'list' }, db.teams.map((t) =>
                h('li', {}, h('div', { class: 'grow' }, h('strong', {}, t.name),
                    h('small', {}, t.memberIds.map((id) => memberById(id)?.name).filter(Boolean).join(' vs '))),
                    h('button', { class: 'btn-x', 'aria-label': 'Apagar', onclick: () => removeTeam(t.id) }, '×')))))
            : null;

        root.append(...[memberForm, memberList && h('div', { class: 'panel' }, h('h2', {}, 'Perfis'), memberList), teamForm, teamList].filter(Boolean));
    }

    function onAddMember(event) {
        event.preventDefault();
        const f = new FormData(event.target);
        const name = String(f.get('name')).trim();
        if (!name) return;
        db.members.push({ id: uid(), name, role: f.get('role'), color: f.get('color') });
        save();
        renderAll();
    }

    function onAddTeam(event) {
        event.preventDefault();
        const f = new FormData(event.target);
        const memberIds = f.getAll('member');
        if (memberIds.length < 2) { toast('Escolhe pelo menos 2 perfis.'); return; }
        db.teams.push({ id: uid(), name: String(f.get('name')).trim(), memberIds });
        save();
        renderAll();
    }

    async function removeMember(id) {
        if (!(await confirmDialog('Apagar este perfil e o seu histórico?'))) return;
        db.members = db.members.filter((m) => m.id !== id);
        db.log = db.log.filter((l) => l.m !== id);
        db.teams.forEach((t) => { t.memberIds = t.memberIds.filter((x) => x !== id); });
        db.teams = db.teams.filter((t) => t.memberIds.length >= 2);
        save();
        renderAll();
    }

    async function removeTeam(id) {
        if (!(await confirmDialog('Apagar esta equipa?'))) return;
        db.teams = db.teams.filter((t) => t.id !== id);
        save();
        renderAll();
    }

    function renderAll() {
        renderTrain();
        renderRank();
        renderProfiles();
        document.dispatchEvent(new Event('fit:change'));
    }

    window.Fit = {
        h, svg, field, select, toast, confirmDialog, points, uid, lineChart,
        fmtDate, fmtShort, fmtNum, metric: (kind) => METRICS[kind] || METRICS.reps,
        series, best, valueOf, addExercise, removeExercise,
        exercises: CATALOG,
        byId: exerciseById,
        members: () => db.members,
        addLogs(member, entries) {
            entries.forEach((e) => db.log.push({ id: uid(), m: member, t: Date.now(), ...e }));
            save();
            renderAll();
        },
        lastSet(member, exerciseId) {
            for (let i = db.log.length - 1; i >= 0; i--) {
                const l = db.log[i];
                if (l.m === member && l.e === exerciseId && l.sets?.length) return l.sets.at(-1);
            }
            return null;
        },
    };

    renderAll();
})();
