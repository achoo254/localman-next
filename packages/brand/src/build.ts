/**
 * Copied from chat-next/packages/brand @a5be0b4; keep in sync until shared
 * package exists.
 *
 * Build-time entry (Node only): validates brand.config.json against its
 * schema and derives the platform manifests and icons from it.
 */
export { REPO_ROOT, loadBrandConfig, parseBrandConfig } from "./config.js";
export { type GeneratedManifests, generateManifests } from "./generate.js";
export {
	FAVICON_ICO,
	FAVICON_SVG,
	GENERATED_ICONS_DIR,
	RASTER_ICONS,
	type RasterIcon,
	type WebIconFile,
	iconSourceHashes,
	manifestIcons,
	webIconFiles,
} from "./icons.js";
export { type IcoImage, encodeIco } from "./ico.js";
