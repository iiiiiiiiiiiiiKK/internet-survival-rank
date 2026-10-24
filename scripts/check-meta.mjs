const urls = [
  'https://iiiiiiiiiiiiiKK.github.io/internet-survival-rank/',
  'https://iiiiiiiiiiiiiKK.github.io/internet-survival-rank/#/tiers',
];
for (const u of urls) {
  try {
    const r = await fetch(u, { redirect: 'follow' });
    const html = await r.text();
    console.log(u, '->', r.status, 'final:', r.url, 'len', html.length);
  } catch (e) {
    console.log(u, 'ERR', e.message);
  }
}
