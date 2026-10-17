<?php
/**
 * "Finish Learn UK setup": pretty permalinks, static front page, photo alt text.
 *
 * Runs on activation and from a dismissible admin notice.
 *
 * @package Learn_UK_Site
 */

defined( 'ABSPATH' ) || exit;

/**
 * Run the setup steps.
 *
 * @return array{done: bool, steps: string[]} Whether everything is set up, and what happened.
 */
function lu_site_run_setup() {
	global $wp_rewrite;
	$steps = array();

	if ( '/%postname%/' !== get_option( 'permalink_structure' ) ) {
		$wp_rewrite->set_permalink_structure( '/%postname%/' );
		$steps[] = __( 'Permalinks set to "Post name" (/%postname%/).', 'learn-uk-site' );
	} else {
		$steps[] = __( 'Permalinks already use "Post name".', 'learn-uk-site' );
	}
	flush_rewrite_rules();

	$home = get_page_by_path( 'home', OBJECT, 'page' );
	$done = $home && 'publish' === $home->post_status;
	if ( ! $done ) {
		$steps[] = __( 'Front page not set: there is no published page with the slug "home" yet. Import the Learn UK kit first, then run setup again.', 'learn-uk-site' );
	} elseif ( 'page' !== get_option( 'show_on_front' ) || (int) get_option( 'page_on_front' ) !== $home->ID ) {
		update_option( 'show_on_front', 'page' );
		update_option( 'page_on_front', $home->ID );
		$steps[] = __( 'Front page set to the "home" page (Settings > Reading).', 'learn-uk-site' );
	} else {
		$steps[] = __( 'Front page already shows the "home" page.', 'learn-uk-site' );
	}

	// The plugin serves Urbanist and Inter itself; Elementor must not load them from Google (the cookie policy says no third parties).
	if ( '0' !== get_option( 'elementor_google_font' ) ) {
		update_option( 'elementor_google_font', '0' );
		$steps[] = __( 'Elementor Google Fonts turned off (the plugin serves the fonts).', 'learn-uk-site' );
	}

	$count = lu_site_fill_all_alts();
	/* translators: %d: number of images. */
	$steps[] = sprintf( _n( 'Alt text added to %d image.', 'Alt text added to %d images.', $count, 'learn-uk-site' ), $count );

	update_option( 'lu_site_setup_done', $done ? 1 : 0 );
	return array(
		'done'  => $done,
		'steps' => $steps,
	);
}

/**
 * Activation: run setup and keep the result to show in the notice.
 */
function lu_site_activate() {
	set_transient( 'lu_site_setup_result', lu_site_run_setup(), HOUR_IN_SECONDS );
}

/**
 * Handle the notice's "Finish Learn UK setup" button.
 */
function lu_site_handle_setup() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'You are not allowed to do this.', 'learn-uk-site' ), 403 );
	}
	check_admin_referer( 'lu_site_setup' );
	set_transient( 'lu_site_setup_result', lu_site_run_setup(), HOUR_IN_SECONDS );
	wp_safe_redirect( wp_get_referer() ? wp_get_referer() : admin_url() );
	exit;
}
add_action( 'admin_post_lu_site_setup', 'lu_site_handle_setup' );

/**
 * Handle the notice's dismiss link.
 */
function lu_site_handle_dismiss() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'You are not allowed to do this.', 'learn-uk-site' ), 403 );
	}
	check_admin_referer( 'lu_site_dismiss' );
	update_option( 'lu_site_setup_dismissed', 1 );
	delete_transient( 'lu_site_setup_result' );
	wp_safe_redirect( wp_get_referer() ? wp_get_referer() : admin_url() );
	exit;
}
add_action( 'admin_post_lu_site_dismiss', 'lu_site_handle_dismiss' );

/**
 * Show the setup notice: the last result, and the button while setup is unfinished.
 */
function lu_site_setup_notice() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$result    = get_transient( 'lu_site_setup_result' );
	$done      = (bool) get_option( 'lu_site_setup_done' );
	$dismissed = (bool) get_option( 'lu_site_setup_dismissed' );
	if ( ! $result && ( $done || $dismissed ) ) {
		return;
	}
	if ( $result ) {
		delete_transient( 'lu_site_setup_result' );
	}
	$has_home = (bool) get_page_by_path( 'home', OBJECT, 'page' );
	$class    = $done ? 'notice-success' : 'notice-info';

	echo '<div class="notice ' . esc_attr( $class ) . '"><p><strong>' . esc_html__( 'Learn UK Site', 'learn-uk-site' ) . '</strong></p>';

	if ( $result ) {
		echo '<ul style="list-style:disc;padding-left:1.5em">';
		foreach ( $result['steps'] as $step ) {
			echo '<li>' . esc_html( $step ) . '</li>';
		}
		echo '</ul>';
	}

	if ( ! $done ) {
		echo '<p>' . ( $has_home
			? esc_html__( 'Finish setup to use pretty permalinks, show the "home" page as the front page and add alt text to the Learn UK photos.', 'learn-uk-site' )
			: esc_html__( 'Import the Learn UK Elementor kit first (Elementor > Tools > Import / Export Kit), then finish setup here.', 'learn-uk-site' ) ) . '</p>';
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" style="display:inline-block;margin:0 1em .5em 0">';
		echo '<input type="hidden" name="action" value="lu_site_setup">';
		wp_nonce_field( 'lu_site_setup' );
		submit_button( __( 'Finish Learn UK setup', 'learn-uk-site' ), 'primary', 'submit', false );
		echo '</form>';
		$dismiss = wp_nonce_url( admin_url( 'admin-post.php?action=lu_site_dismiss' ), 'lu_site_dismiss' );
		echo '<a href="' . esc_url( $dismiss ) . '">' . esc_html__( 'Dismiss', 'learn-uk-site' ) . '</a>';
	}

	if ( 'Learn UK' !== get_option( 'blogname' ) ) {
		echo '<p>' . sprintf(
			/* translators: 1: current site title, 2: link to Settings > General. */
			esc_html__( 'The site title is "%1$s". You may want to change it to "Learn UK" in %2$s.', 'learn-uk-site' ),
			esc_html( get_option( 'blogname' ) ),
			'<a href="' . esc_url( admin_url( 'options-general.php' ) ) . '">' . esc_html__( 'Settings > General', 'learn-uk-site' ) . '</a>'
		) . '</p>';
	}
	echo '</div>';
}
add_action( 'admin_notices', 'lu_site_setup_notice' );
