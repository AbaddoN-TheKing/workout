// Treinos, perfis, equipas (casais) e ranking. Dados em localStorage.
(() => {
    'use strict';

    const KEY = 'fit_data_v1';
    const DAY = 864e5;

    const CATALOG = window.EXERCISES;
    const ROLES = ['Homem', 'Mulher', 'Outro'];
    const MEDALS = ['🥇', '🥈', '🥉'];

    // ---------- Dados ----------
    const empty = () => ({ members: [], teams: [], log: [] });

    function load() {
        try { return { ...empty(), ...JSON.parse(localStorage.getItem(KEY)) }; }
        catch { return empty(); }
    }

    let db = load();
    const ui = { member: '', exercise: CATALOG[0].id, period: 'week' };

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

    // ---------- Treinos (últimos registos) ----------
    function logDetail(l, ex) {
        if (l.sets) {
            if (ex.kind === 'time') return `${l.sets.reduce((a, x) => a + x.min, 0)} min`;
            const best = Math.max(...l.sets.map((x) => x.kg));
            return `${l.sets.length} séries${ex.kind === 'load' ? ` · até ${best} kg` : ''}`;
        }
        return ex.kind === 'time' ? `${l.min} min` : `${l.s}×${l.r}${ex.kind === 'load' ? ` · ${l.kg} kg` : ''}`;
    }

    function renderTrain() {
        const root = document.getElementById('logBox');
        root.replaceChildren();
        const recent = db.log.slice(-8).reverse().map((l) => {
            const m = memberById(l.m);
            const e = exerciseById(l.e);
            if (!m || !e) return null;
            return h('li', {},
                dot(m),
                h('div', { class: 'grow' }, h('strong', {}, m.name), ` · ${e.name}`, h('small', {}, logDetail(l, e))),
                h('b', {}, `+${points(l)}`),
                h('button', { class: 'btn-x', 'aria-label': 'Apagar', onclick: () => removeLog(l.id) }, '×'));
        });
        root.append(h('div', { class: 'panel' }, h('h2', {}, 'Últimos registos'),
            recent.some(Boolean) ? h('ul', { class: 'list' }, recent) : h('p', { class: 'empty' }, 'Ainda sem treinos.')));
    }

    function removeLog(id) {
        db.log = db.log.filter((l) => l.id !== id);
        save();
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

        root.append(memberForm, memberList && h('div', { class: 'panel' }, h('h2', {}, 'Perfis'), memberList), teamForm, teamList);
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
        h, field, select, toast, confirmDialog, points,
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
