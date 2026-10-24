const urls = [
  'https://iiiiiiiiiiiiiKK.github.io/internet-survival-rank/',
  'https://321.market/internet-survival-rank/',
];

const res = await fetch(urls[1]);
const html = await res.text();
console.log('status', res.status, 'len', html.length);
console.log('title:', (html.match(/<title>(.*?)<\/title>/s) || [])[1]);
const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => m[1]);
console.log('assets:', assets);
for (const a of assets) {
  const u = new URL(a, urls[1]).href;
  const r = await fetch(u);
  const buf = await r.arrayBuffer();
  console.log(' ', u, r.status, r.headers.get('content-type'), buf.byteLength);
}
const favicon = [...html.matchAll(/<link[^>]+icon[^>]+>/g)].map((m) => m[0]);
console.log('favicon tags:', favicon.length);
