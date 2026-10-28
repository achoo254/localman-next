/**
 * Puts the shared theme script of @achoo254/app-shell
 * (`THEME_BOOTSTRAP_SCRIPT`) inline in the <head> of index.html, in place
 * of its marker and before the stylesheet, so `data-theme` is set before
 * the first paint. The prerendered pages are built from that file, so they
 * carry it too; deploy.sh allows it in the CSP by the hash of the built
 * HTML (infra/localman/csp-hashes.mjs).
 */
import type { Plugin } from "vite";
import { THEME_BOOTSTRAP_SCRIPT } from "../lib/shared-preferences";

/** Placeholder in index.html for the inline theme script. */
export const THEME_BOOTSTRAP_MARKER = "<!--theme-bootstrap-->";

/** `html` with the marker replaced by the script; throws without exactly one marker. */
export function injectThemeBootstrap(html: string): string {
	const parts = html.split(THEME_BOOTSTRAP_MARKER);
	if (parts.length !== 2) {
		throw new Error(
			`index.html needs exactly one ${THEME_BOOTSTRAP_MARKER}, found ${parts.length - 1}`,
		);
	}
	return parts.join(`<script>${THEME_BOOTSTRAP_SCRIPT}</script>`);
}

export function themeBootstrap(): Plugin {
	return {
		name: "localman:theme-bootstrap",
		transformIndexHtml: {
			order: "pre",
			handler: injectThemeBootstrap,
		},
	};
}
