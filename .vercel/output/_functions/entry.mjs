import { renderers } from './renderers.mjs';
import { c as createExports, s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_B0Un8VKJ.mjs';
import { manifest } from './manifest_BxtHxGT1.mjs';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/api/auth/signin.astro.mjs');
const _page2 = () => import('./pages/api/auth/signout.astro.mjs');
const _page3 = () => import('./pages/api/auth/signup.astro.mjs');
const _page4 = () => import('./pages/auth/callback.astro.mjs');
const _page5 = () => import('./pages/auth/check-email.astro.mjs');
const _page6 = () => import('./pages/auth/login.astro.mjs');
const _page7 = () => import('./pages/auth/setup-required.astro.mjs');
const _page8 = () => import('./pages/auth/signup.astro.mjs');
const _page9 = () => import('./pages/dashboard.astro.mjs');
const _page10 = () => import('./pages/lessons/_---slug_.astro.mjs');
const _page11 = () => import('./pages/macro.astro.mjs');
const _page12 = () => import('./pages/practice/_slug_.astro.mjs');
const _page13 = () => import('./pages/practice.astro.mjs');
const _page14 = () => import('./pages/index.astro.mjs');
const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["src/pages/api/auth/signin.ts", _page1],
    ["src/pages/api/auth/signout.ts", _page2],
    ["src/pages/api/auth/signup.ts", _page3],
    ["src/pages/auth/callback.ts", _page4],
    ["src/pages/auth/check-email.astro", _page5],
    ["src/pages/auth/login.astro", _page6],
    ["src/pages/auth/setup-required.astro", _page7],
    ["src/pages/auth/signup.astro", _page8],
    ["src/pages/dashboard/index.astro", _page9],
    ["src/pages/lessons/[...slug].astro", _page10],
    ["src/pages/macro/index.astro", _page11],
    ["src/pages/practice/[slug].astro", _page12],
    ["src/pages/practice/index.astro", _page13],
    ["src/pages/index.astro", _page14]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./noop-entrypoint.mjs'),
    middleware: () => import('./_astro-internal_middleware.mjs')
});
const _args = {
    "middlewareSecret": "da5357f3-8596-4a04-98bb-7465b3e80bc4",
    "skewProtection": false
};
const _exports = createExports(_manifest, _args);
const __astrojsSsrVirtualEntry = _exports.default;
const _start = 'start';
if (Object.prototype.hasOwnProperty.call(serverEntrypointModule, _start)) ;

export { __astrojsSsrVirtualEntry as default, pageMap };
