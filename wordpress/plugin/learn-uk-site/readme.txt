=== Learn UK Site ===
Requires at least: 6.2
Tested up to: 7.2
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Styles, scripts, fonts, images and course data for the Learn UK pages built with Elementor.

== Description ==

Companion plugin for the Learn UK Elementor kit. It provides everything the pages need that Elementor does not:

* The site stylesheet, web fonts, images, interactive script (navigation, course search, enquiry forms, 3D globe) and course data, loaded on pages built with Elementor and in the Elementor editor preview.
* Swaps the placeholder URLs used in the kit content: `https://lu.home/` for the site address and `https://lu.assets/` for this plugin's assets folder.
* Turns `lu-attr__name__value` CSS classes on Elementor elements into HTML attributes.
* Page titles, meta descriptions, Open Graph tags and structured data for the Learn UK pages when no SEO plugin (Yoast SEO, Rank Math, All in One SEO, SEOPress) is active.
* Adds alt text to the Learn UK photos imported into the Media Library.
* A one-click "Finish Learn UK setup" notice: sets "Post name" permalinks, makes the `home` page the front page and fills in photo alt text.

== Installation ==

1. Install and activate Elementor, then this plugin.
2. Import the Learn UK kit (Elementor > Tools > Import / Export Kit).
3. Click "Finish Learn UK setup" in the admin notice.

If you move the site to a new address, regenerate Elementor's CSS (Elementor > Tools > Regenerate CSS & Data) so background images point at the new address.

== Changelog ==

= 1.0.0 =
* First release.
