/**
 * Draws SVG or HTML into PNGs of any size with Playwright's Chromium (the
 * same browser `pnpm brand:gen` already uses for the web icons). The shared
 * brand renderer only draws square icons; native splash screens and the
 * Play feature graphic are not square.
 */
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";

/** One picture: an HTML document drawn at `width` × `height` CSS pixels (1 px each). */
export interface RasterJob {
	readonly label: string;
	readonly html: string;
	readonly width: number;
	readonly height: number;
}

/** An HTML page showing `svg` stretched over the whole viewport. */
export function svgPage(svg: string, width: number, height: number): string {
	const data = Buffer.from(svg).toString("base64");
	return `<html><body style="margin:0;background:transparent"><img id="art" width="${width}" height="${height}" style="display:block" src="data:image/svg+xml;base64,${data}"></body></html>`;
}

async function draw(page: Page, job: RasterJob): Promise<Buffer> {
	await page.setViewportSize({ width: job.width, height: job.height });
	await page.setContent(job.html);
	// Fonts and every <img> decoded; a broken SVG still "completes" with no
	// pixels, so a zero natural width fails instead of shipping a blank file.
	const broken = await page.evaluate(async () => {
		await document.fonts.ready;
		const images = [...document.images];
		await Promise.all(images.map((img) => img.decode().catch(() => undefined)));
		return images.filter((img) => img.naturalWidth === 0).length;
	});
	if (broken > 0) throw new Error(`${job.label}: an image did not render`);
	return page.screenshot({
		omitBackground: true,
		clip: { x: 0, y: 0, width: job.width, height: job.height },
	});
}

/** Draws every job in one browser, in order; PNGs are RGBA. */
export async function rasterize(jobs: readonly RasterJob[]): Promise<Buffer[]> {
	const browser: Browser = await chromium.launch();
	try {
		const page = await browser.newPage({ deviceScaleFactor: 1 });
		const out: Buffer[] = [];
		for (const job of jobs) out.push(await draw(page, job));
		return out;
	} finally {
		await browser.close();
	}
}
