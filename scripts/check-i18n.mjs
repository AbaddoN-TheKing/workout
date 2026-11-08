// Verifica se todas as chaves usadas no código têm tradução em todos os idiomas.
// Uso: node scripts/check-i18n.mjs [--list]       (sai com código 1 se faltar alguma tradução de interface)
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const SOURCES = fs.readdirSync(root).filter((f) => f.endsWith('.js') && !['sw.js'].includes(f));
const LANGS = ['en', 'fr', 'es', 'ro', 'pl', 'hu', 'tr'];

// 1) Chaves usadas no código: t('…') e tn(n, '…', '…')
const literal = String.raw`'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"`;
const unquote = (a, b) => vm.runInNewContext(a != null ? `'${a}'` : `"${b}"`);
const used = new Set();
for (const file of SOURCES) {
    const src = read(file);
    for (const m of src.matchAll(new RegExp(String.raw`(?<![\w.])t\(\s*(?:${literal})`, 'g'))) used.add(unquote(m[1], m[2]));
    for (const m of src.matchAll(new RegExp(String.raw`(?<![\w.])tn\([^,]+,\s*(?:${literal})\s*,\s*(?:${literal})`, 'g'))) {
        used.add(unquote(m[3], m[4])); // a chave é a forma plural
    }
}
for (const m of read('index.html').matchAll(/data-i18n(?:-rich|-aria|-ph|-title|-alt)?=(?:"([^"]*)"|'([^']*)')/g)) used.add(m[1] ?? m[2]);

// 2) Exercícios (ids, músculos, equipamentos)
const ctx = { t: (k) => k, I18n: { exName: (i, b) => b, exTip: (i, b) => b } };
ctx.window = ctx;
vm.createContext(ctx);
['exercises.js', 'exercises-extra.js'].forEach((f) => vm.runInContext(read(f), ctx, { filename: f }));
const exercises = ctx.EXERCISES;
exercises.forEach((e) => { used.add(e.muscle); used.add(e.equip); });
['Homem', 'Mulher', 'Outro'].forEach((k) => used.add(k));

// `--list` imprime as chaves de interface (útil para preparar traduções)
if (process.argv.includes('--list')) { [...used].forEach((k) => console.log(JSON.stringify(k))); process.exit(0); }

// 3) Dicionários carregados como no browser
const sandbox = { window: {}, document: { documentElement: {}, addEventListener() {}, querySelector() {} }, navigator: { languages: ['en'] }, localStorage: { getItem: () => 'en' }, location: {}, Intl };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(read('i18n.js'), sandbox);
const added = {};
for (const l of sandbox.I18n.langs) added[l.id] = { ui: {}, ex: {}, tip: {} };
const table = (section) => (langs, rows) => rows.forEach(([key, ...cells]) => langs.forEach((id, i) => { if (cells[i]) added[id][section][key] = cells[i]; }));
sandbox.I18n.addTable = (section, langs, rows) => table(section)(langs, rows);
sandbox.I18n.add = (id, part) => ['ui', 'ex', 'tip'].forEach((k) => Object.assign(added[id][k], part[k] || {}));
['i18n/ui.js', 'i18n/exercises.js', 'i18n/tips.js', 'i18n/variants.js'].forEach((f) => vm.runInContext(read(f), sandbox, { filename: f }));

let failures = 0;
const report = (title, missing, fatal) => {
    if (!missing.length) return;
    console.log(`\n${fatal ? '✗' : '!'} ${title} (${missing.length})`);
    missing.slice(0, 25).forEach((m) => console.log(`   ${m}`));
    if (missing.length > 25) console.log(`   … +${missing.length - 25}`);
    if (fatal) failures += missing.length;
};

for (const lang of LANGS) {
    report(`[${lang}] interface sem tradução`, [...used].filter((k) => !added[lang].ui[k]), true);
    report(`[${lang}] nomes de exercícios sem tradução`, exercises.filter((e) => !added[lang].ex[e.id]).map((e) => e.id), true);
    report(`[${lang}] dicas sem tradução (usa inglês)`, exercises.filter((e) => !added[lang].tip[e.id] && !added.en.tip[e.id]).map((e) => e.id), false);
}
const orphan = Object.keys(added.en.ui).filter((k) => !used.has(k));
report('chaves em en que já não são usadas', orphan, false);
console.log(`\n${used.size} textos, ${exercises.length} exercícios, ${LANGS.length} idiomas base → ${failures ? `${failures} em falta` : 'tudo traduzido ✓'}`);
process.exit(failures ? 1 : 0);
