const res = await fetch('https://iiiiiiiiiiiiiKK.github.io/internet-survival-rank/', { redirect: 'follow' });
console.log('final url', res.url, 'status', res.status);
const html = await res.text();
console.log('len', html.length);
console.log('has canonical', /rel="canonical"/.test(html));
console.log('has og:image', /og:image/.test(html));
console.log('has author meta', /twitter:creator/.test(html));
