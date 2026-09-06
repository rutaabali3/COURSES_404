# Drive → WebM — How It Works

## The big picture

```
                 ┌─────────────────────────────────┐
                 │               YOU               │
                 │ links.txt = manual extras only  │
                 │ the catalog API feeds the queue │
                 │ by itself every 6 hours         │
                 └────────────────┬────────────────┘
                                  │   (runs on: links.txt push,
                                  │    manual trigger, 6-hourly cron)
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GITHUB ACTIONS RUNNERS ×4                    │
│                                                                 │
│     downloads/                   webm/                          │
│   ┌───────────────┐    ffmpeg   ┌───────────────┐               │
│   │  Drive files  │ ──────────▶ │  WebM videos  │  VP9 + Opus   │
│   │  (originals)  │   convert   └───────┬───────┘               │
│   └───────▲───────┘                     │                       │
│           │                       openssl AES-256               │
│           │                             ▼                       │
│   3-layer download:             .webm.enc → release,            │
│   (1) gdown                     the plaintext video             │
│   (2) direct endpoint           is deleted at once              │
│   (3) file-by-file salvage                                      │
└────────────┬────────────────────────────────────┬───────────────┘
             │                                    │
             ▼                                    ▼
┌───────────────────────────┐      ┌─────────────────────────────┐
│      GITHUB RELEASE       │      │      WORKFLOW ARTIFACT      │
│       webm-<run#>         │      │  encrypted-videos.zip       │
│  · permanent              │      │  · 90-day backup            │
│  · AES-256 .webm.enc      │      │  · auto-expires             │
│  · links useless without  │      └─────────────────────────────┘
│    the ID + password      │
│  · up to 2 GB per file    │
└─────────────┬─────────────┘
              │   read live via the GitHub API
              │   on every page visit (encrypted
              │   bytes fetched through an optional
              │   free Cloudflare Worker proxy)
              ▼
│                    THE PUBLIC SITE (docs/)                      │
│                 https://YOU.github.io/REPO/                     │
│ (Pages or Vercel serves the whole docs/ folder)                 │
│                                                                 │
│ landing page + free library — SEO-ready                         │
│    titles, descriptions, Course + FAQ schema, sitemap,          │
│    robots.txt, share image — URLs auto-filled by the run        │
│                                                                 │
│    ┌─────────────────────────────────────────────────────┐      │
│    │  docs/library.html — FREE LIBRARY (no login)        │      │
│    │  (salted hash baked from the GitHub secrets)        │      │
│    └───────────────────────┬─────────────────────────────┘      │
│                            ▼ auto-unlocked                       │
│    > Watch: video decrypted in the visitor's browser            │
│      (proxy: streamed+decrypted · no proxy: download            │
│       the .webm.enc, open it on its card — both work)           │
│    > save / copy-link buttons         [search] (refresh)        │
│      auto-updates itself                                        │
└─────────────────────────────────────────────────────────────────┘

                 ┌─────────────────────────────────┐
                 │  api-progress-w1…4 advance      │      │
                 │  links.txt empties itself —     │
                 │  ready for the next batch       │
                 └─────────────────────────────────┘

          * the repo itself never stores video — it stays ~40 KB
```

## One run, step by step

```
┌──────────────────────────────────────────────────────────────────┐
│  1. Read queue        links.txt → list of links to process       │
│  2. Download          gdown → direct endpoint → per-file retry   │
│  3. Convert           ffmpeg → WebM (VP9 + Opus), video by video │
│  4. Encrypt           openssl AES-256 → .webm.enc (key = the     │
│                        ID + password secrets; plaintext deleted) │
│  5. Publish           each encrypted video → release immediately │
│  6. Site upkeep       auth.js, proxy.js, sitemap + robots.txt    │
│                        regenerated; Worker (re)deployed          │
│  7. Artifacts         all .webm.enc files attached as a backup   │
│  8. Clear queue       links.txt emptied (failed links stay)      │
│  9. Report            failures listed + job marked red           │
└──────────────────────────────────────────────────────────────────┘
```

## The daily loop

```
   ┌──▶ 1. paste links ──▶ 2. push ──▶ 3. auto-run ──▶ 4. gallery ─┐
   │                                    & release filled           │
   └──────────────── queue auto-empties, ready for next ◀──────────┘
```

## Why it's built this way

```
┌────────────────────────────┐   ┌─────────────────────────────────┐
│  videos live in Releases   │   │  the repo is only the queue     │
│  (2 GB/file, permanent,    │   │  (links.txt + workflow + page   │
│   CDN-fast, direct links)  │   │   ≈ 40 KB — clones stay fast)   │
└────────────────────────────┘   └─────────────────────────────────┘
┌────────────────────────────┐   ┌─────────────────────────────────┐
│  every video is uploaded   │   │  timeout-proof: re-run resumes  │
│  the moment it's done —    │   │  where it stopped (already-     │
│  a crash loses nothing     │   │  published videos are skipped)  │
└────────────────────────────┘   └─────────────────────────────────┘
┌────────────────────────────┐   ┌─────────────────────────────────┐
│  videos are AES-256        │   │  decryption happens in the      │
│  encrypted before they     │   │  visitor's browser — the key    │
│  leave the runner, so even │   │  never travels and the links    │
│  the direct links are just │   │  stay useless without the       │
│  noise                     │   │  ID + password                  │
└────────────────────────────┘   └─────────────────────────────────┘
```
