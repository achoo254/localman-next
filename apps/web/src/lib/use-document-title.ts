import { useEffect } from "react";

/**
 * Sets `document.title` while the page is shown, then restores it, so the
 * browser tab and history name the page instead of the product only.
 */
export function useDocumentTitle(title: string): void {
	useEffect(() => {
		const previous = document.title;
		document.title = title;
		return () => {
			document.title = previous;
		};
	}, [title]);
}

/** Title of an app page: "{page} · Localman". */
export function useAppTitle(page: string): void {
	useDocumentTitle(`${page} · Localman`);
}
