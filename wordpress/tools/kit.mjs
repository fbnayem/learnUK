// Writes manifest.json and site-settings.json next to the converted pages, then zips the kit.
// Usage: node kit.mjs <build dir>   (after convert.mjs)
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const B = process.argv[2].replace(/\/?$/, '/');
const pages = JSON.parse(readFileSync(B + 'pages.json'));
const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

const color = (_id, title, c) => ({ _id, title, color: c });
const type = (_id, title, family, weight, size) => ({
  _id, title, typography_typography: 'custom', typography_font_family: family, typography_font_weight: String(weight),
  ...(size ? { typography_font_size: { unit: 'rem', size, sizes: [] } } : {}),
});
const settings = {
  template: 'default',
  site_name: 'Learn UK',
  site_description: 'Study at a UK university',
  system_colors: [color('primary', 'Royal blue', '#1800AC'), color('secondary', 'Navy', '#0B1640'), color('text', 'Ink', '#3B4468'), color('accent', 'Amber', '#F5A623')],
  custom_colors: [
    color('lunavy', 'Learn UK navy', '#0B1640'), color('luroyal', 'Learn UK royal blue', '#1800AC'),
    color('lumist', 'Learn UK mist', '#F4F6FB'), color('luamber', 'Learn UK amber (never on white)', '#F5A623'),
    color('luambertext', 'Learn UK amber text', '#8A5300'), color('luinksoft', 'Learn UK soft ink', '#3B4468'),
  ],
  system_typography: [type('primary', 'Headings', 'Urbanist', 700), type('secondary', 'Subheadings', 'Urbanist', 600), type('text', 'Body', 'Inter', 400), type('accent', 'Buttons', 'Inter', 600)],
  custom_typography: [],
  default_generic_fonts: 'system-ui, sans-serif',
  container_width: { unit: 'rem', size: 76, sizes: [] },
  container_padding: { unit: 'px', top: '0', right: '0', bottom: '0', left: '0', isLinked: true },
  space_between_widgets: { column: '0', row: '0', isLinked: true, unit: 'px', size: 0 },
  body_background_background: 'classic',
  body_background_color: '#FFFFFF',
  viewport_md: 768,
  viewport_lg: 1025,
};
writeFileSync(B + 'kit/site-settings.json', JSON.stringify({ content: [], settings, metadata: [] }));

const manifest = {
  name: 'learn-uk',
  title: 'Learn UK website',
  description: 'All 13 Learn UK pages with the brand colours and fonts. Needs the Learn UK Site plugin.',
  author: 'Learn UK',
  version: '2.0',
  elementor_version: '3.25.0',
  created: now,
  thumbnail: false,
  site: 'https://lu.home',
  'site-settings': ['global-colors', 'global-typography', 'theme-style-typography', 'theme-style-buttons', 'theme-style-images', 'theme-style-form-fields', 'settings-background', 'settings-layout', 'settings-lightbox', 'settings-page-transitions', 'settings-custom-css'],
  plugins: { 'elementor/elementor.php': { name: 'Elementor', plugin: 'elementor/elementor.php', pluginUri: 'https://elementor.com/', version: '3.25.0' } },
  content: { page: pages },
  'wp-content': {},
};
writeFileSync(B + 'kit/manifest.json', JSON.stringify(manifest));
execSync(`cd ${B}kit && rm -f ../learn-uk-elementor-kit.zip && zip -qr ../learn-uk-elementor-kit.zip .`);
console.log('kit written', B + 'learn-uk-elementor-kit.zip');
