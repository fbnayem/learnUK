#!/bin/bash
# Builds the WordPress + Elementor version of the site from dist/ (run `node src/build.mjs` first).
# Writes wordpress/out/: learn-uk-site.zip (plugin), learn-uk-elementor-kit.zip, learn-uk-page-templates.zip, IMPORT-STEPS.txt.
# IMG_BASE is where Elementor downloads the photos from during import (the live static site).
set -e
cd "$(dirname "$0")"
DIST=../dist
OUT=out
IMG_BASE=${IMG_BASE:-https://learn-uk-one.vercel.app/}
PLUGIN=$OUT/learn-uk-site

rm -rf $OUT && mkdir -p $OUT
cp -r plugin/learn-uk-site $PLUGIN
node tools/sync-assets.mjs $DIST $PLUGIN > /dev/null
node tools/gen-seo.mjs $DIST $PLUGIN > /dev/null
node tools/gen-image-hints.mjs $DIST $PLUGIN > /dev/null
node tools/transform-css.mjs $DIST/assets/css/site.css $PLUGIN/assets/css/site.css
node tools/convert.mjs $DIST $OUT/build $IMG_BASE
node tools/kit.mjs $OUT/build > /dev/null

# Elementor compatibility CSS: the hand-written rules, the converted inline styles, and the stagger index classes.
{
  cat tools/elementor-compat.css
  echo; echo '/* Inline styles from the original markup, as classes (generated). */'
  cat $OUT/build/inline-styles.css
  echo '/* Stagger index classes, replacing style="--i:N" (generated). */'
  for i in $(seq 0 30); do echo ".lu-i$i{--i:$i}"; done
} > $PLUGIN/assets/css/elementor-compat.css

(cd $OUT && zip -qr learn-uk-site.zip learn-uk-site)
mv $OUT/build/learn-uk-elementor-kit.zip $OUT/
(cd $OUT/build/templates && zip -qr ../../learn-uk-page-templates.zip .)
cp IMPORT-STEPS.txt $OUT/
ls -la $OUT
