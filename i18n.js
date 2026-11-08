// Internacionalização. O texto-fonte é o português de Portugal: `t('Treinar')`.
// Cada idioma (i18n/*.js) acrescenta { ui, ex, tip } com as traduções:
//   ui  → chave = texto-fonte em português (valor string, ou objeto de plurais { one, few, many, other })
//   ex  → chave = id do exercício (nome traduzido)
//   tip → chave = id do exercício (dica de execução)
// Variantes (pt-BR, es-MX) só guardam as diferenças face ao idioma-pai.
(() => {
    'use strict';

    const KEY = 'fit_lang_v1';

    const LANGS = [
        { id: 'pt', name: 'Português (PT)', locale: 'pt-PT' },
        { id: 'pt-BR', name: 'Português (BR)', locale: 'pt-BR', parent: 'pt' },
        { id: 'en', name: 'English', locale: 'en-GB' },
        { id: 'fr', name: 'Français', locale: 'fr-FR' },
        { id: 'es', name: 'Español', locale: 'es-ES' },
        { id: 'es-MX', name: 'Español (MX)', locale: 'es-MX', parent: 'es' },
        { id: 'ro', name: 'Română', locale: 'ro-RO' },
        { id: 'pl', name: 'Polski', locale: 'pl-PL' },
        { id: 'hu', name: 'Magyar', locale: 'hu-HU' },
        { id: 'tr', name: 'Türkçe', locale: 'tr-TR' },
    ];

    const dicts = {};
    const byId = (id) => LANGS.find((l) => l.id === id);

    // ---------- Escolha do idioma ----------
    function detect() {
        const wanted = [...(navigator.languages || []), navigator.language].filter(Boolean);
        for (const raw of wanted) {
            const tag = raw.replace('_', '-');
            const [base, region] = tag.split('-');
            if (byId(tag)) return tag;
            if (base === 'es' && region && !['ES'].includes(region.toUpperCase())) return 'es-MX';
            if (base === 'pt') return region?.toUpperCase() === 'BR' ? 'pt-BR' : 'pt';
            if (byId(base)) return base;
        }
        return 'en';
    }

    function initial() {
        let saved = null;
        try { saved = localStorage.getItem(KEY); } catch { /* sem armazenamento */ }
        return byId(saved) ? saved : detect();
    }

    const lang = initial();
    const meta = byId(lang);
    const isPt = lang === 'pt' || lang === 'pt-BR';
    // Ordem de procura: idioma → pai → inglês (exceto família portuguesa, que usa o texto-fonte)
    const chain = [lang, meta.parent, isPt ? null : 'en'].filter(Boolean);

    const dictOf = (id) => (dicts[id] ||= { ui: {}, ex: {}, tip: {} });

    // Diferenças de uma variante (pt-BR, es-MX) face ao idioma-pai: add('pt-BR', { ui, ex, tip })
    function add(id, part) {
        ['ui', 'ex', 'tip'].forEach((k) => Object.assign(dictOf(id)[k], part[k] || {}));
    }

    // Tabela por linhas: addTable('ui', ['en', 'fr'], [['Treinar', 'Train', 'Entraîner'], …])
    // A 1.ª coluna é a chave (texto em português ou id do exercício); células vazias ficam por traduzir.
    function addTable(section, langs, rows) {
        rows.forEach(([key, ...cells]) => langs.forEach((id, i) => {
            if (cells[i] != null && cells[i] !== '') dictOf(id)[section][key] = cells[i];
        }));
    }

    const lookup = (section, key) => {
        for (const id of chain) {
            const v = dicts[id]?.[section]?.[key];
            if (v != null) return v;
        }
        return null;
    };

    const fill = (text, params) =>
        (params ? text.replace(/\{(\w+)\}/g, (m, k) => (k in params ? params[k] : m)) : text);

    // ---------- API de tradução ----------
    function t(key, params) {
        const v = lookup('ui', key);
        return fill(typeof v === 'string' ? v : key, params);
    }

    // Plurais: tn(n, singular, plural), com ambos os textos em português. A chave da tradução é a forma plural.
    function tn(n, one, other, params) {
        const p = { n, ...params };
        const v = lookup('ui', other);
        if (v && typeof v === 'object') {
            const rule = new Intl.PluralRules(meta.locale).select(n);
            return fill(v[rule] ?? v.other ?? other, p);
        }
        if (typeof v === 'string') return fill(v, p);
        return fill(n === 1 ? one : other, p);
    }

    const exName = (id, base) => lookup('ex', id) ?? base;
    const exTip = (id, base) => lookup('tip', id) ?? base;

    // Dias da semana (segunda → domingo) no idioma atual: 'Seg', 'Mon', 'Lun'…
    function weekdays(style = 'short') {
        const fmt = new Intl.DateTimeFormat(meta.locale, { weekday: style });
        const cap = (s) => s.replace(/\.$/, '').replace(/^./u, (c) => c.toLocaleUpperCase(meta.locale));
        return Array.from({ length: 7 }, (_, i) => cap(fmt.format(new Date(2024, 0, 1 + i)))); // 1 jan 2024 = segunda
    }

    // ---------- DOM estático ----------
    // `**negrito**` e `` `código` `` sem innerHTML.
    function rich(text) {
        const frag = document.createDocumentFragment();
        text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).forEach((part) => {
            if (!part) return;
            if (part.startsWith('**')) frag.append(Object.assign(document.createElement('strong'), { textContent: part.slice(2, -2) }));
            else if (part.startsWith('`')) frag.append(Object.assign(document.createElement('code'), { textContent: part.slice(1, -1) }));
            else frag.append(part);
        });
        return frag;
    }

    function apply(root = document) {
        root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
        root.querySelectorAll('[data-i18n-rich]').forEach((el) => { el.replaceChildren(rich(t(el.dataset.i18nRich))); });
        [['aria', 'aria-label'], ['ph', 'placeholder'], ['title', 'title'], ['alt', 'alt']].forEach(([short, attr]) => {
            root.querySelectorAll(`[data-i18n-${short}]`).forEach((el) => el.setAttribute(attr, t(el.getAttribute(`data-i18n-${short}`))));
        });
    }

    function set(id) {
        if (!byId(id)) return;
        try { localStorage.setItem(KEY, id); } catch { /* sem armazenamento */ }
        location.reload();
    }

    function mountPicker(select) {
        if (!select) return;
        select.replaceChildren(...LANGS.map((l) => Object.assign(document.createElement('option'), { value: l.id, textContent: l.name })));
        select.value = lang;
        select.addEventListener('change', () => set(select.value));
    }

    document.documentElement.lang = meta.locale;
    document.addEventListener('DOMContentLoaded', () => {
        apply();
        document.title = t('Fit Crew · Treina. Compete. Evolui.');
        document.querySelector('meta[name="description"]')?.setAttribute('content',
            t('Fit Crew: treinos, planos, medidas e ranking em família. Partilha perfis, compete com quem amas e mantém a sequência. Funciona offline (PWA).'));
        mountPicker(document.getElementById('langSelect'));
    });

    window.I18n = { add, addTable, t, tn, exName, exTip, weekdays, apply, rich, set, langs: LANGS, lang, locale: meta.locale };
    window.t = t;
    window.tn = tn;
})();
