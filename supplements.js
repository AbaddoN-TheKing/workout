// Separador Suplementos: o que cada perfil toma (proteína, creatina, pré-treino…), em que dose e a que horas,
// com marcação diária de tomas. Dados só no dispositivo (e no ficheiro de partilha do perfil).
(() => {
    'use strict';
    const { h, field, select, toast, confirmDialog } = window.Fit;

    const KEY = 'fit_supps_v1';
    const ID = /^[\w-]{1,64}$/;
    const DATE = /^\d{4}-\d{2}-\d{2}$/;
    const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
    const KEEP_DAYS = 120;
    const CAFFEINE_LIMIT_MG = 400; // referência geral para adultos saudáveis (EFSA)

    // Tipos: valores iniciais sensatos que o utilizador ajusta.
    const KINDS = {
        protein: { emoji: '🥛', label: t('Proteína'), unit: 'g', dose: 30, protein: 24, when: ['post'], names: ['Whey', 'Isolado', 'Caseína', 'Vegetal'] },
        creatine: { emoji: '⚡', label: t('Creatina'), unit: 'g', dose: 5, when: ['wake'], names: ['Monohidratada', 'Creapure'] },
        preworkout: { emoji: '🔥', label: t('Pré-treino'), unit: 'scoop', dose: 1, caffeine: 150, when: ['pre'], names: [] },
        bcaa: { emoji: '💊', label: t('Aminoácidos (BCAA/EAA)'), unit: 'g', dose: 5, when: ['intra'], names: ['BCAA', 'EAA'] },
        omega3: { emoji: '🐟', label: t('Ómega-3'), unit: 'cap', dose: 2, when: ['meal'], names: [] },
        vitamin: { emoji: '🍊', label: t('Vitaminas e minerais'), unit: 'cap', dose: 1, when: ['wake'], names: ['Vitamina D', 'Magnésio', 'Multivitamínico'] },
        caffeine: { emoji: '☕', label: t('Cafeína'), unit: 'cap', dose: 1, caffeine: 100, when: ['pre'], names: [] },
        other: { emoji: '🧴', label: t('Outro'), unit: 'g', dose: 1, when: ['meal'], names: [] },
    };
    const UNITS = ['g', 'ml', 'mg', 'scoop', 'cap'];
    const WHEN = {
        wake: t('Ao acordar'), pre: t('Antes do treino'), intra: t('Durante o treino'), post: t('Depois do treino'),
        meal: t('Com refeição'), evening: t('Ao fim do dia'), bed: t('Antes de dormir'),
    };
    const WHEN_ORDER = Object.keys(WHEN);
    const DAYS = I18n.weekdays();

    const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
    let store = read(); // { membroId: { items: [], log: { 'AAAA-MM-DD': { 'itemId:i': timestamp } } } }
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* sem espaço */ } };
    const of = (member) => (store[member] ||= { items: [], log: {} });

    const pad = (n) => String(n).padStart(2, '0');
    const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const dayIndex = (d = new Date()) => (d.getDay() + 6) % 7; // 0 = segunda
    const clockOf = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
    const num = (v, max) => { const n = Number(v); return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n * 10) / 10 : 0; };

    const ui = { member: '', draft: null, editing: null };

    function ensureMember() {
        if (!Fit.members().some((m) => m.id === ui.member)) ui.member = Fit.me() || Fit.members()[0]?.id || '';
    }

    // ---------- Texto ----------
    function doseText(item) {
        if (item.unit === 'scoop') return tn(item.dose, '{n} medida', '{n} medidas');
        if (item.unit === 'cap') return tn(item.dose, '{n} cápsula', '{n} cápsulas');
        return `${item.dose} ${item.unit}`;
    }
    const itemName = (item) => item.name || KINDS[item.kind].label;
    const intakeText = (it) => `${WHEN[it.when]}${it.time ? ` · ${it.time}` : ''}`;

    // ---------- Tomas de um dia ----------
    function intakesOn(member, date) {
        const idx = dayIndex(new Date(`${date}T12:00:00`));
        return of(member).items
            .filter((item) => item.days.includes(idx))
            .flatMap((item) => item.intakes.map((it, i) => ({ item, it, key: `${item.id}:${i}` })))
            .sort((a, b) => WHEN_ORDER.indexOf(a.it.when) - WHEN_ORDER.indexOf(b.it.when) || a.it.time.localeCompare(b.it.time));
    }

    function toggle(member, date, key) {
        const day = (of(member).log[date] ||= {});
        if (day[key]) delete day[key]; else day[key] = Date.now();
        if (!Object.keys(day).length) delete of(member).log[date];
        save();
        render();
    }

    // ---------- Painéis ----------
    function totalsToday(member, date, list) {
        const taken = of(member).log[date] || {};
        return list.filter(({ key }) => taken[key]).reduce((sum, { item }) => ({
            protein: sum.protein + (item.protein || 0),
            caffeine: sum.caffeine + (item.caffeine || 0),
        }), { protein: 0, caffeine: 0 });
    }

    function todayPanel(member) {
        const date = dateKey();
        const list = intakesOn(member, date);
        const taken = of(member).log[date] || {};
        const done = list.filter(({ key }) => taken[key]).length;
        const sum = totalsToday(member, date, list);
        return h('div', { class: 'panel' },
            h('div', { class: 'row between' }, h('h2', {}, t('Hoje')),
                list.length ? h('span', { class: 'badge' }, `${done}/${list.length}`) : null),
            list.length
                ? h('div', { class: 'xp' }, h('i', { style: `width:${Math.round((done / list.length) * 100)}%` }))
                : h('p', { class: 'empty' }, t('Sem tomas para hoje. Adiciona um suplemento abaixo.')),
            h('ul', { class: 'list' }, list.map(({ item, it, key }) => h('li', {},
                h('button', {
                    type: 'button', class: `btn-ok supp-take${taken[key] ? ' on' : ''}`, 'aria-pressed': String(Boolean(taken[key])),
                    'aria-label': t('Marcar como tomado'), onclick: () => toggle(member, date, key),
                }, taken[key] ? '✓' : ''),
                h('div', { class: 'grow' }, h('strong', {}, `${KINDS[item.kind].emoji} ${itemName(item)}`),
                    h('small', {}, `${doseText(item)} · ${intakeText(it)}`),
                    taken[key] ? h('small', { class: 'muted' }, t('Tomado às {time}', { time: clockOf(taken[key]) })) : null)))),
            sum.protein || sum.caffeine ? h('div', { class: 'stats wrap' },
                sum.protein ? h('div', { class: 'stat-box' }, h('small', {}, t('Proteína de suplementos')), h('b', {}, `${Math.round(sum.protein)} g`)) : null,
                sum.caffeine ? h('div', { class: 'stat-box' }, h('small', {}, t('Cafeína')), h('b', {}, `${Math.round(sum.caffeine)} mg`)) : null) : null,
            sum.caffeine > CAFFEINE_LIMIT_MG
                ? h('p', { class: 'muted small' }, t('Atenção: acima de {mg} mg de cafeína por dia. Reduz se tiveres sintomas como insónia ou palpitações.', { mg: CAFFEINE_LIMIT_MG })) : null);
    }

    function weekPanel(member) {
        const today = dayIndex();
        const monday = new Date();
        monday.setDate(monday.getDate() - today);
        const cells = DAYS.map((label, i) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const date = dateKey(d);
            const list = intakesOn(member, date);
            const taken = of(member).log[date] || {};
            const done = list.filter(({ key }) => taken[key]).length;
            const state = !list.length ? '' : done === list.length ? ' full' : done ? ' part' : '';
            return h('div', { class: `supp-day${state}${i === today ? ' today' : ''}`, title: list.length ? `${done}/${list.length}` : '' },
                h('small', {}, label), h('b', {}, list.length ? (done === list.length ? '✓' : `${done}/${list.length}`) : '–'));
        });
        return h('div', { class: 'panel' }, h('h2', {}, t('Esta semana')), h('div', { class: 'supp-week' }, cells));
    }

    function planPanel(member) {
        const { items } = of(member);
        return h('div', { class: 'panel' }, h('h2', {}, t('O meu plano')),
            items.length ? h('ul', { class: 'list' }, items.map((item) => h('li', {},
                h('div', { class: 'grow' }, h('strong', {}, `${KINDS[item.kind].emoji} ${itemName(item)}`),
                    h('small', {}, `${doseText(item)}${item.protein ? ` · ${item.protein} g ${t('de proteína')}` : ''}${item.caffeine ? ` · ${item.caffeine} mg ${t('de cafeína')}` : ''}`),
                    h('small', { class: 'muted' }, item.intakes.map(intakeText).join(' · ')),
                    item.days.length < 7 ? h('small', { class: 'muted' }, item.days.map((d) => DAYS[d]).join(' ')) : null),
                h('button', { type: 'button', class: 'btn-x', 'aria-label': t('Editar'), onclick: () => startEdit(item) }, '✏️'),
                h('button', { type: 'button', class: 'btn-x', 'aria-label': t('Apagar'), onclick: () => remove(item) }, '×'))))
                : h('p', { class: 'empty' }, t('Ainda não registaste nenhum suplemento.')),
            h('div', { class: 'chips quick-add' }, Object.entries(KINDS).map(([kind, k]) =>
                h('button', { type: 'button', class: 'chip pick', onclick: () => startNew(kind) }, `${k.emoji} ${k.label}`))));
    }

    // ---------- Formulário (rascunho em memória) ----------
    const blankDraft = (kind) => {
        const k = KINDS[kind];
        return {
            id: '', kind, name: '', dose: k.dose, unit: k.unit, protein: k.protein || '', caffeine: k.caffeine || '',
            intakes: k.when.map((when) => ({ when, time: '' })), days: [0, 1, 2, 3, 4, 5, 6],
        };
    };

    function startNew(kind) { ui.draft = blankDraft(kind); ui.editing = null; render(); document.getElementById('suppForm')?.scrollIntoView({ behavior: 'smooth' }); }
    function startEdit(item) { ui.draft = JSON.parse(JSON.stringify(item)); ui.editing = item.id; render(); document.getElementById('suppForm')?.scrollIntoView({ behavior: 'smooth' }); }

    async function remove(item) {
        if (!(await confirmDialog(t('Apagar {name} do plano?', { name: itemName(item) })))) return;
        const data = of(ui.member);
        data.items = data.items.filter((x) => x.id !== item.id);
        save();
        render();
    }

    function submit(event) {
        event.preventDefault();
        const d = ui.draft;
        const dose = num(d.dose, 1000);
        if (!dose) { toast(t('Indica a dose.')); return; }
        if (!d.intakes.length) { toast(t('Adiciona pelo menos uma toma.')); return; }
        if (!d.days.length) { toast(t('Escolhe pelo menos um dia.')); return; }
        const item = {
            id: ui.editing || Fit.uid().replace(/-/g, '').slice(0, 12), kind: d.kind, name: String(d.name).trim().slice(0, 40),
            dose, unit: d.unit, protein: d.kind === 'protein' ? num(d.protein, 200) : 0,
            caffeine: ['preworkout', 'caffeine', 'other'].includes(d.kind) ? num(d.caffeine, 1000) : 0,
            intakes: d.intakes.map((it) => ({ when: it.when, time: TIME.test(it.time) ? it.time : '' })),
            days: [...d.days].sort(),
        };
        const data = of(ui.member);
        const at = data.items.findIndex((x) => x.id === item.id);
        if (at >= 0) data.items[at] = item; else data.items.push(item);
        save();
        ui.draft = null;
        ui.editing = null;
        toast(t('Suplemento guardado!'));
        render();
    }

    function intakeRow(it, i) {
        const d = ui.draft;
        return h('div', { class: 'row center intake-row' },
            select(`when${i}`, WHEN_ORDER.map((w) => [w, WHEN[w]]), it.when, (v) => { it.when = v; }),
            h('input', { type: 'time', value: it.time, 'aria-label': t('Hora (opcional)'), oninput: (e) => { it.time = e.target.value; } }),
            d.intakes.length > 1 ? h('button', { type: 'button', class: 'btn-x', 'aria-label': t('Remover'), onclick: () => { d.intakes.splice(i, 1); render(); } }, '×') : null);
    }

    function formPanel() {
        const d = ui.draft;
        if (!d) return null;
        const names = KINDS[d.kind].names;
        return h('form', { class: 'panel', id: 'suppForm', onsubmit: submit },
            h('h2', {}, ui.editing ? t('Editar suplemento') : t('Novo suplemento')),
            field(t('Tipo'), select('kind', Object.entries(KINDS).map(([k, v]) => [k, `${v.emoji} ${v.label}`]), d.kind, (v) => {
                const keep = { name: d.name };
                ui.draft = { ...blankDraft(v), ...keep, id: d.id };
                render();
            })),
            field(t('Marca / tipo (opcional)'), h('input', { name: 'name', value: d.name, maxlength: 40, autocomplete: 'off', list: 'suppNames', oninput: (e) => { d.name = e.target.value; } })),
            h('datalist', { id: 'suppNames' }, names.map((n) => h('option', { value: n }))),
            h('div', { class: 'row' },
                field(t('Dose'), h('input', { type: 'number', name: 'dose', min: 0, step: 'any', value: d.dose, inputmode: 'decimal', oninput: (e) => { d.dose = e.target.value; } })),
                field(t('Unidade'), select('unit', UNITS.map((u) => [u, u === 'scoop' ? t('medida') : u === 'cap' ? t('cápsula') : u]), d.unit, (v) => { d.unit = v; }))),
            d.kind === 'protein'
                ? field(t('Proteína por dose (g)'), h('input', { type: 'number', name: 'protein', min: 0, step: 'any', value: d.protein, inputmode: 'decimal', oninput: (e) => { d.protein = e.target.value; } })) : null,
            ['preworkout', 'caffeine', 'other'].includes(d.kind)
                ? field(t('Cafeína por dose (mg, opcional)'), h('input', { type: 'number', name: 'caffeine', min: 0, step: 'any', value: d.caffeine, inputmode: 'decimal', oninput: (e) => { d.caffeine = e.target.value; } })) : null,
            h('strong', {}, t('Quando tomas')),
            d.intakes.map(intakeRow),
            d.intakes.length < 4 ? h('button', { type: 'button', class: 'secondary', onclick: () => { d.intakes.push({ when: 'meal', time: '' }); render(); } }, t('＋ Adicionar toma')) : null,
            h('strong', {}, t('Dias da semana')),
            h('div', { class: 'seg days' }, DAYS.map((label, i) => h('button', {
                type: 'button', class: d.days.includes(i) ? 'on' : '', 'aria-pressed': String(d.days.includes(i)),
                onclick: () => { d.days = d.days.includes(i) ? d.days.filter((x) => x !== i) : [...d.days, i]; render(); },
            }, label))),
            h('div', { class: 'row' },
                h('button', { type: 'button', class: 'secondary', onclick: () => { ui.draft = null; ui.editing = null; render(); } }, t('Cancelar')),
                h('button', { type: 'submit' }, t('Guardar'))));
    }

    function render() {
        const root = document.getElementById('view-supps');
        root.replaceChildren();
        if (!Fit.members().length) { root.append(Fit.onboarding()); return; }
        ensureMember();
        root.append(...[
            h('div', { class: 'panel' }, h('h2', {}, t('Suplementos')),
                h('p', { class: 'muted small' }, t('Regista o que tomas, em que dose e quando. Informação geral: não substitui o aconselhamento de um profissional de saúde.')),
                Fit.members().length > 1 ? field(t('Perfil'), select('m', Fit.members().map((m) => [m.id, m.name]), ui.member, (v) => { ui.member = v; ui.draft = null; ui.editing = null; render(); })) : null),
            todayPanel(ui.member), weekPanel(ui.member), planPanel(ui.member), formPanel(),
        ].filter(Boolean));
    }

    // ---------- API para partilha (perfil exportado/importado) ----------
    function cleanItem(raw) {
        const id = String(raw?.id || '');
        if (!ID.test(id) || !KINDS[raw.kind]) return null;
        const unit = UNITS.includes(raw.unit) ? raw.unit : KINDS[raw.kind].unit;
        const dose = num(raw.dose, 1000);
        const intakes = (Array.isArray(raw.intakes) ? raw.intakes : []).slice(0, 4)
            .filter((it) => WHEN[it?.when]).map((it) => ({ when: it.when, time: TIME.test(it.time) ? it.time : '' }));
        const days = [...new Set((Array.isArray(raw.days) ? raw.days : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
        if (!dose || !intakes.length || !days.length) return null;
        return {
            id, kind: raw.kind, name: String(raw.name || '').slice(0, 40), dose, unit,
            protein: raw.kind === 'protein' ? num(raw.protein, 200) : 0,
            caffeine: ['preworkout', 'caffeine', 'other'].includes(raw.kind) ? num(raw.caffeine, 1000) : 0, intakes, days,
        };
    }

    window.Supps = {
        exportFor(member) {
            const data = of(member);
            const since = dateKey(new Date(Date.now() - KEEP_DAYS * Fit.dayMs));
            const log = Object.fromEntries(Object.entries(data.log).filter(([date]) => date >= since));
            return { items: data.items, log };
        },
        importFor(member, raw) {
            if (!raw || !Array.isArray(raw.items)) return;
            const data = of(member);
            data.items = raw.items.slice(0, 30).map(cleanItem).filter(Boolean);
            const keys = new Set(data.items.flatMap((item) => item.intakes.map((_, i) => `${item.id}:${i}`)));
            Object.entries(raw.log && typeof raw.log === 'object' ? raw.log : {}).slice(-KEEP_DAYS).forEach(([date, taken]) => {
                if (!DATE.test(date) || !taken || typeof taken !== 'object') return;
                Object.entries(taken).forEach(([key, ts]) => {
                    if (keys.has(key) && Number.isFinite(Number(ts))) (data.log[date] ||= {})[key] = Number(ts);
                });
            });
            save();
            render();
        },
    };

    document.addEventListener('fit:change', () => {
        // Remove dados de perfis que já não existem
        const ids = new Set(Fit.members().map((m) => m.id));
        const stale = Object.keys(store).filter((id) => !ids.has(id));
        if (stale.length) { stale.forEach((id) => delete store[id]); save(); }
        render();
    });
    document.addEventListener('viewchange', (e) => { if (e.detail === 'suplementos') render(); });
    render();
})();
