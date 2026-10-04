# Inventario dipendenze segnalate da npm audit

Data di riferimento: 4 ottobre 2026. Le gravità sono quelle del registro npm, non una valutazione della sfruttabilità di VolleyBet.

I pacchetti dipendenti da un pacchetto vulnerabile sono conteggiati da npm separatamente. Il totale non equivale al numero di bug remoti confermati.

| Pacchetto | Versioni installate | Gravità npm | Percorso nel lockfile |
| --- | --- | --- | --- |
| @next/eslint-plugin-next | 16.2.7 | high | dev |
| baseline-browser-mapping | 2.10.33 | moderate | prod/optional |
| brace-expansion | 5.0.6, 1.1.15 | high | dev |
| braces | 3.0.3 | high | dev |
| browserslist | 4.28.2 | high | dev |
| eslint-config-next | 16.2.7 | high | dev |
| fast-glob | 3.3.1 | high | dev |
| js-yaml | 4.2.0 | high | dev |
| micromatch | 4.0.8 | high | dev |
| nanoid | 3.3.12 | high | prod/optional |
| next | 16.2.7 | critical | prod/optional |
| next-auth | 4.24.14 | critical | prod/optional |
| postcss | 8.5.15 | high | prod/optional |
| sharp | 0.34.5 | high | prod/optional |

## Avvisi distinti

- **baseline-browser-mapping (moderate)**: [baseline-browser-mapping process termination on invalid input causes denial of service](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv). Intervallo: `>=2.0.0 <2.11.0`.
- **brace-expansion (high)**: [brace-expansion: DoS via exponential-time expansion of consecutive non-expanding {} groups](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp). Intervallo: `<1.1.16`.
- **brace-expansion (high)**: [brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash](https://github.com/advisories/GHSA-mh99-v99m-4gvg). Intervallo: `<1.1.17`.
- **brace-expansion (high)**: [brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation](https://github.com/advisories/GHSA-rgw5-rvv9-x895). Intervallo: `>=4.0.0 <5.0.9`.
- **brace-expansion (moderate)**: [brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr). Intervallo: `<1.1.21`.
- **brace-expansion (high)**: [brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion](https://github.com/advisories/GHSA-qhr7-859c-m2p7). Intervallo: `<1.1.20`.
- **brace-expansion (high)**: [brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p). Intervallo: `<1.1.19`.
- **braces (high)**: [braces vulnerable to stack-exhaustion denial of service through deeply nested patterns](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Intervallo: `<=3.0.3`.
- **browserslist (high)**: [Browserslist: Unbounded memory growth (no cache eviction) via distinct query results, leading to eventual OOM](https://github.com/advisories/GHSA-c83g-rgw3-j3cx). Intervallo: `<=4.28.6`.
- **browserslist (high)**: [Browserslist: Uncaught crash / prototype write via untrusted browserslist-stats.json custom stats (normalizeStats)](https://github.com/advisories/GHSA-73wf-gq98-2v4g). Intervallo: `<=4.28.6`.
- **js-yaml (high)**: [js-yaml: YAML merge-key chains can force quadratic CPU consumption](https://github.com/advisories/GHSA-52cp-r559-cp3m). Intervallo: `>=4.0.0 <4.3.0`.
- **js-yaml (high)**: [JS-YAML: Quadratic CPU consumption in !!omap resolution (3.x and 4.x) — CVE-2026-59870 fix not backported](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj). Intervallo: `>=4.0.0 <4.3.1`.
- **js-yaml (high)**: [js-yaml: maxTotalMergeKeys does not limit CPU use for empty merge sources](https://github.com/advisories/GHSA-2883-xcg3-v3hh). Intervallo: `>=4.0.0 <4.3.2`.
- **nanoid (high)**: [nanoid: non-secure generators can loop indefinitely with negative size](https://github.com/advisories/GHSA-28wg-ghj8-5hjv). Intervallo: `<3.3.16`.
- **nanoid (high)**: [nanoid: custom generators can loop indefinitely when size is zero](https://github.com/advisories/GHSA-2v37-7h3g-55p8). Intervallo: `<3.3.18`.
- **next (high)**: [Next.js: Middleware / Proxy bypass in App Router applications using Turbopack and single locale](https://github.com/advisories/GHSA-6gpp-xcg3-4w24). Intervallo: `>=16.0.0 <16.2.11`.
- **next (high)**: [Next.js: Denial of Service in App Router using Server Actions](https://github.com/advisories/GHSA-m99w-x7hq-7vfj). Intervallo: `>=16.0.0 <16.2.11`.
- **next (high)**: [Next.js: Server-Side Request Forgery in Server Actions on custom servers](https://github.com/advisories/GHSA-89xv-2m56-2m9x). Intervallo: `>=16.0.0 <16.2.11`.
- **next (moderate)**: [Next.js: Cache confusion of response bodies for requests with bodies](https://github.com/advisories/GHSA-68g3-v927-f742). Intervallo: `>=16.0.0 <16.2.11`.
- **next (moderate)**: [Next.js: Cache confusion of response bodies for requests with bodies containing invalid UTF-8 byte sequences](https://github.com/advisories/GHSA-4633-3j49-mh5q). Intervallo: `>=16.0.0 <16.2.11`.
- **next (moderate)**: [Next.js: Unbounded Server Action payload in Edge runtime](https://github.com/advisories/GHSA-4c39-4ccg-62r3). Intervallo: `>=16.0.0 <16.2.11`.
- **next (high)**: [Next.js: Server-Side Request Forgery in rewrites via attacker-controlled destination hostname](https://github.com/advisories/GHSA-p9j2-gv94-2wf4). Intervallo: `>=16.0.0 <16.2.11`.
- **next (moderate)**: [Next.js: Denial of Service in the Image Optimization API using SVGs](https://github.com/advisories/GHSA-q8wf-6r8g-63ch). Intervallo: `>=16.0.0 <16.2.11`.
- **next (moderate)**: [Next.js: Unauthenticated disclosure of internal Server Function endpoints](https://github.com/advisories/GHSA-955p-x3mx-jcvp). Intervallo: `>=16.0.0 <16.2.11`.
- **next (critical)**: [Next.js: Unauthenticated Remote Code Execution on windows-hosted servers](https://github.com/advisories/GHSA-p293-qw3h-jr36). Intervallo: `>=16.0.0 <16.3.3`.
- **next (critical)**: [Next.js: Unauthenticated Remote Code Execution in Image Optimization API when AVIF files are used](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4). Intervallo: `>=16.0.0 <16.3.3`.
- **next (critical)**: [Next.js: Remote Code Execution in next/og ImageResponse](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j). Intervallo: `>=16.2.0 <16.3.6`.
- **next-auth (critical)**: [Auth.js: Email normalizer validates the address before Unicode normalization, allowing a homoglyph @ bypass](https://github.com/advisories/GHSA-7rqj-j65f-68wh). Intervallo: `>=4.10.3 <4.24.15`.
- **next-auth (high)**: [Auth.js: getToken() throws an uncaught exception on malformed Bearer authorization headers](https://github.com/advisories/GHSA-xmf8-cvqr-rfgj). Intervallo: `>=4.0.6 <=4.24.14`.
- **next-auth (moderate)**: [Auth.js: OAuth state, nonce, and PKCE check cookies are not bound to the provider that created them](https://github.com/advisories/GHSA-x445-f3h2-j279). Intervallo: `<=4.24.14`.
- **postcss (moderate)**: [PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp). Intervallo: `<=8.5.22`.
- **postcss (high)**: [PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure](https://github.com/advisories/GHSA-r28c-9q8g-f849). Intervallo: `<=8.5.17`.
- **sharp (high)**: [sharp inherited vulnerabilities in libvips: CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591](https://github.com/advisories/GHSA-f88m-g3jw-g9cj). Intervallo: `<0.35.0`.
- **sharp (high)**: [sharp: Vulnerabilities in libheif: GHSA-g89c-p67h-r497 and GHSA-2jg2-4ch7-h545](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c). Intervallo: `<0.35.4`.

Totale: 14 pacchetti segnalati, 34 avvisi distinti.

La classificazione dev/prod deriva dal lockfile locale. Alcuni strumenti di build sono distribuiti con next e risultano prod pur non essendo chiamabili da una richiesta applicativa. Consultare SECURITY-AUDIT.md per l’applicabilità.
