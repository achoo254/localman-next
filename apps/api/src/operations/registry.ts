import type { AnyOperation } from "@localman/operations";

/**
 * Every dashboard API operation. REST routes, MCP tools and the OpenAPI
 * document are generated from this list; business routes must be declared
 * here with `defineOperation`, never as hand-written Express routes.
 */
export const operations: readonly AnyOperation[] = [];
