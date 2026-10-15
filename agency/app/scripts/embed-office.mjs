// Copies the single-file office build into the app as an asset.
//   agency/dist-office/agency.html  →  agency/app/assets/office/office.html
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../../dist-office/agency.html');
const dst = path.resolve(here, '../assets/office/office.html');
if (!fs.existsSync(src)) {
  console.error(`[embed-office] ${src} não existe — rode "npm run office:build" em agency/.`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.copyFileSync(src, dst);
console.log(
  `[embed-office] ${path.relative(process.cwd(), dst)} (${(fs.statSync(dst).size / 1024).toFixed(0)} KB)`,
);
