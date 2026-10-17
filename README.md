# Learn UK website

Static, multi-page site built from brief v2.1. No framework; a small Node build script generates the pages.

## Structure

- `src/build.mjs`: page templates and build (writes `dist/`)
- `src/css/site.css`: all styles (tokens from the brief)
- `src/js/main.js`: navigation, reveals, tilt, FAQ, filters, enquiry form, 3D tier choice
- `src/js/globe/scene.js`: the Three.js globe (loaded on demand)
- `src/js/globe/land.js`: generated land dots (`tools/gen-land.mjs`, Natural Earth 50m via world-atlas)
- `src/data/universities.json`, `src/data/courses.json`: real data from `tools/fetch-data.mjs`. Courses and providers come from Discover Uni (Office for Students, HESA and the UK funding bodies, Open Government Licence v3.0); websites, cities and founding years come from Wikidata, matched by UKPRN. Scope: full-time undergraduate courses at UK universities. The GitHub Actions workflow `.github/workflows/refresh-data.yml` re-runs the fetch every Monday and commits any changes, which redeploys the site.
- `static/img/globe-*`: static render of the globe (`tools/render-static.mjs`)
- `tests/verify.mjs`: automated checks; `reports/`: verification report and Lighthouse results
- `dist/`: the built site, ready to upload to any static host

## Commands

```
npm install
node src/build.mjs              # build to dist/
node tools/serve.mjs dist 4173  # local server
node tools/render-static.mjs    # re-render the static globe (server running), then build again
node tests/verify.mjs           # run checks (server running)
```

Edit the data JSON files, then rebuild, to change universities and courses. The enquiry form's submit handler is in `initEnquiry()` in `src/js/main.js`; connect it to a backend there.

## Deployment

Vercel builds from this repo using `vercel.json`: `npm install --omit=dev`, then `node src/build.mjs`, serving `dist/`. Only esbuild, three and the two font packages are needed to build; the rest (Playwright, Lighthouse, sharp, map data) are dev tools for regenerating assets and testing.

## WordPress + Elementor version

`wordpress/build.sh` turns `dist/` into files for a WordPress site with Elementor (free): a plugin with the styles, scripts, fonts, images and course data (`learn-uk-site.zip`), an Elementor Kit with all pages and site settings, and the same pages as single templates. Run `node src/build.mjs` first, then `wordpress/build.sh`; output goes to `wordpress/out/`. Import steps for site owners are in `wordpress/IMPORT-STEPS.txt`.

- `tools/convert.mjs` maps each page to Elementor containers (layout elements keep their classes), Text Editor widgets (runs of plain headings, paragraphs and lists), Image widgets (photos, downloaded into the Media Library on import from `IMG_BASE`) and HTML widgets (forms, filters, icons, buttons, header and footer). Links are written as `https://lu.home/...` and assets as `https://lu.assets/...`; the plugin replaces them when the page renders.
- `tools/transform-css.mjs` raises `site.css` above Elementor's own CSS (`.lu.lu` prefix; `lu` is the body class the plugin adds) and repeats child selectors through Elementor's widget wrappers. `tools/elementor-compat.css` neutralises Elementor's container defaults.
- `tools/drift.mjs` and `tools/styles.mjs` compare a WordPress page with the static page (positions and computed styles) in Chromium.
