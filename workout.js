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
    const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);
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

    // ---------- Perfis: validação, foto e avatar ----------
    const HEX = /^#[0-9a-f]{6}$/i;
    const ID = /^[\w-]{1,64}$/;
    const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
    const safeColor = (c) => (HEX.test(c) ? c : '#c6ff3d');
    const safePhoto = (p) => (typeof p === 'string' && p.length < 150000 && PHOTO.test(p) ? p : '');
    const clean = (v, n) => String(v ?? '').trim().slice(0, n);
    const clampGoal = (g) => Math.min(7, Math.max(1, Math.round(Number(g)) || 3));

    function processPhoto(file, size = 192) {
        return new Promise((resolve, reject) => {
            if (!file || !String(file.type).startsWith('image/')) { reject(new Error('Ficheiro inválido')); return; }
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const side = Math.min(img.width, img.height);
                canvas.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
                URL.revokeObjectURL(url);
                resolve(canvas.toDataURL('image/jpeg', 0.82));
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem inválida')); };
            img.src = url;
        });
    }

    function avatar(member, size = 40) {
        const el = h('span', {
            class: 'avatar',
            style: `--c:${safeColor(member.color)};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px`,
        });
        const photo = safePhoto(member.photo);
        if (photo) el.append(h('img', { src: photo, alt: '' }));
        else el.textContent = String(member.name || '?').trim().charAt(0).toUpperCase();
        return el;
    }
    const dot = (member) => avatar(member, 30);
    const toast = (msg) => { if (typeof showToast === 'function') showToast(msg); };
    const confirmDialog = (message) =>
        (typeof showDialog === 'function' ? showDialog({ message, type: 'confirm' }) : Promise.resolve(true));

    // ---------- Séries, recordes e gráficos ----------
    const METRICS = {
        load: { label: t('1RM estimado'), unit: 'kg' },
        reps: { label: t('Máx. reps numa série'), unit: t('reps') },
        time: { label: t('Tempo no dia'), unit: t('min') },
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
    const fmtDate = (t) => new Date(t).toLocaleDateString(I18n.locale, { weekday: 'short', day: 'numeric', month: 'short' });
    const fmtShort = (t) => new Date(t).toLocaleDateString(I18n.locale, { day: '2-digit', month: '2-digit' });
    const fmtNum = (v) => String(Math.round(v * 10) / 10);

    const SVGNS = 'http://www.w3.org/2000/svg';
    function svg(tag, attrs = {}, ...kids) {
        const el = document.createElementNS(SVGNS, tag);
        for (const [key, val] of Object.entries(attrs)) el.setAttribute(key, val);
        kids.flat().forEach((c) => { if (c != null) el.append(c); });
        return el;
    }

    // Gráfico de linhas: list = [{ color, points: [{ t, v }] }]
    function multiChart(list, unit = '') {
        const all = list.flatMap((l) => l.points);
        if (all.length < 2) {
            return h('p', { class: 'empty' }, all.length ? t('Precisas de 2 registos para ver o gráfico.') : t('Sem dados ainda.'));
        }
        const W = 320, H = 150, L = 38, R = 12, T = 12, B = 24;
        const xs = all.map((p) => p.t);
        const ys = all.map((p) => p.v);
        const x0 = Math.min(...xs), x1 = Math.max(...xs);
        const y0 = Math.min(...ys), y1 = Math.max(...ys);
        const pad = (y1 - y0) || Math.abs(y1) || 1;
        const lo = y0 - pad * 0.15, hi = y1 + pad * 0.15;
        const X = (t) => L + (x1 === x0 ? 0.5 : (t - x0) / (x1 - x0)) * (W - L - R);
        const Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
        const label = { style: 'fill:var(--text-sub);font-size:10px' };
        const el = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', style: 'width:100%;height:auto', 'aria-label': t('Gráfico de evolução') },
            svg('line', { x1: L, x2: W - R, y1: Y(y1), y2: Y(y1), style: 'stroke:var(--line)' }),
            svg('line', { x1: L, x2: W - R, y1: Y(y0), y2: Y(y0), style: 'stroke:var(--line)' }),
            svg('text', { ...label, x: L - 4, y: Y(y1) + 3, 'text-anchor': 'end' }, fmtNum(y1)),
            svg('text', { ...label, x: L - 4, y: Y(y0) + 3, 'text-anchor': 'end' }, fmtNum(y0)),
            svg('text', { ...label, x: L, y: H - 6, 'text-anchor': 'start' }, fmtShort(x0)),
            svg('text', { ...label, x: W - R, y: H - 6, 'text-anchor': 'end' }, fmtShort(x1)),
            list.map((l) => {
                const color = l.color && HEX.test(l.color) ? l.color : 'var(--primary)';
                const pts = [...l.points].sort((a, b) => a.t - b.t);
                return [
                    svg('polyline', { points: pts.map((p) => `${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' '),
                        fill: 'none', 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', style: `stroke:${color}` }),
                    pts.map((p) => svg('circle', { cx: X(p.t), cy: Y(p.v), r: 3.5, style: `fill:${color}` },
                        svg('title', {}, `${l.name ? `${l.name} · ` : ''}${fmtShort(p.t)}: ${fmtNum(p.v)} ${unit}`))),
                ];
            }));
        return h('div', { class: 'chart' }, el);
    }

    const lineChart = (points, unit = '') => multiChart([{ points }], unit);

    // ---------- Treinos (histórico por sessão) ----------
    function logDetail(l, ex) {
        if (l.sets) {
            if (ex.kind === 'time') return `${l.sets.reduce((a, x) => a + x.min, 0)} ${t('min')}`;
            const top = l.sets.reduce((b, x) => (x.kg > b.kg || (x.kg === b.kg && x.r > b.r) ? x : b), l.sets[0]);
            const desc = tn(l.sets.length, '{n} série', '{n} séries');
            return ex.kind === 'load' ? `${desc} · ${t('melhor {kg} kg × {r}', { kg: top.kg, r: top.r })}` : `${desc} · ${t('melhor {r} reps', { r: top.r })}`;
        }
        return ex.kind === 'time' ? `${l.min} ${t('min')}` : `${l.s}×${l.r}${ex.kind === 'load' ? ` · ${l.kg} kg` : ''}`;
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
        const meta = [fmtDate(g.t), g.dur ? `${g.dur} ${t('min')}` : null].filter(Boolean).join(' · ');
        return h('div', { class: 'panel' },
            h('div', { class: 'row between' },
                h('div', { class: 'row center' }, dot(m), h('div', {}, h('strong', {}, m.name), h('small', { class: 'muted' }, meta))),
                h('div', { class: 'row center' }, h('b', {}, `+${total}`),
                    h('button', { type: 'button', class: 'btn-x', 'aria-label': t('Apagar treino'), onclick: () => removeSession(g) }, '×'))),
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
            root.append(h('div', { class: 'panel' }, h('h2', {}, t('Histórico')), h('p', { class: 'empty' }, t('Ainda sem treinos.'))));
            return;
        }
        (ui.more ? all : all.slice(0, 5)).forEach((g) => root.append(sessionPanel(g)));
        if (all.length > 5) {
            root.append(h('button', { type: 'button', class: 'secondary', onclick: () => { ui.more = !ui.more; renderTrain(); } },
                ui.more ? t('Ver menos') : t('Ver todos ({n})', { n: all.length })));
        }
    }

    async function removeSession(g) {
        if (!(await confirmDialog(t('Apagar este treino do histórico?')))) return;
        const ids = new Set(g.items.map((l) => l.id));
        db.log = db.log.filter((l) => !ids.has(l.id));
        save();
        renderAll();
    }

    // ---------- Exercícios personalizados ----------
    function addExercise({ name, muscle, equip, kind, note }) {
        name = String(name || '').trim().slice(0, 40);
        if (name.length < 2) { toast(t('Dá um nome ao exercício.')); return null; }
        if (CATALOG.some((e) => e.name.toLowerCase() === name.toLowerCase())) { toast(t('Já existe um exercício com esse nome.')); return null; }
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

    // ---------- Perfis e equipas (API) ----------
    const ME_KEY = 'fit_me_v1';
    const me = () => {
        const id = localStorage.getItem(ME_KEY);
        return memberById(id) ? id : '';
    };
    const setMe = (id) => { localStorage.setItem(ME_KEY, id); renderAll(); };

    function addMember({ id, name, role, color, photo, goal }) {
        name = clean(name, 24);
        if (!name) return null;
        const m = {
            id: id && ID.test(id) ? id : uid(), name, role: ROLES.includes(role) ? role : 'Outro',
            color: safeColor(color), photo: safePhoto(photo), goal: clampGoal(goal),
        };
        db.members.push(m);
        if (db.members.length === 1) localStorage.setItem(ME_KEY, m.id);
        save();
        renderAll();
        return m;
    }

    function updateMember(id, patch) {
        const m = memberById(id);
        if (!m) return;
        if ('name' in patch) { const n = clean(patch.name, 24); if (n) m.name = n; }
        if ('role' in patch && ROLES.includes(patch.role)) m.role = patch.role;
        if ('color' in patch) m.color = safeColor(patch.color);
        if ('photo' in patch) m.photo = safePhoto(patch.photo);
        if ('goal' in patch) m.goal = clampGoal(patch.goal);
        save();
        renderAll();
    }

    function removeMember(id) {
        db.members = db.members.filter((m) => m.id !== id);
        db.log = db.log.filter((l) => l.m !== id);
        db.teams.forEach((t) => { t.memberIds = t.memberIds.filter((x) => x !== id); });
        db.teams = db.teams.filter((t) => t.memberIds.length >= 2);
        save();
        renderAll();
    }

    function addTeam(name, memberIds) {
        name = clean(name, 24);
        if (!name || memberIds.length < 2) return null;
        db.teams.push({ id: uid(), name, memberIds });
        save();
        renderAll();
        return true;
    }

    function removeTeam(id) {
        db.teams = db.teams.filter((t) => t.id !== id);
        save();
        renderAll();
    }

    // ---------- Partilha: exportar / importar um perfil ----------
    function exportCore(id) {
        const m = memberById(id);
        if (!m) return null;
        return {
            member: { id: m.id, name: m.name, role: m.role, color: safeColor(m.color), photo: safePhoto(m.photo), goal: clampGoal(m.goal) },
            log: db.log.filter((l) => l.m === id),
            custom,
        };
    }

    function sanitizeLog(raw, memberId) {
        if (!raw || typeof raw !== 'object') return null;
        const num = (v, max) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= max ? n : 0; };
        const id = String(raw.id || '');
        const e = String(raw.e || '');
        const t = Number(raw.t);
        if (!ID.test(id) || !ID.test(e) || !Number.isFinite(t) || t < 0 || t > Date.now() + DAY) return null;
        const out = { id, m: memberId, t: Math.round(t), e };
        if (Array.isArray(raw.sets)) {
            out.sets = raw.sets.slice(0, 50).map((x) => ({ r: num(x?.r, 1000), kg: num(x?.kg, 2000), min: num(x?.min, 1000) }));
        } else {
            out.s = num(raw.s, 100); out.r = num(raw.r, 1000); out.kg = num(raw.kg, 2000); out.min = num(raw.min, 1000);
        }
        if (raw.sid && ID.test(String(raw.sid))) out.sid = String(raw.sid);
        if (raw.dur) out.dur = num(raw.dur, 1000);
        if (raw.note) out.note = clean(raw.note, 300);
        return out;
    }

    function importCore(bundle) {
        const info = bundle?.member;
        if (!info || !ID.test(String(info.id))) throw new Error('Perfil inválido');
        const fields = {
            name: clean(info.name, 24), role: ROLES.includes(info.role) ? info.role : 'Outro',
            color: safeColor(info.color), photo: safePhoto(info.photo), goal: clampGoal(info.goal),
        };
        if (!fields.name) throw new Error('Perfil sem nome');

        (Array.isArray(bundle.custom) ? bundle.custom : []).slice(0, 100).forEach((raw) => {
            const id = String(raw?.id || '');
            const name = clean(raw?.name, 40);
            if (!/^c_\w{1,32}$/.test(id) || !name || !KINDS.includes(raw.kind) || CATALOG.some((x) => x.id === id)) return;
            const ex = { id, name, muscle: clean(raw.muscle, 24) || 'Outro', equip: clean(raw.equip, 24) || 'Peso corporal',
                kind: raw.kind, k: raw.kind === 'time' ? 5 : 1, note: clean(raw.note, 300) };
            custom.push(ex);
            CATALOG.push({ ...ex, custom: true });
        });
        saveCustom();

        let m = memberById(info.id);
        const isNew = !m;
        if (m) Object.assign(m, fields);
        else { m = { id: String(info.id), ...fields }; db.members.push(m); }

        const have = new Set(db.log.map((l) => l.id));
        let added = 0;
        (Array.isArray(bundle.log) ? bundle.log : []).slice(0, 20000).forEach((raw) => {
            const l = sanitizeLog(raw, m.id);
            if (!l || have.has(l.id)) return;
            db.log.push(l);
            have.add(l.id);
            added++;
        });
        db.log.sort((x, y) => x.t - y.t);
        save();
        renderAll();
        return { id: m.id, name: m.name, isNew, added };
    }

    function renderAll() {
        renderTrain();
        document.dispatchEvent(new Event('fit:change'));
    }

    window.Fit = {
        h, svg, field, select, toast, confirmDialog, points, uid, lineChart,
        fmtDate, fmtShort, fmtNum, metric: (kind) => METRICS[kind] || METRICS.reps,
        series, best, valueOf, addExercise, removeExercise,
        avatar, processPhoto, safeColor, multiChart, data: () => db, roles: ROLES, dayMs: DAY,
        me, setMe, addMember, updateMember, removeMember, addTeam, removeTeam, exportCore, importCore,
        member: memberById,
        exercises: CATALOG,
        byId: exerciseById,
        members: () => db.members,
        teams: () => db.teams,
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
