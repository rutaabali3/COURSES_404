# DRIVE TO WEBM AUTOMATED ENCRYPTED VIDEO PIPELINE

<p align="center">
  <img src="https://img.shields.io/badge/Pipeline-Self--Feeding-blue?style=for-the-badge&logo=githubactions" alt="Pipeline Self Feeding" />
  <img src="https://img.shields.io/badge/Encryption-AES--256--CTR-red?style=for-the-badge&logo=openssl" alt="Encryption AES-256-CTR" />
  <img src="https://img.shields.io/badge/Codec-VP9%20%2B%20Opus-green?style=for-the-badge&logo=ffmpeg" alt="Codec VP9 + Opus" />
  <img src="https://img.shields.io/badge/Decryption-Client--Side%20WebCrypto-orange?style=for-the-badge&logo=javascript" alt="Decryption WebCrypto" />
  <img src="https://img.shields.io/badge/Storage-Zero--Repo%20Footprint-purple?style=for-the-badge" alt="Storage Zero Repo Footprint" />
</p>

---

## OVERVIEW

This repository implements a fully automated, zero-repository-storage, end-to-end video ingestion, encoding, encryption, and delivery pipeline.

The repository functions strictly as an **orchestration job queue**. Automated GitHub Actions workflows run on a 6-hour cron schedule (or on manual push), dynamically fetching catalog metadata from a remote API across **4 parallel worker matrix runners**, downloading course content from Google Drive, scrubbing non-video assets, encoding video streams to optimized VP9/Opus WebM formats, encrypting the output with AES-256-CTR, and publishing the encrypted ciphertexts directly to GitHub Releases.

A zero-framework, static web application hosted on GitHub Pages or Vercel dynamically renders the library. Visitors decrypt and stream content locally in their browsers using the Web Crypto API without requiring accounts or logins.

---

## INTERACTIVE NAVIGATION

<details open>
<summary><b>Click to expand Table of Contents</b></summary>

1. [Key Features](#key-features)
2. [Architecture Overview](#architecture-overview)
3. [File System Map](#file-system-map)
4. [Step-by-Step Deployment Runbook](#step-by-step-deployment-runbook)
   - [Step 1: Create Repository](#step-1--create-the-repository)
   - [Step 2: Push Source Files](#step-2--push-the-source-files)
   - [Step 3: Configure Repository Secrets](#step-3--configure-required-secrets)
   - [Step 4: Execute Workflow](#step-4--execute-the-workflow)
   - [Step 5: Verification Checkpoints](#step-5--verification-checkpoints)
   - [Step 6: Optional Media Proxy Setup](#step-6--optional-cloudflare-worker-media-proxy)
5. [Parallel Worker & Auto-Feed Queue Architecture](#parallel-worker--auto-feed-queue-architecture)
6. [3-Layer Ingestion & Download Engine](#3-layer-ingestion--download-engine)
7. [Transcoding & Stream Probe Matrix](#transcoding--stream-probe-matrix)
8. [AES-256 Cryptographic Architecture](#aes-256-cryptographic-architecture)
9. [Multi-Platform Hosting & Deployment](#multi-platform-hosting--deployment)
   - [GitHub Pages](#github-pages)
   - [Vercel Hosting](#hosting-the-site-on-vercel)
   - [Private Repository Operations](#private-repository-mode)
10. [Configuration Reference & Performance Tuning](#configuration-reference--performance-tuning)
11. [SEO & Search Console Playbook](#seo--search-console-playbook)
12. [Interactive Troubleshooting Guide](#interactive-troubleshooting-guide)
13. [Contributing & Licensing](#contributing--licensing)

</details>

---

## KEY FEATURES

- **Zero Storage Repository Footprint**: Git history remains clean (~40 KB) regardless of how many gigabytes or terabytes of course footage are processed. All assets reside on GitHub Releases.
- **Parallel Matrix Execution**: Workflow utilizes 4 concurrent worker runners to shard course catalogs, processing up to ~16 full courses daily under public action minutes.
- **3-Tier Download Resiliency**: Ingestion pipeline automatically failovers across `gdown`, direct Google Drive usercontent endpoints, and file-by-file folder salvaging.
- **Deep Stream Analysis**: Integrated `ffprobe` video stream validation automatically discards PDFs, zip files, standalone audio tracks, images, and non-video assets before transcoding.
- **Client-Side Cryptography**: Videos are encrypted via OpenSSL using AES-256-CTR with PBKDF2 key derivation (600,000 iterations). Raw release download links only deliver binary ciphertext (`.webm.enc`).
- **In-Browser Decryption**: Zero-login web viewer decrypts media on-the-fly using the W3C Web Crypto API. Optional Cloudflare Worker proxy provides range request CORS streaming.

---

## ARCHITECTURE OVERVIEW

```
                        AUTOMATED SOURCE INGESTION
          +----------------------------------------------------+
          |  Course Catalog API  |  links.txt Manual Ingestion  |
          +-------------------------+--------------------------+
                                    |
                                    v
                 +--------------------------------------+
                 | GitHub Actions Worker Matrix (x4)    |
                 +--------------------------------------+
                                    |
            +-----------------------+-----------------------+
            |                       |                       |
            v                       v                       v
     [Layer 1: gdown]     [Layer 2: Direct Curl]   [Layer 3: Salvage]
            |                       |                       |
            +-----------------------+-----------------------+
                                    |
                                    v
                 +--------------------------------------+
                 | Stream Ingestion Probe (ffprobe)     |
                 | Discard Non-Video / Invalid Codecs   |
                 +--------------------------------------+
                                    |
                                    v
                 +--------------------------------------+
                 | Transcode Engine (ffmpeg VP9 + Opus) |
                 +--------------------------------------+
                                    |
                                    v
                 +--------------------------------------+
                 | AES-256-CTR Encrypt (PBKDF2 SHA-256) |
                 +--------------------------------------+
                                    |
            +-----------------------+-----------------------+
            |                                               |
            v                                               v
  +-------------------+                           +-------------------+
  | GitHub Release    |                           | Workflow Artifact |
  | Tag: webm-<run>-w*|                           | 90-Day Retention  |
  +---------+---------+                           +-------------------+
            |
            | (Encrypted Stream / WebCrypto Decryption)
            v
  +-------------------------------------------------------------------+
  | Public Static Web Site (docs/) hosted on GitHub Pages / Vercel    |
  | Decrypts & Streams WebM Videos directly in Visitor Browser        |
  +-------------------------------------------------------------------+
```

---

## FILE SYSTEM MAP

<details open>
<summary><b>Click to expand File System Directory Table</b></summary>

| Path / File | Type | Purpose & Operational Function |
| :--- | :--- | :--- |
| `.github/workflows/drive-to-webm.yml` | Workflow | Primary GitHub Actions workflow containing worker matrix, download logic, ffmpeg transcode, OpenSSL encryption, release publisher, and site builder. |
| `links.txt` | Queue Input | Queue file for manual Drive URLs. Emptied automatically upon successful conversion batch completion. |
| `api-progress-w1.json` ... `w3.json` | State Tracking | Bot-managed worker progress state files tracking completed/failed API course items. |
| `docs/index.html` | Frontend | Landing page optimized for search engine indexing, semantic markup, structured data, and OpenGraph headers. |
| `docs/library.html` | Frontend | Core web library app. Fetches releases, handles in-browser WebCrypto AES-256 decryption, and renders video player. |
| `docs/auth.js` | Generated | Auto-generated unlock token script created during workflow runs. |
| `docs/proxy.js` | Generated | Auto-generated Cloudflare Worker proxy endpoint reference file. |
| `docs/site-config.js` | Generated | Auto-generated repository reference file enabling cross-platform static deployment (Vercel/Netlify). |
| `docs/sitemap.xml` | SEO | Auto-updated site map file generated with public host domain. |
| `docs/robots.txt` | SEO | Auto-updated search engine crawling instructions. |
| `docs/assets/og-image.png` | Asset | Social preview image displayed when sharing site URLs. |
| `cloudflare/media-proxy.js` | Serverless Worker | Cloudflare Worker source script handling CORS headers, byte-range requests, and authenticated release reading. |
| `DIAGRAM.md` | Documentation | Plaintext ASCII structural pipeline diagram. |
| `CONTRIBUTING.md` | Guidelines | Contribution procedures, code standards, and PR workflows. |
| `LICENSE` | Legal | MIT Open Source License. |

</details>

---

## STEP-BY-STEP DEPLOYMENT RUNBOOK

Follow these steps sequentially to configure, launch, and verify your automated pipeline instance.

<details>
<summary><b>Step 1: Create the Repository</b></summary>

1. Navigate to `github.com/new`.
2. Name your repository (e.g., `courses404`).
3. Set Visibility to **Public** (Public repos grant free unlimited GitHub Actions minutes and free GitHub Pages hosting).
4. Leave "Add a README file" unchecked (we push custom documentation).
5. Click **Create repository**.

</details>

<details>
<summary><b>Step 2: Push the Source Files</b></summary>

Clone your empty repository and copy all repository contents into it:

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPONAME.git
cd YOUR_REPONAME
cp -r /path/to/source/. .
git add -A
git commit -m "Initialize drive-to-webm video pipeline"
git branch -M main
git push -u origin main
```

Verify that `README.md`, `links.txt`, `.github/`, `docs/`, and `cloudflare/` are present on GitHub.

</details>

<details>
<summary><b>Step 3: Configure Required Secrets</b></summary>

Define the internal cryptographic keys required for AES-256 encryption.

1. Go to **Settings -> Secrets and variables -> Actions -> New repository secret**.
2. Add `SITE_ID`: Set value to a descriptive site identifier (e.g., `courses404`).
3. Add `SITE_PASSWORD`: Set value to a strong random passphrase (minimum 12 characters).

*Note: Changing these values later will require re-encrypting previously published assets.*

</details>

<details>
<summary><b>Step 4: Execute the Workflow</b></summary>

The initial push automatically triggers the workflow. To manually trigger a run:
1. Navigate to the **Actions** tab on GitHub.
2. Select **Drive to WebM** from the left workflow panel.
3. Click **Run workflow -> Run workflow**.

Four parallel worker runners will allocate shards, ingest content, transcode to VP9/Opus, encrypt assets, publish releases, and publish the frontend to GitHub Pages.

</details>

<details>
<summary><b>Step 5: Verification Checkpoints</b></summary>

Confirm system health by verifying each checkpoint item below:

| Verification Target | Expected Result |
| :--- | :--- |
| Actions Workflow Run | All 4 worker jobs display green checkmarks [SUCCESS] |
| Site Home (`/YOUR_REPONAME/`) | Landing page loads successfully |
| Site Library (`/YOUR_REPONAME/library.html`) | Library interface loads course list without authentication prompts |
| Site Sitemap (`/YOUR_REPONAME/sitemap.xml`) | Sitemap contains full public domain URL |
| Releases Page | Release tag `webm-<run>-w*` exists containing `.webm.enc` assets |
| Repository Queue | `links.txt` is emptied and committed by bot runner |

</details>

<details>
<summary><b>Step 6: Optional Cloudflare Worker Media Proxy</b></summary>

Enabling the Cloudflare media proxy allows instant in-browser HTTP byte-range video streaming rather than full file pre-download.

1. Create a free Cloudflare account at `dash.cloudflare.com`.
2. Retrieve your **Account ID** from the Cloudflare dashboard sidebar.
3. Create an API token under **My Profile -> API Tokens -> Create Token -> Edit Cloudflare Workers**.
4. In GitHub Secrets, set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`.
5. Trigger the GitHub Actions workflow once. The worker will deploy automatically and write its endpoint to `docs/proxy.js`.

</details>

---

## PARALLEL WORKER & AUTO-FEED QUEUE ARCHITECTURE

The processing engine operates as a distributed matrix of 4 concurrent GitHub Actions runners (`WORKERS: 4`).

```
                                CATALOG INGESTION & SHARDING
                                 Total Catalog: N Courses
                                            |
            +-------------------+-----------+-----------+-------------------+
            |                   |                       |                   |
            v                   v                       v                   v
     Worker Matrix 1     Worker Matrix 2         Worker Matrix 3     Worker Matrix 4
     (Shard ID % 4 = 0)  (Shard ID % 4 = 1)      (Shard ID % 4 = 2)  (Shard ID % 4 = 3)
            |                   |                       |                   |
            v                   v                       v                   v
     api-progress-w1.json api-progress-w2.json   api-progress-w3.json api-progress-w4.json
            |                   |                       |                   |
            v                   v                       v                   v
     Release: webm-N-w1  Release: webm-N-w2      Release: webm-N-w3  Release: webm-N-w4
```

### Queue Execution Rules:
- **Shard Allocation**: Courses are sharded deterministically by ID (`course_id % TOTAL_WORKERS`). Worker collision is mathematically impossible.
- **State Isolation**: Each worker maintains an independent state JSON file (`api-progress-w1.json` through `w4.json`).
- **Failover Thresholds**: Dead or inaccessible Google Drive links are retried once on subsequent runs. If failure persists, the entry is flagged as skipped to prevent pipeline blocking.
- **Primary Manager Worker (Worker 1)**: Worker 1 handles manual extras from `links.txt`, compiles site authorization config (`auth.js`), updates `sitemap.xml`, and deploys the Cloudflare proxy.

---

## 3-LAYER INGESTION & DOWNLOAD ENGINE

Google Drive enforces strict rate-limits and anti-bot validation on automated downloads. The ingestion engine executes a cascading 3-tier fallback sequence:

<details open>
<summary><b>Click to view Download Mechanism Fallback Layers</b></summary>

1. **Layer 1: `gdown` Library**: Attempts high-speed Python-based stream download for standard public Drive IDs and folder structures.
2. **Layer 2: Direct Endpoint Extraction**: If Layer 1 receives rate-limit HTTP status codes, the engine extracts raw tokens via curl targeting `drive.usercontent.google.com/download?id=...&confirm=t` using realistic browser user-agents.
3. **Layer 3: Folder Salvage Ingestion**: If a folder download aborts due to a corrupt asset, Layer 3 enumerates individual folder file IDs, downloading valid items independently and skipping inaccessible assets.

</details>

---

## TRANSCODING & STREAM PROBE MATRIX

Before encoding, every downloaded file undergoes structural stream analysis using `ffprobe`.

```
                    INPUT ASSET INGESTION (downloads/)
                                    |
                                    v
                       Structural Stream Validation
                       `ffprobe -show_streams -json`
                                    |
            +-----------------------+-----------------------+
            |                                               |
     Video Stream Found?                             No Video Stream
     (Codecs: h264, hevc, vp8, etc)                  (PDF, ZIP, JPG, MP3)
            |                                               |
            v                                               v
    Transcode Engine                                DISCARD IMMEDIATELY
    ffmpeg VP9 / Opus Transcode                     Log asset removal
            |
            v
    AES-256 Encryption
```

### Transcode Profile Specification:
- **Video Codec**: Google VP9 (`libvpx-vp9`)
- **Video Bitrate Control**: Constant Rate Factor (CRF 31 default)
- **Audio Codec**: Opus (`libopus` at 128 kbps stereo)
- **Container**: WebM (`.webm`)
- **Speed Preset**: `CPU_USED: 2` (Balanced speed and compression efficiency)

---

## AES-256 CRYPTOGRAPHIC ARCHITECTURE

Security is maintained via zero-knowledge client-side encryption. Raw unencrypted media files are purged from runner environments immediately following encryption.

<details open>
<summary><b>Cryptographic Specification Summary</b></summary>

- **Cipher Specification**: AES-256-CTR (Counter Mode)
- **Key Derivation Function**: PBKDF2 with SHA-256
- **PBKDF2 Iteration Count**: 600,000 rounds
- **Key Seed**: Derived from repository secrets (`SITE_ID` + `SITE_PASSWORD`)
- **File Asset Extension**: `.webm.enc`
- **Client Decryption**: W3C Web Crypto API (`crypto.subtle.importKey`, `crypto.subtle.decrypt`) inside `docs/library.html`.

</details>

---

## MULTI-PLATFORM HOSTING & DEPLOYMENT

### GitHub Pages

For public repositories, GitHub Pages deployment is automated by Worker 1 during workflow completion.
- Source path: `/docs`
- Target branch: `main`
- Domain: `https://YOUR_USERNAME.github.io/YOUR_REPONAME/`

### Hosting the Site on Vercel

The site consists entirely of static client-side files. To host on Vercel:
1. Connect your repository to Vercel (`vercel.com/new`).
2. Set **Root Directory** to `./`.
3. Set **Output Directory** to `docs`.
4. Deploy. Vercel automatically redeploys whenever workflow runs update `auth.js` or `site-config.js`.

### Private Repository Mode

To operate the pipeline on a private repository:

| Operational Metric | Public Repository | Private Repository |
| :--- | :--- | :--- |
| GitHub Actions Minutes | Free / Unlimited | ~2,000 Free Minutes / Month |
| Schedule Cadence | Every 6 hours (~16 courses/day) | Weekly (`0 6 * * 1`) (~16 courses/month) |
| Site Hosting | GitHub Pages (Automatic) | Vercel (Hobby Tier Free) |
| Proxy Authentication | Anonymous GitHub API | `GH_READ_TOKEN` Fine-Grained Secret |

To configure private mode:
1. Generate a fine-grained GitHub access token with `Contents: Read-Only` permission.
2. Store token in secrets as `GH_READ_TOKEN`.
3. Deploy site to Vercel.

---

## CONFIGURATION REFERENCE & PERFORMANCE TUNING

Environment variables defined at the top of `.github/workflows/drive-to-webm.yml` control encoding and worker execution parameters:

<details open>
<summary><b>Click to expand Configuration Parameters Table</b></summary>

| Parameter Name | Default Value | Description & Adjustment Impact |
| :--- | :--- | :--- |
| `VP9_CRF` | `31` | Quality target (0-63). Lower values increase quality and file size; higher values reduce size. |
| `CPU_USED` | `2` | Transcode deadline speed (0-5). Higher values increase encoding speed at minor quality cost. |
| `AUDIO_KBPS` | `128` | Audio bitrate in kilobits per second. |
| `COURSE_API` | `https://ahm7xmakki.com/api/courses` | Remote catalog API endpoint. Set to `""` to disable auto-feed. |
| `API_COURSES_PER_RUN` | `1` | Number of courses processed per worker per run execution. |
| `WORKERS` | `4` | Number of parallel worker matrix runners. Must match YAML matrix setup. |
| `PUBLISH_RELEASE` | `true` | When enabled, uploads `.webm.enc` files to GitHub Releases. |
| `UPLOAD_ORIGINALS` | `false` | When enabled, attaches raw downloaded source files as 90-day workflow artifacts. |

</details>

---

## SEO & SEARCH CONSOLE PLAYBOOK

The `docs/` site includes built-in search engine optimization:

1. **Structured Metadata**: Includes JSON-LD schema markup (`Course`, `FAQPage`, `WebSite`) inside `docs/index.html`.
2. **OpenGraph Integration**: Configured with pre-rendered social card previews (`docs/assets/og-image.png`).
3. **Automated Sitemap & Robots**: Generated dynamically during workflow execution reflecting your actual hosting domain.

### Google Search Console Verification:
1. Log into Google Search Console (`search.google.com/search-console`).
2. Add your property URL (`https://YOUR_USERNAME.github.io/YOUR_REPONAME/`).
3. Copy the HTML tag verification `content` attribute value.
4. Replace the placeholder comment in `docs/index.html`:
   ```html
   <meta name="google-site-verification" content="YOUR_VERIFICATION_TOKEN" />
   ```
5. Submit `sitemap.xml` in Search Console under Sitemaps.

---

## INTERACTIVE TROUBLESHOOTING GUIDE

<details>
<summary><b>Workflow execution fails with "refusing to publish UNENCRYPTED"</b></summary>

**Cause**: Missing cryptographic repository secrets.
**Resolution**: Set `SITE_ID` and `SITE_PASSWORD` in repository secrets under **Settings -> Secrets and variables -> Actions** and re-run workflow.

</details>

<details>
<summary><b>Library page displays "Coming Soon" or empty release list</b></summary>

**Cause**: Workflow has not completed initial release publication or secrets were missing during the first run.
**Resolution**: Ensure repository secrets are set, then manually dispatch the workflow from the Actions tab.

</details>

<details>
<summary><b>Browser displays "Decryption Failed" during playback</b></summary>

**Cause**: Mismatch between key active in browser session and key used during file encryption, or mid-session secret rotation.
**Resolution**: Reload the web page. If secrets were updated after media was published, dispatch a manual workflow run with `force_reconvert` selected to re-encrypt assets under the new key.

</details>

<details>
<summary><b>Private repository library displays HTTP 404 on release assets</b></summary>

**Cause**: Anonymous access token cannot read private repository release endpoints.
**Resolution**: Create a fine-grained token with `Contents: Read-Only` permission, add it as repository secret `GH_READ_TOKEN`, and re-run workflow.

</details>

<details>
<summary><b>Google Drive ingestion fails with quota or rate limit errors</b></summary>

**Cause**: Google Drive rate-limiting temporary IP blocks on runner nodes.
**Resolution**: The pipeline automatically fails over to direct curl endpoints and file salvaging. Remaining failed items will persist in queue state and retry on the next 6-hour cron cycle.

</details>

---

## CONTRIBUTING & LICENSING

- **Contributions**: Please read [CONTRIBUTING.md](CONTRIBUTING.md) for pull request guidelines, coding standards, and testing procedures.
- **License**: This project is open source and available under the terms of the [MIT License](LICENSE).
