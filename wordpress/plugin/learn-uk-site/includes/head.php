<?php
/**
 * <head> output: runtime config, font preload, favicon, title, description, Open Graph and JSON-LD.
 *
 * @package Learn_UK_Site
 */

defined( 'ABSPATH' ) || exit;

/**
 * Whether an SEO plugin is active (it then owns the title, description and structured data).
 *
 * @return bool
 */
function lu_site_has_seo_plugin() {
	return defined( 'WPSEO_VERSION' )
		|| defined( 'RANK_MATH_VERSION' )
		|| defined( 'AIOSEO_VERSION' )
		|| function_exists( 'aioseo' )
		|| defined( 'SEOPRESS_VERSION' );
}

/**
 * Head metadata for the current page, or null if it is not one of the Learn UK pages.
 *
 * @return array|null
 */
function lu_site_current_seo() {
	static $pages = null;
	if ( ! is_singular( 'page' ) ) {
		return null;
	}
	if ( null === $pages ) {
		$pages = include LU_SITE_DIR . 'includes/seo.php';
	}
	$post = get_queried_object();
	return ( $post instanceof WP_Post && isset( $pages[ $post->post_name ] ) ) ? $pages[ $post->post_name ] : null;
}

/**
 * Print config, the `js` class switch, font preload, favicon and theme colour.
 */
function lu_site_print_head() {
	if ( ! lu_site_is_active_view() ) {
		return;
	}
	$assets = lu_site_assets_url();
	$config = array(
		'home'   => lu_site_home_url(),
		'assets' => $assets,
		'ver'    => lu_site_asset_version( 'js/main.js' ),
	);
	wp_print_inline_script_tag( 'window.LU=' . wp_json_encode( $config, JSON_UNESCAPED_SLASHES ) . ';' );

	if ( ! lu_site_is_preview() ) {
		// Same as the static site: <html class="js">, and show content anyway if main.js never runs.
		wp_print_inline_script_tag( "document.documentElement.classList.add('js');setTimeout(function(){if(!window.__lukReady)document.documentElement.classList.add('js-failed')},2500);" );
	}

	echo '<meta name="theme-color" content="#0B1640">' . "\n";
	printf( '<link rel="preload" href="%s" as="font" type="font/woff2" crossorigin>' . "\n", esc_url( $assets . 'fonts/urbanist-latin-wght.woff2' ) );

	$post = get_queried_object();
	if ( is_front_page() || ( $post instanceof WP_Post && 'home' === $post->post_name ) ) {
		$sizes  = array( 480, 720, 960, 1280 );
		$srcset = array();
		foreach ( $sizes as $w ) {
			$srcset[] = $assets . 'img/globe-' . $w . '.avif ' . $w . 'w';
		}
		printf(
			'<link rel="preload" as="image" href="%s" imagesrcset="%s" imagesizes="(min-width: 64em) 44rem, (min-width: 48em) 28rem, 22rem" type="image/avif" fetchpriority="high">' . "\n",
			esc_url( $assets . 'img/globe-720.avif' ),
			esc_attr( implode( ', ', $srcset ) )
		);
	}

	if ( ! has_site_icon() ) {
		printf( '<link rel="icon" href="%s" type="image/svg+xml">' . "\n", esc_url( $assets . 'img/learn-uk-favicon.svg' ) );
	}
}
add_action( 'wp_head', 'lu_site_print_head', 1 );

/**
 * Block themes without title-tag support print a <title> from wp_head, and Elementor Canvas
 * prints its own for such themes too. Keep only Canvas's one on Learn UK pages.
 */
function lu_site_dedupe_title() {
	if ( lu_site_is_active_view() && ! current_theme_supports( 'title-tag' ) && is_page_template( 'elementor_canvas' ) ) {
		remove_action( 'wp_head', '_block_template_render_title_tag', 1 );
	}
}
add_action( 'wp_head', 'lu_site_dedupe_title', 0 );

/**
 * Print the description, Open Graph tags and JSON-LD when no SEO plugin is active.
 */
function lu_site_print_seo() {
	$seo = lu_site_current_seo();
	if ( ! $seo || lu_site_has_seo_plugin() ) {
		return;
	}
	if ( '' !== $seo['description'] ) {
		printf( '<meta name="description" content="%s">' . "\n", esc_attr( $seo['description'] ) );
	}
	foreach ( $seo['og'] as $property => $content ) {
		printf( '<meta property="%s" content="%s">' . "\n", esc_attr( $property ), esc_attr( $content ) );
	}
	foreach ( $seo['jsonld'] as $json ) {
		// Generated JSON; only placeholder URLs are swapped. Keep "</" out of the script element.
		$json = str_replace( '</', '<\/', lu_site_replace_placeholders( $json ) );
		echo '<script type="application/ld+json">' . $json . "</script>\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}
}
add_action( 'wp_head', 'lu_site_print_seo', 2 );

/**
 * Use the static site's page titles when no SEO plugin is active.
 *
 * @param string $title Title so far (empty unless another filter set it).
 * @return string
 */
function lu_site_document_title( $title ) {
	$seo = lu_site_current_seo();
	if ( $seo && '' !== $seo['title'] && ! lu_site_has_seo_plugin() ) {
		return $seo['title'];
	}
	return $title;
}
add_filter( 'pre_get_document_title', 'lu_site_document_title' );
