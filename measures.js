// Medidas corporais: peso, gordura e perímetros, com evolução e gráfico por perfil.
(() => {
    'use strict';
    const { h, field, select, toast, confirmDialog } = window.Fit;

    const KEY = 'fit_measures_v1';
    const FIELDS = [
        ['weight', 'Peso', 'kg'],
        ['fat', 'Gordura corporal', '%'],
        ['chest', 'Peito', 'cm'],
        ['waist', 'Cintura', 'cm'],
        ['hips', 'Anca', 'cm'],
        ['shoulders', 'Ombros', 'cm'],
        ['arm', 'Braço', 'cm'],
        ['thigh', 'Coxa', 'cm'],
        ['calf', 'Gémeo', 'cm'],
        ['neck', 'Pescoço', 'cm'],
    ];
    const META = Object.fromEntries(FIELDS.map(([k, label, unit]) => [k, { label, unit }]));

    const today = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const stamp = (d) => new Date(`${d}T12:00:00`).getTime();
    const fmtDay = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' });

    function read() {
        try {
            const list = JSON.parse(localStorage.getItem(KEY));
            return Array.isArray(list) ? list.filter((e) => e && e.m && e.d && e.v) : [];
        } catch { return []; }
    }

    let data = read();
    const ui = { member: '', metric: 'weight', draft: null };
    const save = () => localStorage.setItem(KEY, JSON.stringify(data));

    function ensureMember() {
        if (!Fit.members().some((m) => m.id === ui.member)) ui.member = Fit.me() || Fit.members()[0]?.id || '';
    }

    function purge() {
        const ids = new Set(Fit.members().map((m) => m.id));
        const kept = data.filter((e) => ids.has(e.m));
        if (kept.length !== data.length) { data = kept; save(); }
    }

    const mine = () => data.filter((e) => e.m === ui.member).sort((a, b) => a.t - b.t);
    const pointsFor = (key) => mine().filter((e) => e.v[key] != null).map((e) => ({ t: e.t, v: e.v[key] }));

    // ---------- Registo ----------
    function onSave(event) {
        event.preventDefault();
        const f = new FormData(event.target);
        const d = String(f.get('d') || today());
        const v = {};
        FIELDS.forEach(([key]) => {
            const n = parseFloat(String(f.get(key)).replace(',', '.'));
            if (Number.isFinite(n) && n > 0 && n < 1000) v[key] = Math.round(n * 10) / 10;
        });
        if (!Object.keys(v).length) { toast('Preenche pelo menos uma medida.'); return; }

        const existing = data.find((e) => e.m === ui.member && e.d === d);
        if (existing) existing.v = { ...existing.v, ...v };
        else data.push({ id: Fit.uid(), m: ui.member, d, t: stamp(d), v });
        ui.draft = null;
        save();
        toast('Medidas guardadas');
        render();
    }

    async function remove(entry) {
        if (!(await confirmDialog(`Apagar o registo de ${fmtDay(entry.d)}?`))) return;
        data = data.filter((e) => e.id !== entry.id);
        save();
        render();
    }

    // ---------- UI ----------
    function formPanel() {
        const draft = ui.draft || { d: today(), v: {} };
        return h('form', { class: 'panel', onsubmit: onSave },
            h('h2', {}, ui.draft ? 'Editar registo' : 'Novo registo'),
            field('Data', h('input', { type: 'date', name: 'd', value: draft.d, max: today(), required: true })),
            h('div', { class: 'grid2' }, FIELDS.map(([key, label, unit]) =>
                field(`${label} (${unit})`, h('input', {
                    type: 'number', name: key, step: '0.1', min: 0, inputmode: 'decimal',
                    value: draft.v[key] ?? '', placeholder: '—',
                })))),
            h('button', { type: 'submit' }, 'Guardar'),
            ui.draft ? h('button', { type: 'button', class: 'secondary', onclick: () => { ui.draft = null; render(); } }, 'Cancelar edição') : null);
    }

    function deltaText(points, unit) {
        if (points.length < 2) return '';
        const diff = Math.round((points.at(-1).v - points.at(-2).v) * 10) / 10;
        if (diff === 0) return '= igual';
        return `${diff > 0 ? '▲' : '▼'} ${Fit.fmtNum(Math.abs(diff))} ${unit}`;
    }

    function overviewPanel() {
        const tiles = FIELDS.map(([key, label, unit]) => {
            const pts = pointsFor(key);
            if (!pts.length) return null;
            return h('button', {
                type: 'button', class: `tile${ui.metric === key ? ' on' : ''}`,
                onclick: () => { ui.metric = key; render(); },
            }, h('small', {}, label), h('b', {}, `${Fit.fmtNum(pts.at(-1).v)} ${unit}`), h('small', { class: 'delta' }, deltaText(pts, unit) || ' '));
        }).filter(Boolean);
        if (!tiles.length) return h('div', { class: 'panel' }, h('h2', {}, 'Resumo'), h('p', { class: 'empty' }, 'Ainda sem medidas. Regista a primeira acima.'));
        return h('div', { class: 'panel' }, h('h2', {}, 'Resumo'), h('div', { class: 'tiles' }, tiles));
    }

    function chartPanel() {
        const pts = pointsFor(ui.metric);
        const { label, unit } = META[ui.metric];
        if (!pts.length) return null;
        const total = Math.round((pts.at(-1).v - pts[0].v) * 10) / 10;
        return h('div', { class: 'panel' },
            h('h2', {}, `Evolução · ${label}`),
            Fit.lineChart(pts, unit),
            pts.length > 1
                ? h('p', { class: 'lead' }, `${Fit.fmtNum(pts[0].v)} → ${Fit.fmtNum(pts.at(-1).v)} ${unit} (${total > 0 ? '+' : ''}${Fit.fmtNum(total)})`)
                : null);
    }

    function historyPanel() {
        const entries = mine().reverse();
        if (!entries.length) return null;
        return h('div', { class: 'panel' }, h('h2', {}, 'Histórico'),
            h('ul', { class: 'list' }, entries.slice(0, 20).map((e) => h('li', {},
                h('button', {
                    type: 'button', class: 'grow link-btn', 'aria-label': `Editar registo de ${fmtDay(e.d)}`,
                    onclick: () => { ui.draft = { d: e.d, v: { ...e.v } }; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
                }, h('strong', {}, fmtDay(e.d)),
                    h('small', {}, FIELDS.filter(([k]) => e.v[k] != null).map(([k, l, u]) => `${l} ${Fit.fmtNum(e.v[k])} ${u}`).join(' · '))),
                h('button', { type: 'button', class: 'btn-x', 'aria-label': 'Apagar', onclick: () => remove(e) }, '×')))));
    }

    function render() {
        const root = document.getElementById('view-measures');
        root.replaceChildren();
        purge();
        if (!Fit.members().length) { root.append(Fit.onboarding()); return; }
        ensureMember();
        if (!pointsFor(ui.metric).length) ui.metric = FIELDS.find(([k]) => pointsFor(k).length)?.[0] ?? 'weight';

        root.append(...[
            Fit.members().length > 1
                ? h('div', { class: 'panel' }, field('Medidas de', select('m', Fit.members().map((m) => [m.id, m.name]), ui.member, (v) => { ui.member = v; ui.draft = null; render(); })))
                : null,
            formPanel(), overviewPanel(), chartPanel(), historyPanel(),
        ].filter(Boolean));
    }

    window.Measures = {
        exportFor: (member) => data.filter((e) => e.m === member),
        importFor(member, entries) {
            if (!Array.isArray(entries)) return;
            const have = new Set(data.map((e) => e.id));
            entries.slice(0, 2000).forEach((raw) => {
                const id = String(raw?.id || '');
                const d = String(raw?.d || '');
                if (!/^[\w-]{1,64}$/.test(id) || have.has(id) || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
                const v = {};
                FIELDS.forEach(([key]) => {
                    const n = Number(raw.v?.[key]);
                    if (Number.isFinite(n) && n > 0 && n < 1000) v[key] = Math.round(n * 10) / 10;
                });
                if (!Object.keys(v).length) return;
                const same = data.find((e) => e.m === member && e.d === d);
                if (same) same.v = { ...same.v, ...v };
                else data.push({ id, m: member, d, t: stamp(d), v });
                have.add(id);
            });
            save();
            render();
        },
    };

    document.addEventListener('fit:change', render);
    render();
})();
