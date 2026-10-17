<?php
/**
 * Plugin Name:       Learn UK Site
 * Description:       Styles, scripts, fonts, images and course data for the Learn UK pages built with Elementor.
 * Version:           1.0.0
 * Requires at least: 6.2
 * Requires PHP:      7.4
 * Author:            Learn UK
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       learn-uk-site
 *
 * @package Learn_UK_Site
 */

defined( 'ABSPATH' ) || exit;

define( 'LU_SITE_VERSION', '1.0.0' );
define( 'LU_SITE_FILE', __FILE__ );
define( 'LU_SITE_DIR', plugin_dir_path( __FILE__ ) );

/**
 * The page slugs that make up the Learn UK site.
 *
 * @return string[]
 */
function lu_site_slugs() {
	return array( 'home', 'universities', 'courses', 'application-journey', 'services', 'about', 'faqs', 'contact', 'privacy', 'terms', 'cookies', 'accessibility', 'complaints' );
}

require_once LU_SITE_DIR . 'includes/urls.php';
require_once LU_SITE_DIR . 'includes/frontend.php';
require_once LU_SITE_DIR . 'includes/head.php';
require_once LU_SITE_DIR . 'includes/media.php';
require_once LU_SITE_DIR . 'includes/setup.php';

register_activation_hook( __FILE__, 'lu_site_activate' );
