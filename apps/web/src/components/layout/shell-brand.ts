import type { ShellBrand } from "@achoo254/app-shell";
import { brand } from "@localman/shared/brand";
import { PREFERENCE_DOMAIN } from "../../lib/shared-preferences";
import { MARK_URL } from "../brand/wordmark";

/** What the shared shell (@achoo254/app-shell) shows of Localman: name, root domain, AI mark. */
export const SHELL_BRAND: ShellBrand = {
	appName: brand.appName,
	domain: PREFERENCE_DOMAIN,
	markSrc: MARK_URL,
};
