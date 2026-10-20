/**
 * Copied from chat-next/packages/brand @a5be0b4; keep in sync until shared
 * package exists.
 *
 * Runtime entry, safe in the browser and in the bundled API: the brand
 * values. Diverges from chat-next: hosts helpers (hostsFor, allowedOrigins)
 * and the devOrigins config field are omitted until a caller exists.
 * Build-time tooling (schema validation, manifest and icon generation) is
 * `@localman/brand/build`.
 */
export type { BrandConfig } from "./brand-config.js";
export { brand } from "./brand.js";
