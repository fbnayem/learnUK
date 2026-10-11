# Learn UK website

Static, multi-page site built from brief v2.1. No framework; a small Node build script generates the pages.

## Structure

- `src/build.mjs`: page templates and build (writes `dist/`)
- `src/css/site.css`: all styles (tokens from the brief)
- `src/js/main.js`: navigation, reveals, tilt, FAQ, filters, enquiry form, 3D tier choice
- `src/js/globe/scene.js`: the Three.js globe (loaded on demand)
- `src/js/globe/land.js`: generated land dots (`tools/gen-land.mjs`, Natural Earth 50m via world-atlas)
- `src/data/universities.json`, `src/data/courses.json`: sample data (`tools/gen-data.mjs`)
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
