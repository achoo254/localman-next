/**
 * SVG building blocks of the native app icons and splash screens, derived
 * from the brand SVGs (brand.config.json `icon` / `iconMaskable`).
 *
 * The maskable SVG follows one convention so the Android adaptive icon can
 * be split into its two layers without a designer exporting them: its
 * first drawing element is a full-canvas `<rect>` (the background layer);
 * everything after it is the artwork (the foreground layer). `<defs>` stay
 * with both layers, so gradients keep working. A redrawn icon that breaks
 * the convention fails here instead of producing a wrong launcher icon.
 */

/** A brand SVG cut into what the native files need. */
export interface ParsedSvg {
	/** Width and height of the square viewBox. */
	readonly size: number;
	/** `<defs>…</defs>` blocks, or "". */
	readonly defs: string;
	/** Drawing markup inside `<svg>`, without the defs. */
	readonly body: string;
}

const SVG_NS = 'xmlns="http://www.w3.org/2000/svg"';

export function parseSquareSvg(svg: string, label: string): ParsedSvg {
	const open = /<svg\b[^>]*>/.exec(svg);
	const close = svg.lastIndexOf("</svg>");
	if (!open || close < 0) throw new Error(`${label}: not an <svg> document`);
	const viewBox = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(open[0]);
	if (!viewBox || viewBox[1] !== viewBox[2]) {
		throw new Error(`${label}: needs a square viewBox="0 0 S S"`);
	}
	const inner = svg
		.slice(open.index + open[0].length, close)
		.replace(/<!--[\s\S]*?-->/g, "");
	const defs = (inner.match(/<defs\b[\s\S]*?<\/defs>/g) ?? []).join("");
	const body = inner.replace(/<defs\b[\s\S]*?<\/defs>/g, "").trim();
	return { size: Number(viewBox[1]), defs, body };
}

/** The maskable icon's two adaptive layers (see the convention above). */
export function splitMaskable(
	svg: string,
	label: string,
): { background: string; foreground: string } {
	const parsed = parseSquareSvg(svg, label);
	const first = /^<rect\b[^>]*\/>/.exec(parsed.body);
	if (!first) {
		throw new Error(
			`${label}: the first element must be a self-closing full-canvas <rect> (the background layer)`,
		);
	}
	const rect = first[0];
	const full = String(parsed.size);
	const attr = (name: string) =>
		new RegExp(`\\s${name}="([^"]*)"`).exec(rect)?.[1];
	const offset = (name: string) => Number(attr(name) ?? "0") !== 0;
	if (
		attr("width") !== full ||
		attr("height") !== full ||
		offset("x") ||
		offset("y")
	) {
		throw new Error(`${label}: the background <rect> must cover the canvas`);
	}
	const art = parsed.body.slice(rect.length).trim();
	if (art === "") throw new Error(`${label}: no artwork after the background`);
	return {
		background: squareSvg(parsed.size, parsed.defs + rect),
		foreground: squareSvg(parsed.size, parsed.defs + art),
	};
}

export function squareSvg(size: number, markup: string): string {
	return `<svg ${SVG_NS} width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${markup}</svg>`;
}

/** `svg` as an <image> at (x, y), `size` wide (it is square). */
export function placed(
	svg: string,
	x: number,
	y: number,
	size: number,
): string {
	const data = Buffer.from(svg).toString("base64");
	return `<image x="${x}" y="${y}" width="${size}" height="${size}" href="data:image/svg+xml;base64,${data}"/>`;
}

/** A `width` × `height` canvas, filled with `background` when given, holding `markup`. */
export function canvasSvg(
	width: number,
	height: number,
	markup: string,
	background?: string,
): string {
	const fill =
		background === undefined
			? ""
			: `<rect width="${width}" height="${height}" fill="${background}"/>`;
	return `<svg ${SVG_NS} width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${fill}${markup}</svg>`;
}

/** `svg` centred on a canvas, its side `share` of the canvas's shorter side. */
export function centred(
	svg: string,
	width: number,
	height: number,
	share: number,
	background?: string,
): string {
	const side = Math.round(Math.min(width, height) * share);
	const x = Math.round((width - side) / 2);
	const y = Math.round((height - side) / 2);
	return canvasSvg(width, height, placed(svg, x, y, side), background);
}

/** Every visible pixel of `svg` white, alpha kept: Android 13 themed (monochrome) icon. */
export function monochrome(svg: string, size: number): string {
	return squareSvg(
		size,
		`<defs><filter id="mono"><feFlood flood-color="white"/><feComposite in2="SourceAlpha" operator="in"/></filter></defs><g filter="url(#mono)">${placed(svg, 0, 0, size)}</g>`,
	);
}

/** `svg` clipped to the inscribed circle: the legacy round launcher icon. */
export function roundClipped(svg: string, size: number): string {
	const r = size / 2;
	return squareSvg(
		size,
		`<defs><clipPath id="round"><circle cx="${r}" cy="${r}" r="${r}"/></clipPath></defs><g clip-path="url(#round)">${placed(svg, 0, 0, size)}</g>`,
	);
}
