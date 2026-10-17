<?php
/**
 * Front-end and editor-preview assets.
 *
 * @package Learn_UK_Site
 */

defined( 'ABSPATH' ) || exit;

/**
 * Whether the current request is Elementor's editor preview iframe.
 *
 * @return bool
 */
function lu_site_is_preview() {
	return class_exists( '\Elementor\Plugin' )
		&& isset( \Elementor\Plugin::$instance->preview )
		&& \Elementor\Plugin::$instance->preview->is_preview_mode();
}

/**
 * Whether the current view is a Learn UK page: a page built with Elementor, or one of the site's slugs.
 *
 * @return bool
 */
function lu_site_is_lu_page() {
	if ( ! is_singular( 'page' ) ) {
		return false;
	}
	$post = get_queried_object();
	if ( ! $post instanceof WP_Post ) {
		return false;
	}
	return 'builder' === get_post_meta( $post->ID, '_elementor_edit_mode', true )
		|| in_array( $post->post_name, lu_site_slugs(), true );
}

/**
 * Whether the plugin's design should load on this request (front end or editor preview).
 *
 * @return bool
 */
function lu_site_is_active_view() {
	return lu_site_is_preview() || lu_site_is_lu_page();
}

/**
 * Cache-busting version for a file in assets/.
 *
 * @param string $path Path relative to assets/.
 * @return string
 */
function lu_site_asset_version( $path ) {
	$file = LU_SITE_DIR . 'assets/' . $path;
	return file_exists( $file ) ? (string) filemtime( $file ) : LU_SITE_VERSION;
}

/**
 * Register and enqueue the stylesheets.
 */
function lu_site_enqueue_styles() {
	$base = lu_site_assets_url();
	wp_enqueue_style( 'learn-uk-site', $base . 'css/site.css', wp_style_is( 'elementor-frontend', 'registered' ) ? array( 'elementor-frontend' ) : array(), lu_site_asset_version( 'css/site.css' ) );
	wp_enqueue_style( 'learn-uk-site-compat', $base . 'css/elementor-compat.css', array( 'learn-uk-site' ), lu_site_asset_version( 'css/elementor-compat.css' ) );
}

/**
 * Front end: styles plus main.js as an ES module in the head, as on the static site.
 * In the preview iframe main.js is loaded by preview.js instead, once Elementor has rendered the content.
 */
function lu_site_enqueue_frontend() {
	if ( lu_site_is_preview() || ! lu_site_is_lu_page() ) {
		return;
	}
	lu_site_enqueue_styles();
	wp_enqueue_script( 'learn-uk-site', lu_site_assets_url() . 'js/main.js', array(), lu_site_asset_version( 'js/main.js' ), false );
}
add_action( 'wp_enqueue_scripts', 'lu_site_enqueue_frontend' );

/**
 * Editor preview: the real design plus a helper that resolves placeholders and lu-attr__ classes live.
 */
function lu_site_enqueue_preview_scripts() {
	$base = lu_site_assets_url();
	wp_enqueue_script( 'learn-uk-site-attrs', $base . 'js/lu-attrs.js', array(), lu_site_asset_version( 'js/lu-attrs.js' ), true );
	wp_enqueue_script( 'learn-uk-site-preview', $base . 'js/preview.js', array( 'learn-uk-site-attrs' ), lu_site_asset_version( 'js/preview.js' ), true );
}
add_action( 'elementor/preview/enqueue_styles', 'lu_site_enqueue_styles' );
add_action( 'elementor/preview/enqueue_scripts', 'lu_site_enqueue_preview_scripts' );

/**
 * Load main.js as a module script (type="module"), so its relative chunk import resolves from the plugin folder.
 *
 * @param array $attributes Script tag attributes.
 * @return array
 */
function lu_site_module_attribute( $attributes ) {
	if ( isset( $attributes['id'] ) && 'learn-uk-site-js' === $attributes['id'] ) {
		$attributes['type'] = 'module';
	}
	return $attributes;
}
add_filter( 'wp_script_attributes', 'lu_site_module_attribute' );

/**
 * Add the `lu` body class.
 *
 * @param string[] $classes Body classes.
 * @return string[]
 */
function lu_site_body_class( $classes ) {
	if ( lu_site_is_active_view() ) {
		$classes[] = 'lu';
	}
	return $classes;
}
add_filter( 'body_class', 'lu_site_body_class' );

/**
 * Turn lu-attr__ classes into attributes. Printed inline at the start of wp_footer, after the
 * page content; main.js is a module (deferred), so it always runs after this.
 */
function lu_site_print_attribute_shim() {
	if ( lu_site_is_preview() || ! lu_site_is_lu_page() ) {
		return;
	}
	$js = file_get_contents( LU_SITE_DIR . 'assets/js/lu-attrs.js' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
	if ( $js ) {
		wp_print_inline_script_tag( trim( $js ), array( 'id' => 'learn-uk-site-attrs-js' ) );
	}
}
add_action( 'wp_footer', 'lu_site_print_attribute_shim', 1 );

/**
 * The site is written in British English: say so in <html lang> when WordPress is set to US English.
 *
 * @param string $output The language attributes.
 * @return string
 */
function lu_site_language_attributes( $output ) {
	if ( lu_site_is_active_view() ) {
		$output = str_replace( 'lang="en-US"', 'lang="en-GB"', $output );
	}
	return $output;
}
add_filter( 'language_attributes', 'lu_site_language_attributes' );
