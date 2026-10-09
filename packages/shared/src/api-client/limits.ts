/**
 * Fixed caps of the API client, the same for every plan. Plan quotas (the
 * monthly proxy counter) live in `plan-limits.ts`; these are the technical
 * bounds that the browser, the proxy and the MCP tool must agree on.
 */

const MIB = 1024 * 1024;

/** Request body after variables are filled in, in bytes. */
export const MAX_REQUEST_BODY_BYTES = 10 * MIB;
/** Response body the proxy reads (after decompression) before truncating. */
export const MAX_RESPONSE_BODY_BYTES = 10 * MIB;
/**
 * JSON body of `POST /api/v1/proxy`: a 10 MB binary body grows by a third
 * in base64, plus headers and the envelope itself.
 */
export const MAX_PROXY_ENVELOPE_BYTES = 15 * MIB;

export const DEFAULT_TIMEOUT_MS = 30_000;
export const MIN_TIMEOUT_MS = 1_000;
export const MAX_TIMEOUT_MS = 120_000;
export const MAX_REDIRECTS = 10;

export const MAX_URL_LENGTH = 16 * 1024;
export const MAX_HEADERS = 200;
export const MAX_HEADER_NAME_LENGTH = 256;
export const MAX_HEADER_VALUE_LENGTH = 16 * 1024;
/** Rows of params, url-encoded and form-data tables. */
export const MAX_TABLE_ROWS = 500;
/** Key and value of one table row, as typed (may hold `{{var}}`). */
export const MAX_ROW_KEY_LENGTH = 1024;
export const MAX_ROW_VALUE_LENGTH = 64 * 1024;
export const MAX_REQUEST_NAME_LENGTH = 200;

/** Pre-request and post-response scripts. */
export const MAX_SCRIPT_LENGTH = 64 * 1024;
export const SCRIPT_TIMEOUT_MS = 5_000;
export const SCRIPT_MEMORY_BYTES = 32 * MIB;
export const SCRIPT_MAX_STACK_BYTES = 512 * 1024;

/** History kept per user (`client_history`). */
export const HISTORY_MAX_ENTRIES = 500;
export const HISTORY_TTL_DAYS = 90;
/** Open tabs with an unsaved draft per user (`client_drafts`). */
export const DRAFT_MAX_TABS = 50;
