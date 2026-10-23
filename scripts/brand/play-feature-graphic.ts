/**
 * The Play listing's feature graphic (1024 × 500, required to publish):
 * the brand icon and the app name in the web app's Inter Bold on the dark
 * brand background. Drawn by `pnpm brand:gen` into docs/store/play/.
 */
import type { NativeBrand } from "./native-assets.js";

/** 1024 × 500 Play feature graphic: the icon and the app name on the dark brand background. */
export function featureGraphicHtml(
	brand: NativeBrand,
	fontWoff2: Buffer,
): string {
	const font = `@font-face{font-family:Brand;font-weight:700;src:url(data:font/woff2;base64,${fontWoff2.toString("base64")}) format("woff2")}`;
	const icon = Buffer.from(brand.iconSvg).toString("base64");
	const name = brand.appName.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
	return `<html><head><style>${font}
html,body{margin:0;width:1024px;height:500px;background:${brand.colors.backgroundDark}}
.f{display:flex;align-items:center;justify-content:center;gap:56px;width:1024px;height:500px;
background:radial-gradient(circle at 30% 50%, ${brand.colors.primary}66, transparent 62%)}
img{width:224px;height:224px}
span{font:700 120px Brand, Inter, system-ui, sans-serif;color:white;letter-spacing:-3px}
</style></head><body><div class="f"><img src="data:image/svg+xml;base64,${icon}"><span>${name}</span></div></body></html>`;
}
