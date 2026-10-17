<?php
/**
 * Placeholder URLs used in the Elementor content.
 *
 * https://lu.home/   becomes the site's home URL (with trailing slash).
 * https://lu.assets/ becomes this plugin's assets folder URL.
 *
 * Placeholders are swapped as plain text, so whatever escaping the surrounding
 * markup already has is kept. The real URLs are sanitized once with esc_url_raw(),
 * which leaves no quotes or angle brackets, so they are safe in attributes and JSON.
 *
 * @package Learn_UK_Site
 */

defined( 'ABSPATH' ) || exit;

/**
 * Home URL with trailing slash.
 *
 * @return string
 */
function lu_site_home_url() {
	return trailingslashit( esc_url_raw( home_url( '/' ) ) );
}

/**
 * Plugin assets folder URL with trailing slash.
 *
 * @return string
 */
function lu_site_assets_url() {
	return trailingslashit( esc_url_raw( plugins_url( 'assets/', LU_SITE_FILE ) ) );
}

/**
 * Replace the placeholder prefixes in a string, including JSON-escaped forms (https:\/\/lu.home\/).
 *
 * @param string $text Text that may contain placeholders.
 * @return string
 */
function lu_site_replace_placeholders( $text ) {
	if ( ! is_string( $text ) || false === strpos( $text, 'lu.' ) ) {
		return $text;
	}

	$map = array(
		'https://lu.home/'   => lu_site_home_url(),
		'https://lu.assets/' => lu_site_assets_url(),
	);
	foreach ( $map as $from => $to ) {
		$map[ str_replace( '/', '\/', $from ) ] = str_replace( '/', '\/', $to );
	}

	return strtr( $text, $map );
}

/**
 * Replace placeholders inside an Elementor control value (string or nested array, e.g. a media control).
 *
 * @param mixed $value Control value.
 * @return mixed
 */
function lu_site_replace_in_value( $value ) {
	if ( is_string( $value ) ) {
		return lu_site_replace_placeholders( $value );
	}
	if ( is_array( $value ) ) {
		return array_map( 'lu_site_replace_in_value', $value );
	}
	return $value;
}

// Whole rendered document (page content, templates, shortcodes), and single widgets
// rendered on their own (e.g. by the editor over AJAX). Replacing twice is harmless.
add_filter( 'elementor/frontend/the_content', 'lu_site_replace_placeholders' );
add_filter( 'elementor/widget/render_content', 'lu_site_replace_placeholders' );

// Control values used in Elementor's generated CSS (e.g. container background images).
// This runs when the CSS file is built, so regenerate CSS (Elementor > Tools) after
// moving the site to a new URL.
add_filter( 'elementor/files/css/property', 'lu_site_replace_in_value' );
