// Builds the Frosted Nug canning-line site from src/ plus the 3D and 2D builds.
//   node build.mjs            → site files at the root of this folder (ready to deploy)
//   node build.mjs --artifact → also writes artifact/ (index without the document shell, font inlined) for a Claude preview
// Edit config.json for the domain (siteUrl) and the film path (filmSrc), then rebuild.
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const HERE = new URL(".", import.meta.url).pathname;
const CFG = JSON.parse(readFileSync(join(HERE, "config.json"), "utf8"));
const SITE = CFG.siteUrl.replace(/\/$/, "");
const SRC_3D = process.env.SRC_3D || "/root/canning-3d/artifact/index.html";
const SRC_2D = process.env.SRC_2D || "/root/canning-line/artifact/canning-line.html";
const SRC_SNAPS3D = process.env.SRC_SNAPS3D || "/root/snaps-3d/artifact/index.site.html";
const HAS_SNAPS3D = existsSync(SRC_SNAPS3D);
const SRC_SNAPS = process.env.SRC_SNAPS || "/root/pulsar/out/pulsar-351.html";
const SRC_2D_VIEWS = process.env.SRC_2D_VIEWS || "/root/canning-line/artifact/views";
const ARTIFACT = process.argv.includes("--artifact");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ---------- shared pieces ---------- */
const fontFace = (url) => `@font-face{font-family:"Archivo";font-style:normal;font-weight:100 900;font-stretch:62% 125%;font-display:swap;src:url(${url}) format("woff2-variations"),url(${url}) format("woff2")}`;
const FONT_URL = "fonts/archivo-wdth.woff2";

function meta({ title, desc, path, image = "img/og.jpg", imageAlt = "The GrowTopia Canning Line in 3D, seen from above the south-east corner." }) {
  const url = `${SITE}/${path}`;
  return [
    `<meta name="description" content="${esc(desc)}">`,
    `<link rel="canonical" href="${url}">`,
    `<link rel="icon" href="favicon.svg" type="image/svg+xml">`,
    `<meta name="theme-color" content="#f2f2ef" media="(prefers-color-scheme: light)">`,
    `<meta name="theme-color" content="#0f0f0f" media="(prefers-color-scheme: dark)">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(CFG.siteName)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${SITE}/${image}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(imageAlt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    `<meta name="twitter:image" content="${SITE}/${image}">`,
  ].join("\n");
}

// The site bar: brand, the two lines, and a context menu. Its colours are its own, so it reads on every page in both themes.
const SITEBAR_CSS = `
:root{--fnb-bg:#f2f2ef;--fnb-ink:#18181a;--fnb-text:#57575a;--fnb-muted:#8c8c90;--fnb-rule:#d2d2ce;--fnb-accent:#5078b0;--fnb-on:#f2f2ef;--fnb-panel:#fbfbf9}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--fnb-bg:#121212;--fnb-ink:#ececea;--fnb-text:#b4b4b2;--fnb-muted:#7c7c80;--fnb-rule:#2e2e2e;--fnb-accent:#86a8dc;--fnb-on:#121212;--fnb-panel:#181818}}
:root[data-theme="dark"]{--fnb-bg:#121212;--fnb-ink:#ececea;--fnb-text:#b4b4b2;--fnb-muted:#7c7c80;--fnb-rule:#2e2e2e;--fnb-accent:#86a8dc;--fnb-on:#121212;--fnb-panel:#181818}
.fn-bar{position:relative;z-index:40;background:var(--fnb-bg);border-bottom:1px solid var(--fnb-rule);color:var(--fnb-text)}
.fn-bar.sticky{position:sticky;top:env(safe-area-inset-top,0px)}
.fn-bar-in{max-width:1240px;margin:0 auto;padding-left:max(20px,env(safe-area-inset-left,0px));padding-right:max(20px,env(safe-area-inset-right,0px));min-height:56px;display:flex;align-items:center;gap:24px}
.fn-brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none;color:var(--fnb-ink);font:800 19px/1 "Archivo",ui-sans-serif,system-ui,sans-serif;font-stretch:70%;letter-spacing:.01em;white-space:nowrap}
.fn-brand svg{width:20px;height:20px;flex:none}
.fn-nav{display:flex;gap:6px;margin-left:auto;align-items:center}
.fn-line{display:flex;align-items:center;gap:2px;padding:3px;border:1px solid var(--fnb-rule);border-radius:4px}
.fn-line > b{font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--fnb-muted);padding:0 8px 0 6px}
.fn-nav a{white-space:nowrap;color:var(--fnb-text);text-decoration:none;font:14px/1 ui-sans-serif,system-ui,sans-serif;padding:8px 9px;border-radius:3px}
.fn-nav a:hover{color:var(--fnb-ink);background:color-mix(in srgb,var(--fnb-ink) 7%,transparent)}
.fn-nav a[aria-current="page"]{color:var(--fnb-on);background:var(--fnb-ink)}
.fn-bar a:focus-visible,.fn-menu-btn:focus-visible{outline:2px solid var(--fnb-accent);outline-offset:2px}
.fn-nav a.fn-home{display:none}
.fn-menu-btn{display:none;margin-left:auto;align-items:center;gap:8px;min-height:40px;padding:0 12px;border:1px solid var(--fnb-rule);border-radius:4px;background:var(--fnb-panel);color:var(--fnb-ink);font:500 14px/1 ui-sans-serif,system-ui,sans-serif;cursor:pointer}
.fn-menu-btn i{display:block;width:16px;height:10px;border-top:2px solid currentColor;border-bottom:2px solid currentColor;position:relative}
.fn-menu-btn i::after{content:"";position:absolute;left:0;right:0;top:2px;border-top:2px solid currentColor}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:50;background:var(--fnb-bg)}
@media (max-width: 980px){
  .fn-menu-btn{display:inline-flex}
  .fn-nav{display:none;position:absolute;left:0;right:0;top:100%;flex-direction:column;align-items:stretch;gap:14px;margin:0;padding:16px max(20px,env(safe-area-inset-right,0px)) 20px max(20px,env(safe-area-inset-left,0px));background:var(--fnb-panel);border-bottom:1px solid var(--fnb-rule);box-shadow:0 18px 30px -18px rgba(0,0,0,.35)}
  .fn-bar.open .fn-nav{display:flex}
  .fn-line{flex-wrap:wrap;border:0;padding:0;gap:6px}
  .fn-line > b{width:100%;padding:0 0 4px}
  .fn-nav a{font-size:16px;padding:12px 14px;border:1px solid var(--fnb-rule);background:var(--fnb-bg);flex:1 1 auto;text-align:center}
  .fn-nav a.fn-home{display:block;text-align:left;font-weight:500}
}
@media (max-width: 420px){.fn-brand{font-size:17px}.fn-brand-x{display:none}}
`;
const CAN = `<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M9 5.5c0-1.4 3.1-2.5 7-2.5s7 1.1 7 2.5V7l1 1.6V25l-1 1.5c0 1.4-3.1 2.5-7 2.5s-7-1.1-7-2.5L8 25V8.6L9 7z"/><path fill="var(--fn-accent,var(--accent,#5078b0))" d="M8 19h16v3.4H8z"/></svg>`;
function sitebar(page, { sticky = false } = {}) {
  const cur = (p) => (p === page ? ` aria-current="page"` : "");
  const canning = ["index", "explore", "blueprint", "404"].includes(page) || !page.startsWith("snaps");
  return `<header class="fn-bar${sticky ? " sticky" : ""}" data-fn-bar><div class="fn-bar-in">
<a class="fn-brand" href="index.html">${CAN}<span>GrowTopia<span class="fn-brand-x"> Manufacturing</span></span></a>
<button type="button" class="fn-menu-btn" aria-expanded="false" aria-controls="fn-nav" data-fn-menu><i aria-hidden="true"></i>Menu</button>
<nav class="fn-nav" id="fn-nav" aria-label="Site">
<a class="fn-home" href="index.html"${cur("index")}>← GrowTopia Manufacturing home</a>
<div class="fn-line" role="group" aria-label="Canning Line"><b>Canning Line</b>
<a href="index.html"${cur("index")}>Overview</a>
<a href="explore.html"${cur("explore")}>3D</a>
<a href="blueprint.html"${cur("blueprint")}>Drawing</a>
<a href="index.html#film">Film</a></div>
<div class="fn-line" role="group" aria-label="Snaps Line"><b>Snaps Line</b>
<a href="snaps.html"${cur("snaps")}>Overview</a>
${HAS_SNAPS3D ? `<a href="snaps-explore.html"${cur("snaps-explore")}>3D</a>\n` : ""}<a href="snaps-drawing.html"${cur("snaps-drawing")}>Drawing</a></div>
</nav></div></header>
<script>(function(){var b=document.querySelector("[data-fn-bar]"),t=b&&b.querySelector("[data-fn-menu]");if(!t)return;function set(o){b.classList.toggle("open",o);t.setAttribute("aria-expanded",o?"true":"false")}t.addEventListener("click",function(){set(!b.classList.contains("open"))});document.addEventListener("keydown",function(e){if(e.key==="Escape")set(false)});document.addEventListener("click",function(e){if(!b.contains(e.target))set(false)})})();</script>`;
}

/* ---------- the nine machines, in line order (copy from the 3D app's cards; facts from the model) ---------- */
const MACHINES = [
  { id: "shaker", name: "Shaker table", fact: "468 empties per pallet layer", what: "A pallet of empty cans rides a scissor lift up to the vibrating deck. Each layer is swept toward the funnel, where cans single-file onto the gravity track.", img: "m-shaker", alt: "The shaker table, its deck of empty cans on top of the lift cage." },
  { id: "track", name: "Gravity track and ionized-air rinse", fact: "68 cm twist, upside down and back", what: "Empties roll down the chute into a twist cage that turns each can upside down, blasts it with ionized air from the air knife, then turns it back upright onto the infeed.", img: "m-track", alt: "The gravity track and twist rinse carrying cans down from the shaker." },
  { id: "datecoder", name: "Datecoder", fact: "One lot and date code every 2.4 s", what: "An inkjet head on its own stand prints the lot and date code on every can as it passes on the 2 ft infeed.", img: "m-datecoder", alt: "The datecoder head beside the infeed conveyor." },
  { id: "macs", name: "Cask mACS canner", fact: "3 heads, 25 cans/min, 63 cases an hour", what: "Three heads purge each can with CO2 and fill it. The nitrodoser adds a drop of liquid nitrogen, a lid drops from the 9 ft stack, and the cam-driven seamer closes the can with a double seam.", img: "m-macs", alt: "The mACS canner's control screen reading 25 cans per minute beside the fill heads." },
  { id: "outfeed", name: "9 ft outfeed conveyor", fact: "9.4 ft at 12 cm/s to the tunnel", what: "Carries sealed cans west to the tunnel, where they stop against the dead plate and form rows of 12.", img: "m-outfeed", alt: "The outfeed conveyor running along the pasteurizer." },
  { id: "tunnel", name: "Tunnel of Love pasteurizer", fact: "Rows of 12, 22 min through", what: "A pusher loads each row of 12 onto the belt. Spray headers heat, hold and cool the cans in three zones, fed by zone pumps, a water heater and a plate heat exchanger on the utility skid.", img: "m-tunnel", alt: "Inside the Tunnel of Love: rows of cans under the spray headers." },
  { id: "dw", name: "Double-wide conveyor", fact: "5 ft of accumulation to the labeler", what: "Takes pasteurized cans from the tunnel discharge and meters them toward the labeler.", img: "m-dw", alt: "Cans leaving the tunnel discharge onto the conveyor." },
  { id: "labeler", name: "PL-501 wrap labeler", fact: "79 in long at true size", what: "A spacing wheel gaps the cans, the applicator peels each label off the web, and the wrap pad and hold-down belt roll it on. The liner rewinds on the second spindle.", img: "m-labeler", alt: "The PL-501 labeler with its label reel above the conveyor." },
  { id: "table", name: "Rotary collection table", fact: "108 cm turntable", what: "A slow turntable gathers labeled cans inside its guide rail so they can be packed by hand.", img: "m-table", alt: "Labeled Growtopia cans gathering on the rotary table." },
];
const machinesHtml = MACHINES.map(
  (m, i) => `        <li class="stn" id="m-${m.id}">
          <span class="no" aria-hidden="true">${i + 1}</span>
          <figure><img src="img/${m.img}-800.webp" width="800" height="450" loading="lazy" alt="${esc(m.alt)}"></figure>
          <div class="body"><h3>${esc(m.name)}</h3><p class="fact">${esc(m.fact)}</p><p class="what">${esc(m.what)}</p></div>
          <div class="go"><a class="btn" href="explore.html#machine-${m.id}" aria-label="Explore the ${esc(m.name)} in 3D">Explore in 3D</a><a class="btn" href="explore.html#apart-${m.id}" aria-label="Take the ${esc(m.name)} apart">Take it apart</a></div>
        </li>`,
).join("\n");

const shell = ({ body, head = "", lang = "en" }) => `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}
</head>
<body>
${body}
</body>
</html>
`;
// Pull <title> and the claude meta off the top of a fragment so they can go in <head>.
function splitTop(frag) {
  const t = frag.match(/<title>[\s\S]*?<\/title>/)?.[0] ?? "";
  const rest = frag.replace(t, "").replace(/<meta name="claude:viewport-fit-sides"[^>]*>\s*/, "");
  return { title: t, rest };
}

/* ---------- index ---------- */
const INDEX_DESC = "The GrowTopia Canning Line as a live 3D model: nine machines at true size, running at 25 cans a minute. Walk the floor, follow a can, take any machine apart.";
function buildIndex({ forArtifact }) {
  let s = readFileSync(join(HERE, "src/index.html"), "utf8");
  s = s
    .replace("{{META}}", "")
    .replace("{{FONTFACE}}", forArtifact ? fontFace(`data:font/woff2;base64,${readFileSync(join(HERE, FONT_URL)).toString("base64")}`) : fontFace(FONT_URL))
    .replace("{{SITEBAR_CSS}}", SITEBAR_CSS)
    .replace("{{SITEBAR}}", sitebar("index", { sticky: true }))
    .replace("{{MACHINES}}", machinesHtml)
    .replace("{{FILM_SRC}}", esc(CFG.filmSrc || ""));
  s = snapSizes(s);
  if (forArtifact) return s;
  const { title, rest } = splitTop(s);
  return shell({ head: title + "\n" + meta({ title: "GrowTopia Canning Line, live in 3D", desc: INDEX_DESC, path: "" }), body: rest });
}

/* ---------- explore: the 3D app, with local three.js, the site bar, deep links and an embed mode ---------- */
const EXPLORE_HEAD_SCRIPT = `<script>(function(){var h=decodeURIComponent(location.hash||"");if(/(^#|[&,])embed\\b/.test(h))document.documentElement.classList.add("fn-embed");else if(/(station|machine|apart|view)[=-]|walk|follow/.test(h))window.__l3hold=true;})();</script>`;
const EXPLORE_CSS = `<style>
${fontFace(FONT_URL)}
:root{--fn-bar-bg:var(--page);--fn-bar-rule:var(--line);--fn-ink:var(--strong);--fn-text:var(--text);--fn-muted:var(--muted);--fn-accent:#5078b0;--fn-on-ink:var(--page)}
${SITEBAR_CSS}
.l3-page{margin-top:20px}
.fn-bar-in{max-width:1320px}
.fn-alt{display:inline-block;margin-top:12px;color:var(--strong);font-weight:500;text-decoration:underline;text-underline-offset:4px}
html.fn-embed .fn-bar,html.fn-embed .l3-head,html.fn-embed .l3-controls,html.fn-embed .l3-foot,html.fn-embed .l3-legend,html.fn-embed body::before{display:none}
html.fn-embed,html.fn-embed body{height:100%;overflow:hidden;background:var(--card)}
html.fn-embed .l3-page{max-width:none;margin:0;padding:0;height:100%}
html.fn-embed .l3,html.fn-embed .l3-plate,html.fn-embed .l3-view{height:100%}
html.fn-embed .l3-plate{padding:0;box-shadow:none;background:var(--card)}
html.fn-embed .l3-view{display:flex}
html.fn-embed .l3-stage{aspect-ratio:auto;height:100%;max-height:none;min-height:0;flex:1;border-radius:0}
</style>`;
const DEEPLINK_JS = `<script>
// Deep links: #machine-tunnel, #apart-macs, #walk, #follow, #view-plan (also #station=tunnel style). #embed is the hero mode.
(function () {
  var STATION = { shaker: "shaker", track: "rinse", rinse: "rinse", datecoder: "datecoder", macs: "filler", filler: "filler", seamer: "seamer", tunnel: "tunnel", labeler: "labeler", table: "table" };
  var MACHINE = { shaker: "shaker", rinse: "track", track: "track", datecoder: "datecoder", filler: "macs", seamer: "macs", macs: "macs", infeed: "infeed", outfeed: "outfeed", tunnel: "tunnel", dw: "dw", discharge: "dw", labeler: "labeler", table: "table" };
  function parse() {
    var out = {};
    decodeURIComponent((location.hash || "").slice(1)).split(/[&,]/).forEach(function (t) {
      var m = t.match(/^(station|machine|apart|view)[=-]([a-z0-9]+)$/i);
      if (m) out[m[1].toLowerCase()] = m[2].toLowerCase();
      else if (t) out[t.toLowerCase()] = true;
    });
    return out;
  }
  function whenReady(cb) {
    if (window.__l3failed) return;
    if (window.__l3ready && window.__l3) cb(); else setTimeout(function () { whenReady(cb); }, 120);
  }
  var card = function () { return document.querySelector("[data-card]"); };
  function press(sel) { var c = card(); var b = c && c.querySelector(sel); if (b) b.click(); return !!b; }
  function apply() {
    var o = parse();
    var L = window.__l3;
    var hold = false;
    if (window.__l3hold) L.tour(false);
    if (o.view) { L.setPreset(o.view); hold = true; }
    var st = o.station || o.machine;
    if (st && MACHINE[st]) {
      var mid = MACHINE[st];
      L.card(mid);
      if (STATION[st]) L.setPreset(STATION[st]); else press("[data-goto]");
      hold = true;
    }
    if (o.apart && MACHINE[o.apart]) {
      var a = MACHINE[o.apart];
      L.card(a);
      var c = card(); var b = c && c.querySelector("[data-explode]");
      if (b && b.getAttribute("aria-pressed") !== "true") b.click();
      hold = true;
    }
    if (o.walk) { L.walk(true); hold = true; }
    if (o.follow) { L.follow(true); hold = true; }
    window.__l3hold = hold;
  }
  whenReady(apply);
  addEventListener("hashchange", function () { whenReady(apply); });
  // If the 3D view can't start, point to the drawing, which needs no WebGL.
  var box = document.querySelector("[data-loading]");
  if (box) new MutationObserver(function () {
    if (box.getAttribute("data-state") === "error" && !box.querySelector(".fn-alt") && !document.documentElement.classList.contains("fn-embed")) {
      var a = document.createElement("a"); a.className = "fn-alt"; a.href = "blueprint.html"; a.textContent = "Open the 2D drawing instead";
      (box.querySelector(".l3-loading-card") || box).appendChild(a);
    }
  }).observe(box, { attributes: true, attributeFilter: ["data-state"] });
})();
</script>`;
function buildExplore() {
  let s = readFileSync(SRC_3D, "utf8");
  const { rest } = splitTop(s);
  s = rest;
  const before = s;
  s = s.replace("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js", "./vendor/three/build/three.module.js").replace("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/", "./vendor/three/examples/jsm/");
  if (s === before || /cdn\.jsdelivr/.test(s)) throw new Error("explore: three.js import map not rewritten");
  const t0 = "const tourAllowed = () => (";
  if (!s.includes(t0)) throw new Error("explore: tour hook not found");
  s = s.replace(t0, "const tourAllowed = () => !window.__l3hold && (");
  s = s.replace("The 3D engine (three.js) didn't load. Check your connection and reload the page.", "The 3D engine didn't load. Reload the page to try again.");
  s = s.replace('<main class="l3-page">', `${sitebar("explore")}\n<main class="l3-page" id="main">`);
  const head = [`<title>Explore the Canning Line · GrowTopia Manufacturing</title>`, EXPLORE_HEAD_SCRIPT, meta({ title: "Explore the GrowTopia Canning Line in 3D", desc: "Walk, orbit and take apart every machine on the GrowTopia Canning Line, live in your browser.", path: "explore.html" }), EXPLORE_CSS].join("\n");
  return shell({ head, body: s + "\n" + DEEPLINK_JS });
}

/* ---------- blueprint: the 2D anatomy page ---------- */
const BP_CSS = `<style>
${fontFace(FONT_URL)}
:root{--fn-bar-bg:var(--cl-page,#f2f2ef);--fn-bar-rule:#b4b4b8;--fn-ink:#18181a;--fn-text:#57575a;--fn-muted:#8c8c90;--fn-accent:#5078b0;--fn-on-ink:#f2f2ef}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--fn-bar-rule:#3e3e3e;--fn-ink:#e6e6e6;--fn-text:#a3a3a3;--fn-muted:#6e6e6e;--fn-accent:#86a8dc;--fn-on-ink:#0b0b0b}}
:root[data-theme="dark"]{--fn-bar-rule:#3e3e3e;--fn-ink:#e6e6e6;--fn-text:#a3a3a3;--fn-muted:#6e6e6e;--fn-accent:#86a8dc;--fn-on-ink:#0b0b0b}
${SITEBAR_CSS}
/* the 2D page's control rows must wrap on phones (its Take apart row ran off-screen at 390 px) */
@media (max-width: 760px){.cl-ctl{flex-wrap:wrap!important;min-width:0;max-width:100%}.iso-plate-corner[data-corner="hint"]{white-space:normal!important;min-width:0}}
</style>`;
function buildBlueprint() {
  const src = readFileSync(SRC_2D, "utf8");
  const { rest } = splitTop(src);
  const head = [`<title>Canning Line Drawing · GrowTopia Manufacturing</title>`, meta({ title: "The GrowTopia Canning Line, as a technical drawing", desc: "An isometric drawing of the GrowTopia Canning Line: four viewpoints, every machine taken apart, speed and labeler what-ifs.", path: "blueprint.html" }), BP_CSS].join("\n");
  return shell({ head, body: sitebar("blueprint") + "\n" + rest });
}

/* ---------- snaps-drawing: the Easysnap Pulsar 351 anatomy page ---------- */
function buildSnapsDrawing() {
  let src = readFileSync(SRC_SNAPS, "utf8");
  src = src.replace(/<title>Easysnap Pulsar 351<\/title>/, "<title>Snaps Line Drawing · GrowTopia Manufacturing</title>");
  const head = [meta({ title: "The Snaps Line drawing: the Easysnap Pulsar 351", desc: "The Easysnap Pulsar 351 as a live isometric drawing: Growtopia Snaps formed, dosed, sealed, coded and scored. Take it apart down to the parts, with assembly steps for every assembly.", path: "snaps-drawing.html", image: "img/snaps-og.jpg", imageAlt: "The Easysnap Pulsar 351 making Growtopia Snaps, drawn in isometric." }), BP_CSS].join("\n");
  src = src.replace("</head>", head + "\n</head>");
  src = src.replace(/<body([^>]*)>/, (m) => m + "\n" + sitebar("snaps-drawing"));
  return src;
}

/* ---------- snaps: the Snaps Line overview ---------- */
// The 11 Easysnap components, in the order a pack meets them. n is Easysnap's own number; iso is the drawing's assembly id.
const SNAPS_GROUPS = [
  { title: "The film", items: [
    { n: 1, iso: "bottom", name: "Bottom film unwinder", fact: "351 mm reel, one width for every pack size", what: "The bottom film comes off a cantilevered reel and over a dancer arm that keeps the web tension even as the machine indexes. The same 351 mm reel width runs every Easysnap pack size.", alt: "The bottom film reel on its spindle, the web rising over the dancer arm." },
    { n: 2, iso: "die", name: "Pouch die cutter", fact: "One row of pack shapes per cycle", what: "A press forms the pack shape in the bottom film for every lane at once, one row per cycle, at up to 40 cycles a minute.", alt: "The pouch die cutter above the bottom film, in front of the sealing station." },
  ] },
  { title: "The product", items: [
    { n: 5, iso: "fill", name: "Pressure tank", fact: "316L stainless, under air", what: "Holds the product under air pressure so it feeds the dosing pump steadily. It comes apart with the filling system, as one assembly.", alt: "The 316L pressure tank on its stand, the regulator and gauges on top." },
    { n: 8, iso: "pump", name: "Dosing pump", fact: "0.1–30 ml per pack", what: "Meters each dose from the tank to the filling manifold. Fill runs from 0.1 to 30 ml per pack, depending on how viscous the product is.", alt: "The dosing pump and its motor beside the pressure tank." },
    { n: 4, iso: "fill", name: "Product filling system", fact: "One nozzle per lane, 4–8 lanes", what: "A manifold splits each dose across the lanes and the nozzles fill every pack in the row at once. Easysnap builds it for any kind of liquid.", alt: "The filling manifold with one nozzle per lane above the formed packs." },
  ] },
  { title: "Close, code and score", items: [
    { n: 3, iso: "top", name: "Top film unwinder", fact: "The pre-printed Growtopia Snaps film", what: "The printed top film runs over its idlers and is laid on the filled row, where the sealing station seals it to the bottom film and closes every pack.", alt: "The green, pre-printed Growtopia Snaps top film on its reel above the sealing station." },
    { n: 6, iso: "printer", name: "Heat transfer printing unit", fact: "351 × 100 mm print frame", what: "Prints the lot and date code on each pack through a thermal ribbon. The artwork is already on the film; the printer adds the traceability.", alt: "The heat transfer printer over the sealed web, its ribbon cable looping in." },
    { n: 9, iso: "precut", name: "Precut system", fact: "Scores the snap line", what: "Scores the line across each pack that lets it snap open when it's bent, without opening it on the machine.", alt: "The precut station over the sealed, coded packs." },
    { n: 11, iso: "outfeed", name: "Conveyor with pick & place", fact: "Up to 320 packs a minute out", what: "Each finished row is cut free and the pick & place head lifts it onto the outfeed belt, ready for packing. At 40 cycles a minute on 8 lanes that is up to 320 packs a minute.", alt: "Rows of Growtopia Snaps on the blue outfeed belt under the pick & place gantry." },
  ] },
  { title: "Supporting the line", items: [
    { n: 7, iso: "air", name: "Air supply connection", fact: "Filter, regulator and gauge", what: "Plant compressed air comes in through a filter and a regulator with a gauge, and feeds the machine's pneumatics.", alt: "The air filter and regulator with its gauge on the machine's side." },
    { n: 10, iso: "hmi", name: "Swinging arm control panel", fact: "Touch screen and e-stop", what: "The operator panel swings out on its stainless arm to set lanes, speed and fill and to watch the run. The machine is ready for Industry 4.0 remote monitoring.", alt: "The control panel reading 40 cycles a minute and 320 packs a minute, with its e-stop and keys." },
  ] },
];
const snapsComponentsHtml = SNAPS_GROUPS.map((g) => `      <h3 class="group">${esc(g.title)}</h3>
      <ol class="line">
${g.items.map((m) => `        <li class="stn" id="c-${m.n}">
          <span class="no" aria-hidden="true">${m.n}<small>Easysnap no.</small></span>
          <figure><img src="img/snaps-c${String(m.n).padStart(2, "0")}-800.webp" width="800" height="450" loading="lazy" alt="${esc(m.alt)}"></figure>
          <div class="body"><h3>${esc(m.name)}</h3><p class="fact">${esc(m.fact)}</p><p class="what">${esc(m.what)}</p></div>
          <div class="go"><a class="btn" href="${HAS_SNAPS3D ? "snaps-explore.html" : "snaps-drawing.html"}" aria-label="See the ${esc(m.name)} run">See it run</a><a class="btn" href="${HAS_SNAPS3D ? "snaps-explore.html" : "snaps-drawing.html"}#iso-${m.iso}" aria-label="Take the ${esc(m.name)} apart">Take it apart</a><a class="btn" href="${HAS_SNAPS3D ? "snaps-explore.html" : "snaps-drawing.html"}#assemble-${m.iso}" aria-label="Assembly steps for the ${esc(m.name)}">Assembly steps</a></div>
        </li>`).join("\n")}
      </ol>`).join("\n");

// Part counts come from the drawing build when it has written them; otherwise no count is shown.
function partsSummary() {
  const p = "/root/pulsar/out/parts-summary.json";
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}
function partCount(sum, id) {
  if (!sum) return null;
  const v = sum[id] ?? sum.assemblies?.[id] ?? (Array.isArray(sum.assemblies) ? sum.assemblies.find((a) => a.id === id) : undefined);
  const n = typeof v === "number" ? v : v?.parts ?? v?.count ?? v?.n ?? (Array.isArray(v?.parts) ? v.parts.length : null);
  return Number.isFinite(n) ? n : null;
}
const SNAPS_FEATURED = [
  { iso: "fill", img: "fill", name: "Filling system and pressure tank", what: "The 316L tank lifts off its stand; the regulator, manifold and nozzle bar come away.", alt: "The filling system and pressure tank taken apart: the tank above its three-leg stand, the manifold and nozzle bar beside it." },
  { iso: "seal", img: "seal", name: "Sealing station", what: "The servo block, its motors and the heated seal head separate.", alt: "The sealing station taken apart: the dark servo block, its six motors and the seal head below." },
  { iso: "outfeed", img: "outfeed", name: "Conveyor with pick & place", what: "Gantry, knife, pick & place head, belt and gearmotor lift clear of the frame.", alt: "The outfeed conveyor taken apart: the belt with rows of packs above its frame, the gantry and pick & place head lifted clear." },
];
function snapsApartHtml() {
  const sum = partsSummary();
  return SNAPS_FEATURED.map((f) => {
    const n = partCount(sum, f.iso);
    const count = n ? `${n} parts. ` : "";
    return `        <a href="${HAS_SNAPS3D ? "snaps-explore.html" : "snaps-drawing.html"}#iso-${f.iso}"><figure><div class="shot"><img src="img/snaps-iso-${f.img}-960.webp" width="960" height="720" loading="lazy" alt="${esc(f.alt)}"></div><figcaption><h3>${esc(f.name)}</h3><p>${esc(count + f.what)}</p><span class="cta">Take it apart</span></figcaption></figure></a>`;
  }).join("\n");
}
const SNAPS_FLAVOURS = [["After Dark", "#5d4470"], ["Clear Head", "#7fb8b2"], ["Golden Hour", "#d9a441"], ["Ignite", "#c95a3c"], ["Low Tide", "#4a7f9e"], ["Night Shift", "#33416b"]];
const snapsFlavoursHtml = SNAPS_FLAVOURS.map(([n, c]) => `            <span><i style="--c:${c}" aria-hidden="true"></i>${esc(n)}</span>`).join("\n");

// width/height for the Snaps stills, from the sizes snaps-stills.py records (final or interim stills alike)
function snapSizes(html) {
  let sizes = {};
  try { sizes = JSON.parse(readFileSync(join(HERE, "img/snaps-sizes.json"), "utf8")).sizes; } catch {}
  return html.replace(/\{\{SZ:([\w-]+)\}\}/g, (_, k) => (sizes[k] ? `width="${sizes[k][0]}" height="${sizes[k][1]}"` : ""));
}
// The overview reuses the home page's stylesheet, so both read as one site.
function indexStyle({ forArtifact = false } = {}) {
  const src = readFileSync(join(HERE, "src/index.html"), "utf8");
  const a = src.indexOf("<style>"), b = src.indexOf("</style>", a) + "</style>".length;
  return src.slice(a, b)
    .replace("{{FONTFACE}}", forArtifact ? fontFace(`data:font/woff2;base64,${readFileSync(join(HERE, FONT_URL)).toString("base64")}`) : fontFace(FONT_URL))
    .replace("{{SITEBAR_CSS}}", SITEBAR_CSS);
}
const SNAPS_DESC = "The GrowTopia Snaps Line: an Easysnap Pulsar 351 making Growtopia Snaps, 4–8 lanes at up to 320 packs a minute. Every component in process order, taken apart down to the parts.";
function buildSnaps() {
  let s = readFileSync(join(HERE, "src/snaps.html"), "utf8");
  s = s
    .replace("{{META}}", "")
    .replace("{{INDEX_STYLE}}", indexStyle())
    .replace("{{SITEBAR}}", sitebar("snaps", { sticky: true }))
    .replace("{{SNAPS_COMPONENTS}}", snapsComponentsHtml)
    .replace("{{SNAPS_APART}}", snapsApartHtml())
    .replace("{{SNAPS_FLAVOURS}}", snapsFlavoursHtml);
  s = snapSizes(s);
  const { title, rest } = splitTop(s);
  return shell({ head: title + "\n" + meta({ title: "GrowTopia Snaps Line: the Easysnap Pulsar 351", desc: SNAPS_DESC, path: "snaps.html", image: "img/snaps-og.jpg", imageAlt: "The Easysnap Pulsar 351 making Growtopia Snaps, drawn in isometric." }), body: rest });
}


/* ---------- snaps 3D explorer (from /root/snaps-3d) ---------- */
function buildSnapsExplore() {
  let s = readFileSync(SRC_SNAPS3D, "utf8");
  if (/cdn\.jsdelivr/.test(s)) throw new Error("snaps-explore: CDN three still referenced");
  s = s.replace(/<title>[\s\S]*?<\/title>/, "<title>Explore the Snaps Line in 3D · GrowTopia Manufacturing</title>");
  s = s.replace(/<meta name="claude:viewport-fit-sides"[^>]*>\s*/, "");
  const head = [`<script>(function(){var h=decodeURIComponent(location.hash||"");if(/(^#|[&,])embed\\b/.test(h))document.documentElement.classList.add("fn-embed");})();</script>`,
    meta({ title: "Explore the GrowTopia Snaps Line in 3D", desc: "Orbit the Easysnap Pulsar 351 making Growtopia Snaps, take it apart to every part with parts lists and assembly steps, follow a pack and snap one open.", path: "snaps-explore.html", image: "img/snaps-og.jpg" }),
    `<style>${fontFace(FONT_URL)}${SITEBAR_CSS}.l3-page{margin-top:20px}.fn-bar-in{max-width:1320px}html.fn-embed .fn-bar,html.fn-embed body::before{display:none}</style>`].join("\n");
  s = s.replace("</head>", head + "\n</head>");
  if (!s.includes('<main class="l3-page">')) throw new Error("snaps-explore: main not found");
  s = s.replace('<main class="l3-page">', `${sitebar("snaps-explore")}\n<main class="l3-page" id="main">`);
  return s;
}

/* ---------- 404, robots, sitemap ---------- */
function build404() {
  const head = `<title>Page Not Found</title>\n<link rel="icon" href="favicon.svg" type="image/svg+xml">\n<meta name="robots" content="noindex">
<style>${fontFace(FONT_URL)}
:root{--floor:#f2f2ef;--ink:#18181a;--text:#57575a;--steel:#8c8c90;--rule:#b4b4b8;--accent:#5078b0;--on-ink:#f2f2ef;color-scheme:light}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--floor:#0f0f0f;--ink:#ececea;--text:#a8a8a6;--steel:#76767a;--rule:#3e3e3e;--accent:#86a8dc;--on-ink:#0f0f0f;color-scheme:dark}}
:root[data-theme="dark"]{--floor:#0f0f0f;--ink:#ececea;--text:#a8a8a6;--steel:#76767a;--rule:#3e3e3e;--accent:#86a8dc;--on-ink:#0f0f0f;color-scheme:dark}
body{margin:0;background:var(--floor);color:var(--text);font:16px/1.6 ui-sans-serif,system-ui,sans-serif}
${SITEBAR_CSS}
main{max-width:1240px;margin:0 auto;padding:96px max(20px,env(safe-area-inset-right,0px)) 96px max(20px,env(safe-area-inset-left,0px))}
h1{font:800 clamp(48px,9vw,112px)/.9 "Archivo",ui-sans-serif,system-ui,sans-serif;font-stretch:62%;color:var(--ink);margin:0 0 20px}
a.btn{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border-radius:3px;background:var(--ink);color:var(--on-ink);text-decoration:none;margin-top:24px}
a.btn:focus-visible{outline:2px solid var(--accent);outline-offset:3px}</style>`;
  const body = `${sitebar("404")}<main><h1>Off the line</h1><p>There's no page at this address. The overview, the 3D explorer and the drawing are all one click away.</p><a class="btn" href="index.html">Go to the overview</a></main>`;
  return shell({ head, body });
}

/* ---------- write ---------- */
const out = (name, text) => { writeFileSync(join(HERE, name), text); console.log(name.padEnd(16), (Buffer.byteLength(text) / 1024).toFixed(0).padStart(6), "KB"); };
out("index.html", buildIndex({ forArtifact: false }));
out("explore.html", buildExplore());
out("blueprint.html", buildBlueprint());
out("snaps.html", buildSnaps());
out("snaps-drawing.html", buildSnapsDrawing());
if (HAS_SNAPS3D) out("snaps-explore.html", buildSnapsExplore());
out("404.html", build404());
out("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
const today = new Date().toISOString().slice(0, 10);
out("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["", "explore.html", "blueprint.html", "snaps.html", ...(HAS_SNAPS3D ? ["snaps-explore.html"] : []), "snaps-drawing.html"].map((p) => `  <url><loc>${SITE}/${p}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`);

// 2D view fragments
rmSync(join(HERE, "views"), { recursive: true, force: true });
mkdirSync(join(HERE, "views"), { recursive: true });
let nViews = 0;
for (const f of readdirSync(SRC_2D_VIEWS)) if (f.endsWith(".json")) { copyFileSync(join(SRC_2D_VIEWS, f), join(HERE, "views", f)); nViews++; }
console.log("views/", nViews, "files");

if (ARTIFACT) {
  mkdirSync(join(HERE, "artifact"), { recursive: true });
  writeFileSync(join(HERE, "artifact/index.html"), buildIndex({ forArtifact: true }));
  console.log("artifact/index.html written");
}
