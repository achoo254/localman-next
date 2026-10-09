/**
 * `@localman/shared/api-client`: pure logic of the API client shared by the
 * web app (direct sends, router, UI) and the API (proxy, MCP `send_request`).
 * No DOM and no Node-only API. Only `request-schema.ts` and
 * `proxy-envelope.ts` import zod; the web bundle drops them when unused.
 */
export * from "./auth-headers.js";
export * from "./byte-encoding.js";
export * from "./dynamic-variables.js";
export * from "./extract-variables.js";
export * from "./header-rules.js";
export * from "./limits.js";
export * from "./local-host.js";
export * from "./multipart-encoder.js";
export * from "./prepare-body.js";
export * from "./prepare-error.js";
export * from "./proxy-envelope.js";
export * from "./request-model.js";
export * from "./request-preparer.js";
export * from "./request-schema.js";
export * from "./response-model.js";
export * from "./tunnel-url.js";
export * from "./url-params.js";
export * from "./variable-interpolation.js";
