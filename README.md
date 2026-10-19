# StudyKit Hub

**Learn smarter. Study better.** A free educational website for students, teachers and education
creators, run by Ali Hamza. It currently offers six browser-based study tools; study guides,
revision notes and worksheets are planned and are not published yet.

Plain static HTML, CSS and vanilla JavaScript: no framework, no build step, no external fonts,
scripts, analytics, ads or cookies. All text processing happens in the visitor's browser.

> **Status:** published with GitHub Pages at <https://studykithub.online/> (custom domain; the old <https://hamzaxali.github.io/studykit-tools/> address redirects there), built
> from the `main` branch (folder `/`). The repository keeps its original name, `studykit-tools`, so
> the live URL is unchanged by the StudyKit Hub rebrand. Changes reach the live site only when they
> are merged into `main`.
>
> **Releases:** `v0.1.0` (first build, placeholder base URL) and `v0.1.1` (the live StudyKit Tools
> version before the rebrand, commit `92610e2`). Do not roll back to bare `v0.1.0`; see section 7.

Pages:

| Page | URL path |
| --- | --- |
| Home | `/` |
| Study tools hub | `/tools/` |
| Study notes organiser (browser storage only) | `/tools/study-notes-organizer/` |
| Word and character counter | `/tools/word-counter/` |
| Reading time calculator (reading + speaking time) | `/tools/reading-time-calculator/` |
| Case converter (UPPER, lower, Title, Sentence) | `/tools/case-converter/` |
| Whitespace cleaner | `/tools/whitespace-cleaner/` |
| Duplicate line remover | `/tools/remove-duplicate-lines/` |
| About, Contact, Privacy policy, Terms of use, Disclaimer | `/about/`, `/contact/`, `/privacy-policy/`, `/terms/`, `/disclaimer/` |

**Planned sections (not built):** Study guides, Revision notes, Worksheets. The home page lists them
as "Planned — coming soon" without links. Create their pages, nav links and sitemap entries only
when each has several genuinely useful, original pieces.

**Internal names that must not change:** the JavaScript globals `window.StudyKit` and
`window.StudyKitText`, the notes storage key `studykit.notes.v1`, and the export schema
`studykit-notes` / `studykit-notes-*.json` file names. Renaming them would hide visitors' saved notes
or break imports of their backups.

---

## 1. File structure

```
studykit-tools/                      (repository name kept; public brand is StudyKit Hub)
├── index.html                       Home page (hero, tools, planned sections, privacy summary)
├── 404.html                         Self-contained "not found" page (inline CSS, absolute links)
├── about/index.html
├── contact/index.html               mailto: link to hamzaxali44@gmail.com (no form)
├── privacy-policy/index.html        Effective 20 October 2026 (legal review recommended)
├── terms/index.html                 Last updated 20 October 2026 (legal review recommended)
├── disclaimer/index.html            Last updated 20 October 2026
├── tools/
│   ├── index.html                   Study tools hub
│   ├── word-counter/index.html
│   ├── reading-time-calculator/index.html
│   ├── case-converter/index.html
│   ├── remove-duplicate-lines/index.html
│   ├── whitespace-cleaner/index.html
│   └── study-notes-organizer/index.html
├── assets/
│   ├── css/styles.css               One stylesheet; mobile first; light/dark via prefers-color-scheme
│   └── js/
│       ├── text-utils.js            Pure text functions (browser + Node), used by tools and tests
│       ├── common.js                Copy, download, live status messages, debounce
│       └── tools/                   One small script per tool
├── favicon.svg
├── robots.txt
├── sitemap.xml
├── ads.txt.example                  INACTIVE. Never rename to ads.txt before you have a real publisher ID
├── .nojekyll                        Tells GitHub Pages to publish files as-is
├── .htmlvalidate.json               HTML validator settings (tests only)
├── scripts/
│   ├── set-base-url.js              Replaces the base URL everywhere
│   └── base-url.txt                 The base URL currently in the files
├── tests/
│   ├── text-utils.test.js           Node unit tests (node --test)
│   ├── check-site.js                Static checks: links, titles, canonicals, JSON-LD, sitemap
│   └── browser/                     Playwright + axe-core browser tests (test-only dependencies)
└── README.md
```

All internal links are **relative** (for example `../../about/`), so the same files work at a
domain root (for example a future custom domain) and in a sub-folder (`https://user.github.io/studykit-tools/`).

## 2. Preview locally

The pages use folder URLs (`/about/`), so open them through a local web server, not by
double-clicking the files.

```bash
cd studykit-tools
python3 -m http.server 8000
# open http://localhost:8000/
```

(Any static server works, for example `npx serve .`.)

## 3. Base URL

The base URL is already set to `https://studykithub.online` (stored in
`scripts/base-url.txt`). Canonical tags, Open Graph URLs, JSON-LD, `sitemap.xml`, `robots.txt` and
the 404 page use it. Do not change it to a domain you do not own yet.

When a custom domain is bought and connected later, update every file with one command
(https, no trailing slash), then review and re-test:

```bash
node scripts/set-base-url.js https://www.your-new-domain
git diff --stat
node tests/check-site.js --launch
```

Also update the `<lastmod>` dates in `sitemap.xml` when you change page content, and update the
privacy policy (the "shared web address" paragraph no longer applies on a custom domain).

## 4. Publish on GitHub Pages (how the current site was set up)

GitHub Pages is free for **public** repositories on GitHub Free.

1. Create a free account at https://github.com and sign in.
2. Click **New repository**. Name it `studykit-tools`. Choose **Public**. Do **not** add a README
   (this folder already has one). Click **Create repository**.
3. Set the base URL (section 3) to `https://YOUR-GITHUB-USERNAME.github.io/studykit-tools`,
   then commit:
   ```bash
   git add -A && git commit -m "Set base URL for GitHub Pages"
   ```
4. Push the existing repository (GitHub shows these commands on the empty repo page):
   ```bash
   git remote add origin https://github.com/YOUR-GITHUB-USERNAME/studykit-tools.git
   git branch -M main
   git push -u origin main
   ```
   When asked for a password, use a GitHub personal access token or sign in with GitHub
   Desktop / `gh auth login`. GitHub no longer accepts account passwords for git.
5. In the repository open **Settings → Pages**. Under **Build and deployment**, set
   **Source: Deploy from a branch**, **Branch: `main`**, folder **`/ (root)`**, and click **Save**.
6. Wait for the deployment to finish (the **Actions** tab shows a "pages build and deployment"
   run; usually one or two minutes). The URL appears at the top of **Settings → Pages**.
7. Tick **Enforce HTTPS** in Settings → Pages if it is not already on.
8. Do the checks in "Verify the live site" below.

Notes:

* A repository named exactly `YOUR-GITHUB-USERNAME.github.io` is published at the domain root
  (`https://YOUR-GITHUB-USERNAME.github.io/`) instead of a sub-folder. That matters for
  `robots.txt` and `ads.txt` (see section 8).
* **Everything in the repository is published**, including `README.md`, `tests/`, `scripts/`,
  `.htmlvalidate.json` and `ads.txt.example`. None of it is secret or harmful, but do not commit
  anything private. Because of `.nojekyll`, Jekyll `exclude` settings do not apply. Options to stop
  publishing these files, each of which changes the Pages settings and needs the owner's approval:
  (a) move the site files into a `/docs` folder and set Pages to publish `main` → `/docs`; or
  (b) publish with a GitHub Actions Pages workflow that uploads only the site files (free for public
  repositories). Until then they stay published as they are.
* **Usage policy:** GitHub states that Pages "is not intended for or allowed to be used as a free
  web-hosting service to run your online business, e-commerce site, or any other website that is
  primarily directed at either facilitating commercial transactions or providing commercial software
  as a service (SaaS)" ([GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)).
  A free tools site is fine to start with. Once you add ads and treat the site as a business, moving to
  Cloudflare Pages (below) is the cautious choice.

## 5. Publish on Cloudflare Pages (alternative, better for the ads phase)

1. Create a free account at https://dash.cloudflare.com/sign-up.
2. Push this repository to GitHub as in steps 1–4 above (you can set the base URL afterwards).
3. In the Cloudflare dashboard go to **Workers & Pages → Create → Pages → Import an existing Git
   repository** (wording in the dashboard can change slightly). Connect your GitHub account and
   select `studykit-tools`.
4. Build settings: **Framework preset: None**, **Build command: leave empty** (or `exit 0` if a value
   is required), **Build output directory: `/`**. Click **Save and Deploy**.
5. Your site appears at `https://<project-name>.pages.dev`. Set the base URL to that address
   (section 3), commit and push; Cloudflare redeploys automatically.
6. Every branch other than `main` gets its own **preview URL**, which is ideal for testing changes
   (section 6).

Direct upload without Git is also possible (Workers & Pages → Create → Pages → **Upload assets**,
then drag the folder), but Git gives you history and rollback, so it is preferred.

## 6. Verify the live site

Do not call the site "live" until all of these pass on the real URL:

1. Open the home page and every tool page on a phone and a computer.
2. Use each tool once (type, copy, clear) and check the browser console has no errors
   (F12 → Console).
3. Open `/robots.txt` and `/sitemap.xml`; the URLs inside must use your real address.
4. Open a made-up address such as `/does-not-exist`; the 404 page must appear and its links must work.
5. View the page source of one tool page: the `<link rel="canonical">` must show your real address.
6. Optional: test a tool page with Google's Rich Results Test (https://search.google.com/test/rich-results)
   and PageSpeed Insights (https://pagespeed.web.dev/).
7. Optional: add the site to Google Search Console (https://search.google.com/search-console),
   verify ownership with the HTML-tag or DNS method, and submit `sitemap.xml`.

## 7. Updating safely (without losing the working version)

The `main` branch is always the version that is live. Never edit it directly.

```bash
# 1. Start a branch for the change
git switch main && git pull
git switch -c improve-word-counter

# 2. Edit files, preview locally (section 2), then run the tests (section 10)
node --test tests/ && node tests/check-site.js

# 3. Commit and push the branch
git add -A && git commit -m "Word counter: explain hyphenated words"
git push -u origin improve-word-counter
```

4. **Preview:** on Cloudflare Pages the branch gets its own preview URL automatically. On GitHub
   Pages there are no branch previews, so preview locally (or use a Cloudflare preview even if
   GitHub Pages is your main host).
5. Open a **pull request** on GitHub from the branch into `main`, review the changes, then merge.
   Merging deploys the new version.
6. **Tag every release that works**, so you can always get back to it:
   ```bash
   git switch main && git pull
   git tag -a v1.0.0 -m "First public version"
   git push origin v1.0.0
   ```
7. **Rollback:**
   * Cloudflare Pages: open the project → **Deployments**, find the last good deployment →
     **Rollback to this deployment**. Instant, no git needed.
   * GitHub Pages (or both): undo the bad change on `main` with a new commit, which keeps history:
     ```bash
     git switch main && git pull
     git revert <bad-commit-sha>        # or: git revert -m 1 <merge-commit-sha>
     git push
     ```
     To put back exactly what a tag contained: `git checkout v0.1.1 -- .` then commit and push.
     `v0.1.1` is the live pre-rebrand version. **Do not restore bare `v0.1.0`**: it still has the
     `YOUR-DOMAIN.example` placeholder base URL (if you must, run `scripts/set-base-url.js` afterwards).
     Avoid `git push --force` on `main`.
8. Keep the downloaded ZIP of a working version somewhere safe as an extra offline backup.

## 8. Ad readiness (keep ads OFF until approved)

There is **no ad code** in this site. `ads.txt.example` is inactive on purpose, and
`tests/check-site.js` fails if a real `ads.txt` or ad/analytics script appears.

**Before you apply**

* **Domain.** AdSense only accepts a site URL that is a domain with no path. It lists
  `example.com/directory` and `subdomain.example.com` as invalid, with exceptions for host partners
  ([AdSense: entering your site URL](https://support.google.com/adsense/answer/2784438)). It also says subdomains on platforms in the
  public suffix list can be added ([AdSense site management](https://support.google.com/adsense/answer/12170421)). `github.io` and
  `pages.dev` are on that list, so a root-level `user.github.io` or `project.pages.dev` *may* be accepted,
  but a GitHub **project** site (`user.github.io/studykit-tools`) cannot be, because it has a path. A
  custom domain (about US$10–15 a year) is the reliable route, and it also lets `ads.txt` sit at the
  domain root.
* **Content.** Google reviews the whole site against the AdSense Program policies. Approval can take
  from a few days to 2–4 weeks ([Connect your site to AdSense](https://support.google.com/adsense/answer/7584263)). Sites with little original content
  are often rejected. Add genuinely useful pages and tools over time. Do not mass-generate pages.
* **Policies filled in.** Finish the privacy policy, terms, disclaimer, about and contact pages first
  (section 9).

**Site ownership verification** (pick one, all from AdSense → Sites; [Google's guide](https://support.google.com/adsense/answer/7584263)):

1. **AdSense code snippet:** paste the `<script>` Google gives you into the `<head>` of every page
   where ads should appear.
2. **Meta tag:** add `<meta name="google-adsense-account" content="ca-pub-…">` to the `<head>` of the
   home page. This verifies ownership without showing ads.
3. **ads.txt snippet:** create `ads.txt` in the site root with the exact line from your account, in the form
   `google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0`. It must load at
   `https://your-domain/ads.txt` ([Ads.txt guide](https://support.google.com/adsense/answer/12171612)). Copy `ads.txt.example`, keep only that line, and use your
   real publisher ID. **Never publish the example ID.**

Every page has a comment `<!-- Site ownership verification / ad code: intentionally absent … -->`
in the `<head>` showing where code goes.

**Content Security Policy:** each page has a strict CSP meta tag (`script-src 'self'`,
`connect-src 'none'`, …). It proves to visitors that text cannot be sent anywhere, **and it will
block ad scripts**. When ads are approved, you must widen the CSP on pages that show ads to allow
the domains Google documents (or remove the CSP meta tag there), and change the privacy wording to
match.

**Consent (EEA, UK, Switzerland):** to show personalised ads to visitors in these regions, Google
requires a **Google-certified consent management platform (CMP) that integrates with the IAB TCF**
(EEA and UK since 16 January 2024, Switzerland since 31 July 2024) ([Google consent requirements](https://support.google.com/adsense/answer/13554116)). AdSense offers its own CMP
under **Privacy & messaging**. Set it up before ads go live. Your audience includes students, so
also review the rules for content and ads directed at children where your visitors live, and use
AdSense's child-directed settings if they apply.

**When ads are approved:**

1. **Before** ads go live, rewrite the "Analytics and advertising" section of
   `privacy-policy/index.html` (there is deliberately no hidden ad section any more). It must name the ad
   network, explain that third-party vendors including Google use cookies to serve ads based on previous
   visits, link to Google's [My Ad Center](https://myadcenter.google.com/) and
   [partner-sites page](https://policies.google.com/technologies/partner-sites), describe the consent
   choice for EEA/UK/Swiss visitors, and update the Summary and Cookies sections (the site will then use
   cookies). Update the effective date. Have the result reviewed.
2. Update the "Advertising and sponsorship" paragraph in the disclaimer (ads are provided by third
   parties; showing an ad is not an endorsement).
3. Widen the CSP (see above), add the ad code, and test on a branch preview first.

**Placement guidance**

* Put ads **below** the tool and its result, or between the instructions sections. Never between the
  text box and its buttons, and never where they could be mistaken for the Copy / Clear / Convert
  buttons.
* Label ad areas clearly ("Advertisement"). Do not style ads to look like tools or download buttons.
* Keep the tool usable on a phone without scrolling past ads first. Avoid pop-ups and sticky ads that
  cover the text box.
* Reserve space for ad slots in CSS so the page does not jump (layout shift) when ads load.

**Never** click your own ads, ask anyone to click them, refresh pages to generate impressions,
buy traffic from "traffic exchange" or bot services, or place ads on pages that have no content.
This counts as invalid traffic and can get the account closed and earnings withheld. To view your
own live site without risk, use the AdSense preview tools or a browser ad blocker.

## 9. Policy status and legal review

`node tests/check-site.js --launch` passes: no placeholders, template notices, `YOUR-DOMAIN`,
`example.com`, TODO or FIXME remain in published pages. The confirmed details used are:

| Item | Value used |
| --- | --- |
| Owner / trading name | Ali Hamza (an individual; no company, address or registration is claimed) |
| Contact | `hamzaxali44@gmail.com` (mailto: link; email provided by Google Gmail) |
| Hosting | GitHub Pages (GitHub, Inc.), with GitHub's IP-logging statement and privacy links |
| Effective / last-updated date | 20 October 2026 |
| Email retention | Only as long as necessary for the stated purpose, subject to any applicable legal obligations |
| Governing law | Pakistan, subject to mandatory rights under the visitor's local law |
| Age wording | 13+, or younger with permission and supervision of a parent, guardian or teacher |
| Copyright | © 2026 Ali Hamza. All rights reserved (no licence file) |

**Legal review is recommended** before monetising, and ideally before wider promotion. The policies
are plain-language descriptions of how the site actually works, not legal advice, and they make no
claim of compliance with any specific law. Pay particular attention to: governing law and limitation
of liability for international visitors, the children/age wording, and the advertising and consent
wording that will be needed before ads.

Whenever the site's behaviour changes (new storage, analytics, ads, forms, a new host or a custom
domain), update the privacy policy first and change its effective date.

Never add a physical address, company registration number, tax ID or professional credentials
unless they are real and yours.

## 10. Tests

```bash
# Unit tests for every text function (Node 18+; no install needed)
node --test tests/

# Static site checks: titles, descriptions, canonicals, JSON-LD, links, anchors, labels, sitemap, robots
node tests/check-site.js
node tests/check-site.js --launch     # strict gate: also fails on placeholders, TODO, example.com, old brand

# Browser tests (Chrome or Chromium must be installed). Installs test-only packages into tests/browser/node_modules.
cd tests/browser && npm install
CHROME_PATH=/usr/bin/google-chrome node run.mjs
npx html-validate ../../index.html ../../404.html "../../*/index.html" "../../tools/*/index.html"
```

The browser suite serves the site under a sub-folder (like a GitHub project site), loads all 14
pages at 375 px and 1280 px in light and dark mode, fails on console errors, failed requests,
external requests or horizontal scrolling, runs axe-core (WCAG 2.2 AA + best practice), checks the
skip link and that tab stops have a visible focus outline and a name, and clicks through every tool.
axe-core, Playwright and html-validate are only used for testing and are never loaded by the site.

## 11. Free hosting limits and possible costs

Figures checked on 20 October 2026. They can change, so re-check the linked pages.

**GitHub Pages** ([official limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)):

* Published site: max **1 GB**. Source repository: recommended max 1 GB.
* Bandwidth: **soft limit of 100 GB per month**. Builds: soft limit of 10 per hour. Deployments time out after 10 minutes.
* If you go over, GitHub may stop serving the site or email you asking you to reduce usage. It does not bill you.
* Not intended for running an online business (see section 4).

**Cloudflare Pages, Free plan** ([official limits](https://developers.cloudflare.com/pages/platform/limits/)):

* **500 builds per month**, one build at a time, 20-minute build timeout.
* Up to **20,000 files** per site; max **25 MiB** per file; 100 custom domains per project.
* Cloudflare's Pages pricing page says plans include unlimited requests and bandwidth for static assets
  ([Cloudflare Pages](https://www.cloudflare.com/developer-platform/products/pages/)).

**What this site uses:** about 210 KB in 31 published files, including this README. A first visit to one tool page downloads about
45–55 KB uncompressed (HTML + CSS + JS + icon), or about 17 KB with the gzip compression both hosts
apply. Repeat visits reuse cached CSS and JS. Even at the uncompressed figure, 100 GB a month is
roughly **2 million page views** on GitHub Pages. The tools do
their work on visitors' devices, so traffic does not create server cost. Very large inputs (1 MB or more)
depend on the visitor's device. In tests the counting code took about 0.2 s for 1 MB in Chrome, but
Chrome needed 2–7 s just to lay out that much text in the text box.

**Things that could cost money**

| Item | Typical cost | Needed? |
| --- | --- | --- |
| Custom domain (e.g. `.com`) | roughly US$10–15 per year, more for some extensions | Optional for launch; practically needed for AdSense and a professional email address |
| Email at your domain | free forwarding exists with some registrars and Cloudflare Email Routing; mailbox hosting usually costs | Optional; a free webmail address works for the contact page |
| Consent management platform | Google's own CMP in AdSense is free; third-party CMPs may charge | Only when ads go live in the EEA/UK/Switzerland |
| Legal review of the policies | varies | Recommended once the site earns money |
| Paid Cloudflare / GitHub plans | not needed | Only if you outgrow the free limits above |
| Paid form or analytics services | not used | The contact page uses `mailto:`; add privacy-friendly analytics only if you also update the privacy policy |
