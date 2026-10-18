import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/* The Hán of the seals and the astrological glyphs come from two fonts asked for only with the characters the pages
   use (Google Fonts' text=…), so a page loads a few kilobytes instead of a whole CJK font. The lists are read from
   the source each time the page is served or built. */
const GLYPHS = '☉☽☿♀♂♃♄♅♆♇♈♉♊♋♌♍♎♏♐♑♒♓☊☋⚷⚸⊗☌☍□△⚹⚺⚻⚼∠☞✦';
const isHan = (c: string) => c >= '㐀' && c <= '鿿';
const isSym = (c: string) => { const n = c.codePointAt(0)!; return n >= 0x2190 && n <= 0x2bff && !(n >= 0x2500 && n <= 0x257f) && !'→←↑↓↔'.includes(c); };
function sourceChars(dir: string, out = new Set<string>()): Set<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) sourceChars(p, out);
    else if (/\.(tsx?|css)$/.test(e.name)) for (const c of readFileSync(p, 'utf8')) if (isHan(c) || isSym(c)) out.add(c);
  }
  return out;
}
function fontSubsets(): Plugin {
  return {
    name: 'font-subsets',
    transformIndexHtml(html) {
      const all = [...sourceChars(fileURLToPath(new URL('./src', import.meta.url))), ...GLYPHS];
      const han = [...new Set(all.filter(isHan))].sort().join('');
      const sym = [...new Set(all.filter(c => !isHan(c)))].sort().join('');
      return html.replace('text=HAN', `text=${encodeURIComponent(han)}`).replace('text=SYM', `text=${encodeURIComponent(sym)}`);
    },
  };
}

/* VITE_API_URL is baked in at build time (the API's public address). In development /api goes to a local API. */
export default defineConfig({
  plugins: [react(), fontSubsets()],
  server: { port: 5173, proxy: { '/api': process.env.API_PROXY ?? 'http://localhost:3100' } },
  build: { chunkSizeWarningLimit: 900 },
});
