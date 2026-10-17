// Raises every Learn UK rule above Elementor's own CSS (adds `.lu.lu`, the body class the plugin sets)
// and repeats child selectors so they still match through Elementor's widget wrappers.
// Usage: node transform-css.mjs in.css out.css
import { readFileSync, writeFileSync } from 'node:fs';
import postcss from 'postcss';

const [IN, OUT] = process.argv.slice(2);
const root = postcss.parse(readFileSync(IN, 'utf8'));
const WRAP = ' > .elementor-widget:not(.elementor-widget-image) > ';

function prefix(sel) {
  const s = sel.trim();
  if (/^(:root|html|\*|\[hidden\])/.test(s)) return [s];
  let m;
  if ((m = s.match(/^body(\S*)(.*)$/))) return ['body.lu' + m[1] + m[2]];
  let lead = '';
  if ((m = s.match(/^(\.js(?:\.js-failed)?)\s+(.*)$/))) { lead = m[1] + ' '; sel = m[2]; } else sel = s;
  const out = [lead + '.lu.lu ' + sel];
  // Child combinators: also match the element inside an Elementor widget wrapper.
  const parts = sel.split(/\s*>\s*/);
  if (parts.length > 1) {
    for (let i = 1; i < parts.length; i++) out.push(lead + '.lu.lu ' + parts.slice(0, i).join(' > ') + WRAP + parts.slice(i).join(' > '));
  }
  return out;
}

root.walkRules((rule) => {
  if (rule.parent.type === 'atrule' && /keyframes/i.test(rule.parent.name)) return;
  rule.selectors = rule.selectors.flatMap(prefix);
});
writeFileSync(OUT, root.toString());
