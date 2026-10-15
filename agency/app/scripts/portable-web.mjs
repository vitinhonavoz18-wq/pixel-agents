// Turns the Expo web export (absolute /_expo and /assets URLs) into a
// PORTABLE build that runs from any sub-path of any static host:
//   - script/asset URLs become relative and resolve against a <base> set to
//     the directory the page was served from;
//   - the address bar is reset to "/" so Expo Router opens the office.
// Usage: node scripts/portable-web.mjs [srcDir=dist] [outDir=dist-portable]
import * as fs from 'node:fs';
import * as path from 'node:path';

const src = path.resolve(process.argv[2] ?? 'dist');
const out = path.resolve(process.argv[3] ?? 'dist-portable');
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });
// Some hosts reserve top-level names starting with "_".
if (fs.existsSync(path.join(out, '_expo')))
  fs.renameSync(path.join(out, '_expo'), path.join(out, 'expo-static'));

const BOOT = `<script>(function(){var d=location.pathname.replace(/[^/]*$/,'');var b=document.createElement('base');b.href=d;document.head.appendChild(b);if(location.pathname!=='/'){try{history.replaceState(null,'','/'+location.hash)}catch(e){}}})();</script>`;

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(p);
  }
})(out);

for (const f of files) {
  if (f.endsWith('.js')) {
    const code = fs.readFileSync(f, 'utf8').replace(/(["'`])\/assets\//g, '$1assets/');
    fs.writeFileSync(f, code);
  }
}

const indexPath = path.join(out, 'index.html');
let html = fs
  .readFileSync(indexPath, 'utf8')
  .replace(/src="\/_expo\//g, 'src="expo-static/')
  .replace(/href="\/favicon\.ico"/g, 'href="favicon.ico"')
  .replace('<head>', `<head>\n    ${BOOT}`);
fs.writeFileSync(indexPath, html);

// Body-only variant for hosts that wrap the page in their own skeleton.
const head = /<head>([\s\S]*?)<\/head>/.exec(html)?.[1] ?? '';
const body = /<body>([\s\S]*?)<\/body>/.exec(html)?.[1] ?? '';
const fragment = [
  '<title>PIXEL AGENCY</title>',
  BOOT,
  '<style>html,body{height:100%;margin:0;background:#0b1224;color-scheme:dark}body{overflow:hidden}#root{display:flex;height:100%;flex:1}</style>',
  body.replace(/<noscript>[\s\S]*?<\/noscript>/, '').trim(),
].join('\n');
fs.writeFileSync(path.join(out, 'page-fragment.html'), fragment + '\n');
void head;
console.log(`[portable-web] ${path.relative(process.cwd(), out)} (${files.length} files)`);
