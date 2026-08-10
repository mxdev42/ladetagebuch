// Service-Worker-Strategie testen — laufen lassen mit:
//   deno run --allow-read test/sw-test.js
//
// Führt sw.js mit Stubs für self/caches/fetch aus und prüft die
// fetch-Strategie: network-first für HTML, cache-first für Assets, und dass
// nur bei response.ok gecacht wird (sonst vergiftet eine 404 vom Deploy den
// Offline-Cache).

// Führt sw.js mit Stubs aus und prüft die fetch-Strategie.
const code = await Deno.readTextFile(new URL('../sw.js', import.meta.url));
let fail=0; const t=(n,c,e='')=>{console.log((c?'  ok   ':'  FAIL ')+n+(c?'':'  → '+e)); if(!c)fail++};

function run(fetchImpl, cacheState) {
  const handlers = {};
  const cache = {
    store: cacheState || {},
    put(k,v){ this.store[typeof k==='string'?k:k.url] = v; },
    match(k){ return Promise.resolve(this.store[typeof k==='string'?k:k.url]); },
    addAll(){ return Promise.resolve() },
  };
  const self_ = {
    addEventListener:(ev,fn)=>handlers[ev]=fn,
    location:{origin:'https://x.dev'}, skipWaiting:()=>{}, clients:{claim:()=>{}},
  };
  const caches = { open:()=>Promise.resolve(cache), keys:()=>Promise.resolve([]),
                   delete:()=>Promise.resolve(), match:(k)=>cache.match(k) };
  new Function('self','caches','fetch','URL','Promise', code)(self_, caches, fetchImpl, URL, Promise);
  return { handlers, cache };
}
const req = (url, mode='navigate') => ({ url, method:'GET', mode });
const resp = (body, ok) => ({ ok, status: ok?200:404, clone(){ return this }, body });

console.log('Service Worker — fetch-Strategie\n');

// 1. HTML online, 200 -> wird gecacht
let got;
let { handlers, cache } = run(() => Promise.resolve(resp('NEUE APP', true)));
await handlers.fetch({ request: req('https://x.dev/'), respondWith:p=>got=p });
await got;
t('200er HTML wird in den Cache gelegt', cache.store['./index.html']?.body==='NEUE APP',
  JSON.stringify(cache.store['./index.html']?.body));

// 2. HTML 404 (Deploy laeuft) -> darf NICHT cachen  [der gefixte Bug]
({ handlers, cache } = run(() => Promise.resolve(resp('404 Fehlerseite', false)),
                           { './index.html': resp('GUTE ALTE APP', true) }));
await handlers.fetch({ request: req('https://x.dev/'), respondWith:p=>got=p });
await got;
t('404 wird NICHT gecacht (Cache-Poisoning)', cache.store['./index.html'].body==='GUTE ALTE APP',
  cache.store['./index.html'].body);

// 3. offline -> Fallback aus dem Cache
({ handlers, cache } = run(() => Promise.reject(new Error('offline')),
                           { './index.html': resp('GECACHTE APP', true) }));
await handlers.fetch({ request: req('https://x.dev/'), respondWith:p=>got=p });
t('offline liefert die gecachte App', (await got).body==='GECACHTE APP');

// 4. statisches Asset: Cache-Treffer, kein Netz
let netCalls = 0;
({ handlers, cache } = run(() => { netCalls++; return Promise.resolve(resp('vom netz', true)) },
                           { 'https://x.dev/fonts/syne.woff2': resp('gecachte font', true) }));
await handlers.fetch({ request: req('https://x.dev/fonts/syne.woff2','no-cors'), respondWith:p=>got=p });
t('Font kommt aus dem Cache, ohne Netz', (await got).body==='gecachte font' && netCalls===0, `netCalls=${netCalls}`);

// 5. statisches Asset ohne Cache -> Netz + nachcachen
({ handlers, cache } = run(() => Promise.resolve(resp('frisch', true)), {}));
await handlers.fetch({ request: req('https://x.dev/fonts/neu.woff2','no-cors'), respondWith:p=>got=p });
await got;
t('unbekanntes Asset wird nachgecacht', cache.store['https://x.dev/fonts/neu.woff2']?.body==='frisch');

// 6. fremde Origin -> SW haelt sich raus
({ handlers } = run(() => Promise.resolve(resp('x', true))));
let touched = false;
handlers.fetch({ request: req('https://fremd.example/a.js','no-cors'), respondWith:()=>touched=true });
t('fremde Origin wird nicht abgefangen', !touched);

// 7. POST -> ignoriert
touched = false;
handlers.fetch({ request: {url:'https://x.dev/', method:'POST', mode:'cors'}, respondWith:()=>touched=true });
t('POST wird nicht abgefangen', !touched);

console.log(fail===0 ? '\n✅ Service-Worker-Logik grün' : `\n❌ ${fail} fehlgeschlagen`);
if (fail) Deno.exit(1);
