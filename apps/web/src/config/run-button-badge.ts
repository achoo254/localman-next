/**
 * The "Run in Localman" badge READMEs embed (`/run-button.svg`). It lives
 * in `@localman/design-tokens`, the one place colour literals are allowed,
 * and is served from the web root: emitted into every build (`pnpm build`
 * and the e2e stack's `vite build`) and served by the dev server.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

export const RUN_BUTTON_BADGE = "run-button.svg";

const SOURCE = fileURLToPath(
	new URL("../../../../packages/design-tokens/run-button.svg", import.meta.url),
);

export function runButtonBadge(): Plugin {
	return {
		name: "localman:run-button-badge",
		configureServer(server) {
			server.middlewares.use(`/${RUN_BUTTON_BADGE}`, (_req, res, next) => {
				readFile(SOURCE)
					.then((svg) => {
						res.setHeader("Content-Type", "image/svg+xml");
						res.end(svg);
					})
					.catch(next);
			});
		},
		async generateBundle() {
			this.emitFile({
				type: "asset",
				fileName: RUN_BUTTON_BADGE,
				source: await readFile(SOURCE),
			});
		},
	};
}
