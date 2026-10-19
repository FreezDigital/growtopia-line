# Backline canning line: deploying the site

A static site with no server code, no build step at deploy time and no third-party requests. three.js, the font and every image ship in this folder. Nothing tracks visitors.

## What's in the folder

| Path | What it is |
|---|---|
| `index.html` | Overview: hero with the live line, line data, the nine machines, taken-apart views, film, drawing |
| `explore.html` | The full 3D explorer (walk, orbit, follow a can, take machines apart) |
| `blueprint.html` + `views/*.json` | The 2D isometric drawing and its 75 viewpoint / take-apart files |
| `404.html` | Not-found page |
| `vendor/three/` | three.js r160 (MIT, licence included) |
| `fonts/` | Archivo variable font (SIL Open Font License) |
| `img/` | Stills rendered from the 3D model, plus `og.jpg` for link previews |
| `film/` | Where the film MP4 goes (see below) |
| `robots.txt`, `sitemap.xml`, `favicon.svg` | Site plumbing |
| `config.json`, `build.mjs`, `src/` | Source. Only needed to rebuild; safe to deploy or leave out |

Total size is about 50 MB; the 2D drawing's view files are most of it. Pages load only what they need.

## 1. Set the domain

`config.json` holds the one domain constant. It's used for canonical links, link-preview images and the sitemap.

```json
{ "siteUrl": "https://line.frostednug.com", "siteName": "Backline canning line", "filmSrc": "film/frosted-nug-line-film-1080p.mp4" }
```

Change `siteUrl` if the address differs, then rebuild:

```bash
node build.mjs          # needs Node 18+; rewrites the pages, robots.txt and sitemap.xml
```

## 2a. Cloudflare Pages

Drag and drop:
1. Cloudflare dashboard → Workers & Pages → Create → Pages → Upload assets.
2. Name the project (e.g. `backline-line`), drop this folder, Deploy.

CLI:
```bash
npm i -g wrangler
wrangler login
wrangler pages deploy . --project-name backline-line
```

Custom domain: project → Custom domains → Set up a domain → `line.frostednug.com`. If frostednug.com's DNS is on Cloudflare this is automatic. If not, add the CNAME below at the DNS host.

## 2b. Netlify

Drag and drop: app.netlify.com → Add new site → Deploy manually → drop this folder.

CLI:
```bash
npm i -g netlify-cli
netlify login
netlify deploy --dir . --prod
```

Custom domain: Site configuration → Domain management → Add a domain → `line.frostednug.com`.

## 3. DNS record

At the DNS host for frostednug.com:

| Type | Name | Target | TTL |
|---|---|---|---|
| CNAME | `line` | `backline-line.pages.dev` (Cloudflare) or `<site-name>.netlify.app` (Netlify) | Auto / 3600 |

HTTPS certificates are issued by the host automatically once the record resolves (usually minutes, up to a few hours).

## 4. Serve text as UTF-8

Every page declares `<meta charset="utf-8">`, but the 2D drawing's view files are JSON and contain symbols (−, ·, ×). Cloudflare Pages and Netlify already send `charset=utf-8`. On any other server, make sure `.html`, `.json`, `.js`, `.svg`, `.txt` and `.xml` go out with `charset=utf-8` (see the nginx snippet below), or symbols turn into garbage like `âˆ’`.

## 5. Add the film when it's ready

Copy the MP4 into `film/` as `frosted-nug-line-film-1080p.mp4` and redeploy. The overview checks for the file on load and swaps the poster for a player on its own. No code change. For a different file name, set `filmSrc` in `config.json` and run `node build.mjs`.

Encode for the web with `-movflags +faststart` so it starts playing before it has fully downloaded. A 2.5-minute 1080p H.264 file at CRF 18–20 is roughly 60–150 MB; both hosts serve that, but Cloudflare Pages caps single files at 25 MB. On Cloudflare, either encode at CRF 26–28 to fit or host the film on Cloudflare Stream / R2 and put its full URL in `filmSrc`.

## 6. Moving to the AI Lab later

Any static web server works; copy the folder and point the server at it. nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name line.frostednug.com;
    root /srv/backline-line;
    index index.html;

    charset utf-8;
    charset_types text/html text/css application/javascript application/json image/svg+xml text/plain application/xml;

    location / { try_files $uri $uri/ =404; }
    error_page 404 /404.html;

    location ~* \.(webp|jpg|woff2|svg|json|js|mp4)$ { expires 7d; add_header Cache-Control "public"; }
    gzip on;
    gzip_types application/json application/javascript text/css image/svg+xml;
}
```

Point the `line` CNAME (or an A record) at the lab's public address, or put it behind a Cloudflare Tunnel so the lab needs no open ports.

## Deep links

Links into the explorer use plain hash words, so they survive any host:

| Link | Opens |
|---|---|
| `explore.html#machine-tunnel` | The Tunnel of Love, card open (any of: shaker, track, datecoder, macs, outfeed, tunnel, dw, labeler, table) |
| `explore.html#apart-macs` | The mACS canner, taken apart |
| `explore.html#walk` | Walking the floor at eye height |
| `explore.html#follow` | Riding one can down the line |
| `explore.html#view-plan` | Plan view (also `view-se`, `view-ne`, `view-nw`, `view-sw`) |
| `explore.html#embed` | The 3D view alone, used by the overview's hero |

## Notes

- The 3D explorer needs WebGL. Without it, the page says so and links to the 2D drawing, which needs none.
- The hero loads the live 3D only on desktop with a mouse, without reduced motion or data saver. Elsewhere it shows the still and a "Run the line live" button.
- Figures on the site are model values from the Cask drawing and the makers' published ratings, not commissioning measurements.
