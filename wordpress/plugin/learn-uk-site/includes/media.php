<?php
/**
 * Alt text for the photos that Elementor sideloads into the Media Library on kit import.
 *
 * @package Learn_UK_Site
 */

defined( 'ABSPATH' ) || exit;

/**
 * Look up an attachment in a map keyed by Learn UK image base name.
 *
 * "uni-city-1-1536-1.webp" is tried as uni-city-1-1536-1, uni-city-1-1536, uni-city-1 ...
 * so names that end in a number themselves still match.
 *
 * @param int   $attachment_id Attachment ID.
 * @param array $map           Base name => value.
 * @return mixed|null The value, or null when the file is not a known Learn UK image.
 */
function lu_site_image_lookup( $attachment_id, array $map ) {
	$file = get_attached_file( $attachment_id, true );
	if ( ! $file ) {
		return null;
	}
	$name = preg_replace( '/-scaled$/', '', pathinfo( $file, PATHINFO_FILENAME ) );
	while ( '' !== $name ) {
		if ( isset( $map[ $name ] ) ) {
			return $map[ $name ];
		}
		$shorter = preg_replace( '/-\d+$/', '', $name );
		if ( $shorter === $name ) {
			break;
		}
		$name = $shorter;
	}
	return null;
}

/**
 * Alt text for an attachment, looked up by its file's base name. Empty string = decorative.
 *
 * @param int $attachment_id Attachment ID.
 * @return string|null Alt text, '' for a decorative image, null when unknown.
 */
function lu_site_alt_for_attachment( $attachment_id ) {
	static $alts = null;
	if ( null === $alts ) {
		$alts = include LU_SITE_DIR . 'includes/alt-text.php';
	}
	return lu_site_image_lookup( $attachment_id, $alts );
}

/**
 * Give Learn UK photos the same `sizes` and loading priority as on the static site, so browsers
 * download an image the width of its slot rather than WordPress's default "100vw up to full size".
 *
 * @param array    $attr       Image attributes.
 * @param \WP_Post $attachment Attachment.
 * @return array
 */
function lu_site_image_attributes( $attr, $attachment ) {
	static $hints = null;
	if ( null === $hints ) {
		$hints = include LU_SITE_DIR . 'includes/image-hints.php';
	}
	$hint = lu_site_image_lookup( $attachment->ID, $hints );
	if ( ! $hint ) {
		return $attr;
	}
	if ( isset( $attr['srcset'] ) ) {
		$attr['sizes'] = $hint['sizes'];
	}
	if ( $hint['eager'] ) {
		unset( $attr['loading'] );
		$attr['fetchpriority'] = 'high';
	} else {
		$attr['loading'] = 'lazy';
		unset( $attr['fetchpriority'] );
	}
	return $attr;
}
add_filter( 'wp_get_attachment_image_attributes', 'lu_site_image_attributes', 20, 2 );

/**
 * Set the alt text of one attachment if it has none and its file is a known Learn UK image.
 *
 * @param int $attachment_id Attachment ID.
 * @return bool Whether alt text was set.
 */
function lu_site_fill_alt( $attachment_id ) {
	$attachment_id = (int) $attachment_id;
	if ( ! $attachment_id || '' !== (string) get_post_meta( $attachment_id, '_wp_attachment_image_alt', true ) ) {
		return false;
	}
	$alt = lu_site_alt_for_attachment( $attachment_id );
	if ( ! $alt ) {
		return false;
	}
	return (bool) update_post_meta( $attachment_id, '_wp_attachment_image_alt', $alt );
}

/**
 * Elementor kit / template import: fill alt text for each new attachment.
 *
 * @param int $attachment_id New attachment ID.
 * @return int
 */
function lu_site_on_import_attachment( $attachment_id ) {
	if ( is_numeric( $attachment_id ) ) {
		lu_site_fill_alt( $attachment_id );
	}
	return $attachment_id;
}
add_filter( 'elementor/template_library/import_images/new_attachment', 'lu_site_on_import_attachment' );

/**
 * Fill alt text across all image attachments.
 *
 * @return int Number of attachments updated.
 */
function lu_site_fill_all_alts() {
	$ids     = get_posts(
		array(
			'post_type'      => 'attachment',
			'post_mime_type' => 'image',
			'post_status'    => 'inherit',
			'posts_per_page' => -1,
			'fields'         => 'ids',
		)
	);
	$updated = 0;
	foreach ( $ids as $id ) {
		$updated += lu_site_fill_alt( $id ) ? 1 : 0;
	}
	return $updated;
}
