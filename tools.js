// Ferramentas: calorias e macros, IMC, zonas de frequência cardíaca, 1RM, discos e hidratação.
(() => {
    'use strict';
    const { h, field, select } = window.Fit;

    const KEY = 'fit_tools_v1';
    const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
    let saved = read();
    const store = (name, value) => { saved[name] = value; localStorage.setItem(KEY, JSON.stringify(saved)); };

    function lastWeight() {
        const id = Fit.me() || Fit.members()[0]?.id;
        if (!id || !window.Measures) return null;
        const w = window.Measures.exportFor(id).filter((e) => e.v.weight != null).sort((a, b) => b.t - a.t)[0];
        return w ? w.v.weight : null;
    }

    const val = (name, fallback = '') => saved[name] ?? fallback;
    const n = (form, name) => parseFloat(String(new FormData(form).get(name)).replace(',', '.'));
    const ok = (...v) => v.every((x) => Number.isFinite(x) && x > 0);
    const round = (v, d = 0) => Math.round(v * 10 ** d) / 10 ** d;

    function input(label, name, fallback, attrs = {}) {
        return field(label, h('input', { type: 'number', name, inputmode: 'decimal', step: 'any', min: 0, value: val(name, fallback), ...attrs }));
    }

    function pick(label, name, options, fallback) {
        return field(label, select(name, options, String(val(name, fallback)), (v) => { store(name, v); }));
    }

    // Cria um painel de ferramenta: compute(form) devolve um nó/array com o resultado
    function tool(id, title, hint, fields, compute) {
        const out = h('div', { class: 'tool-out' });
        const form = h('form', { class: 'tool-form', onsubmit: (e) => e.preventDefault() }, fields, out);
        const run = () => {
            out.replaceChildren();
            try {
                const res = compute(form);
                if (res) out.append(...[].concat(res).filter(Boolean));
            } catch { /* entradas incompletas */ }
        };
        form.addEventListener('input', (e) => {
            if (e.target.name && e.target.type !== 'checkbox') store(e.target.name, e.target.value);
            run();
        });
        form.addEventListener('change', run);
        const box = h('details', { class: 'panel tool', id: `tool-${id}` },
            h('summary', {}, title), hint ? h('p', { class: 'muted small' }, hint) : null, form);
        run();
        return box;
    }

    const stat = (label, value, sub) => h('div', { class: 'stat-box' }, h('small', {}, label), h('b', {}, value), sub ? h('small', {}, sub) : null);
    const stats = (...items) => h('div', { class: 'stats wrap' }, items);

    // ---------- Calorias e macros ----------
    const ACTIVITY = [['1.2', t('Sedentário (sem exercício)')], ['1.375', t('Leve (1–3 treinos/semana)')], ['1.55', t('Moderado (3–5 treinos)')], ['1.725', t('Intenso (6–7 treinos)')], ['1.9', t('Muito intenso (2x/dia)')]];
    const GOAL_KCAL = [['-500', t('Perder gordura (−500 kcal)')], ['-250', t('Perder devagar (−250 kcal)')], ['0', t('Manter peso')], ['250', t('Ganhar devagar (+250 kcal)')], ['400', t('Ganhar músculo (+400 kcal)')]];

    const calories = () => tool('cal', t('🔥 Calorias e macros'), t('Estimativa pela fórmula de Mifflin-St Jeor. Usa como ponto de partida e ajusta com a evolução do peso.'),
        [h('div', { class: 'row' }, pick(t('Sexo'), 'sex', [['m', t('Homem')], ['f', t('Mulher')]], 'm'), input(t('Idade'), 'age', 30)),
            h('div', { class: 'row' }, input(t('Altura (cm)'), 'height', 175), input(t('Peso (kg)'), 'weight', lastWeight() ?? 75)),
            pick(t('Atividade'), 'activity', ACTIVITY, '1.55'), pick(t('Objetivo'), 'kgoal', GOAL_KCAL, '0')],
        (f) => {
            const age = n(f, 'age'), height = n(f, 'height'), weight = n(f, 'weight');
            if (!ok(age, height, weight)) return null;
            const bmr = 10 * weight + 6.25 * height - 5 * age + (new FormData(f).get('sex') === 'f' ? -161 : 5);
            const tdee = bmr * Number(new FormData(f).get('activity'));
            const target = Math.max(1200, tdee + Number(new FormData(f).get('kgoal')));
            const protein = round(weight * 2);
            const fat = round((target * 0.25) / 9);
            const carbs = Math.max(0, round((target - protein * 4 - fat * 9) / 4));
            return [stats(stat(t('Metabolismo basal'), `${round(bmr)} kcal`), stat(t('Manutenção (TDEE)'), `${round(tdee)} kcal`), stat(t('Objetivo diário'), `${round(target)} kcal`)),
                h('strong', {}, t('Macros sugeridos')),
                stats(stat(t('Proteína'), `${protein} g`, '2 g/kg'), stat(t('Hidratos'), `${carbs} g`), stat(t('Gordura'), `${fat} g`, '25% kcal'))];
        });

    // ---------- IMC ----------
    const bmi = () => tool('bmi', t('⚖️ IMC'), t('O IMC é só uma referência: não distingue músculo de gordura.'),
        [h('div', { class: 'row' }, input(t('Altura (cm)'), 'height', 175), input(t('Peso (kg)'), 'weight', lastWeight() ?? 75))],
        (f) => {
            const height = n(f, 'height'), weight = n(f, 'weight');
            if (!ok(height, weight)) return null;
            const v = weight / (height / 100) ** 2;
            const cat = v < 18.5 ? t('Abaixo do peso') : v < 25 ? t('Peso normal') : v < 30 ? t('Excesso de peso') : t('Obesidade');
            const lo = round(18.5 * (height / 100) ** 2, 1), hi = round(24.9 * (height / 100) ** 2, 1);
            return [stats(stat(t('IMC'), String(round(v, 1)), cat), stat(t('Peso "normal"'), `${lo}–${hi} kg`, t('segundo a OMS')))];
        });

    // ---------- Zonas de FC ----------
    const ZONES = [[t('Z1 · Recuperação'), 0.5, 0.6], [t('Z2 · Base / queima de gordura'), 0.6, 0.7], [t('Z3 · Aeróbio'), 0.7, 0.8], [t('Z4 · Limiar'), 0.8, 0.9], [t('Z5 · Máximo'), 0.9, 1]];

    const hrZones = () => tool('hr', t('❤️ Zonas de frequência cardíaca'), t('FC máxima estimada (Tanaka: 208 − 0,7 × idade). Com a FC de repouso usa o método de Karvonen.'),
        [h('div', { class: 'row' }, input(t('Idade'), 'age', 30), input(t('FC repouso (opcional)'), 'rhr', ''))],
        (f) => {
            const age = n(f, 'age');
            if (!ok(age)) return null;
            const max = round(208 - 0.7 * age);
            const rest = n(f, 'rhr');
            const karvonen = ok(rest) && rest < max;
            const bpm = (p) => (karvonen ? round(rest + (max - rest) * p) : round(max * p));
            return [stats(stat(t('FC máxima'), `${max} bpm`), stat(t('Método'), karvonen ? 'Karvonen' : t('% da FC máx.'))),
                h('ul', { class: 'list' }, ZONES.map(([name, a, b]) => h('li', {}, h('span', { class: 'grow' }, name), h('b', {}, `${bpm(a)}–${bpm(b)} bpm`))))];
        });

    // ---------- 1RM ----------
    const PERCENTS = [[100, 1], [95, 2], [90, 4], [85, 6], [80, 8], [75, 10], [70, 12], [65, 16], [60, 20]];

    const oneRm = () => tool('rm', t('🏋️ Calculadora de 1RM'), t('Estima a carga máxima para 1 repetição a partir de uma série submáxima (até ~10 reps).'),
        [h('div', { class: 'row' }, input(t('Peso levantado (kg)'), 'rmkg', 60), input(t('Repetições'), 'rmreps', 8))],
        (f) => {
            const kg = n(f, 'rmkg'), reps = n(f, 'rmreps');
            if (!ok(kg, reps) || reps > 30) return null;
            const epley = kg * (1 + reps / 30);
            const brzycki = reps < 37 ? (kg * 36) / (37 - reps) : epley;
            const rm = reps === 1 ? kg : (epley + brzycki) / 2;
            return [stats(stat(t('1RM estimado'), `${round(rm, 1)} kg`)),
                h('ul', { class: 'list' }, PERCENTS.map(([p, r]) => h('li', {}, h('span', { class: 'grow' }, `${p}% · ~${r} ${t('reps')}`), h('b', {}, `${round((rm * p) / 100, 1)} kg`))))];
        });

    // ---------- Discos ----------
    const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

    const plates = () => tool('plates', t('💿 Calculadora de discos'), t('Quantos discos pôr de cada lado da barra.'),
        [h('div', { class: 'row' }, input(t('Peso total (kg)'), 'platekg', 100), pick(t('Barra'), 'bar', [['20', t('Olímpica 20 kg')], ['15', t('Feminina 15 kg')], ['10', t('Curta 10 kg')]], '20'))],
        (f) => {
            const total = n(f, 'platekg'), bar = Number(new FormData(f).get('bar'));
            if (!ok(total) || total < bar) return h('p', { class: 'empty' }, t('O peso total tem de ser maior que o da barra.'));
            let side = (total - bar) / 2;
            const used = [];
            PLATES.forEach((p) => { const c = Math.floor(side / p + 1e-9); if (c > 0) { used.push([p, c]); side = round(side - c * p, 3); } });
            const done = round(bar + 2 * used.reduce((a, [p, c]) => a + p * c, 0), 2);
            return [used.length
                ? h('div', { class: 'plate-row' }, used.flatMap(([p, c]) => Array.from({ length: c }, () => h('span', { class: `plate p${String(p).replace('.', '_')}` }, String(p)))))
                : h('p', { class: 'empty' }, t('Só a barra.')),
                h('p', { class: 'lead' }, used.length ? t('Por lado: {list}', { list: used.map(([p, c]) => `${c}×${p}`).join(' + ') }) : t('Sem discos')),
                done !== total ? h('p', { class: 'muted small' }, t('Com os discos habituais chegas a {kg} kg.', { kg: done })) : null];
        });

    // ---------- Hidratação ----------
    const water = () => tool('water', t('💧 Hidratação'), t('Referência: ~35 ml por kg de peso, mais 500 ml por cada hora de treino.'),
        [h('div', { class: 'row' }, input(t('Peso (kg)'), 'weight', lastWeight() ?? 75), input(t('Treino (horas/dia)'), 'trainh', 1))],
        (f) => {
            const weight = n(f, 'weight'), hours = n(f, 'trainh') || 0;
            if (!ok(weight)) return null;
            const ml = weight * 35 + hours * 500;
            return stats(stat(t('Por dia'), `${round(ml / 1000, 1)} L`, t('≈ {n} copos de 250 ml', { n: Math.round(ml / 250) })));
        });

    function render() {
        const root = document.getElementById('view-tools');
        const openId = root.querySelector('details[open]')?.id;
        root.replaceChildren();
        saved = read();
        root.append(
            h('div', { class: 'panel' }, h('h2', {}, t('Ferramentas')),
                h('p', { class: 'muted small' }, t('Calculadoras úteis para treino e nutrição. São estimativas e não substituem aconselhamento profissional.'))),
            calories(), oneRm(), plates(), hrZones(), bmi(), water());
        if (openId) root.querySelector(`#${openId}`)?.setAttribute('open', '');
    }

    document.addEventListener('viewchange', (e) => { if (e.detail === 'ferramentas') render(); });
    render();
})();
