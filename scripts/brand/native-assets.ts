/**
 * What `pnpm brand:gen` writes into the Capacitor projects (apps/mobile/ios,
 * apps/mobile/android) and the Play listing art (docs/store/play): every
 * picture is drawn from the brand SVGs and colours, so a designed icon
 * replaces them all by swapping the SVGs and re-running the generator.
 * `cap sync` copies only the web build and plugins, never these resources.
 */
import {
	centred,
	monochrome,
	roundClipped,
	splitMaskable,
} from "./icon-svg.js";
import { featureGraphicHtml } from "./play-feature-graphic.js";

export const IOS_ASSETS = "apps/mobile/ios/App/App/Assets.xcassets/";
export const ANDROID_RES = "apps/mobile/android/app/src/main/res/";
export const PLAY_DIR = "docs/store/play/";

/** Android density buckets: scale against mdpi (1 px per dp). */
export const DENSITIES = [
	{ name: "mdpi", scale: 1 },
	{ name: "hdpi", scale: 1.5 },
	{ name: "xhdpi", scale: 2 },
	{ name: "xxhdpi", scale: 3 },
	{ name: "xxxhdpi", scale: 4 },
] as const;

/** Legacy launcher icon (Android 7.x and older): 48 dp. */
const LEGACY_DP = 48;
/** Adaptive icon layer: 108 dp, of which the launcher shows the middle 72 dp. */
const LAYER_DP = 108;
const VISIBLE_SHARE = 72 / LAYER_DP;
/** Pre-Android-12 splash bitmaps (portrait, at mdpi); landscape swaps them. */
const SPLASH_PORTRAIT_DP = { width: 320, height: 480 } as const;
/** Brand icon on a splash: share of the shorter side. */
const SPLASH_ICON_SHARE = 0.28;
/** iOS fills the screen with the 2732 px square ("aspect fill"), showing ~0.46 of its width on an iPhone: a smaller icon looks the same as on Android. */
const IOS_SPLASH = 2732;
const IOS_SPLASH_ICON_SHARE = 0.125;
export const IOS_ICON = 1024;

export interface NativeBrand {
	readonly appName: string;
	/** Content of the brand.config.json `icon` SVG (rounded corners). */
	readonly iconSvg: string;
	/** Content of the `iconMaskable` SVG (full bleed). */
	readonly maskableSvg: string;
	readonly colors: {
		readonly primary: string;
		readonly background: string;
		readonly backgroundDark: string;
	};
}

/** A picture to draw: SVG, or a full HTML page (the feature graphic's text). */
export interface PictureAsset {
	readonly path: string;
	readonly width: number;
	readonly height: number;
	readonly svg?: string;
	readonly html?: string;
	/** No alpha channel (App Store icon, splash, Play art). */
	readonly opaque: boolean;
}

function splashes(brand: NativeBrand): PictureAsset[] {
	const out: PictureAsset[] = [];
	const themes = [
		{ dir: "drawable", colour: brand.colors.background },
		{ dir: "drawable-night", colour: brand.colors.backgroundDark },
	];
	const picture = (path: string, w: number, h: number, colour: string) => ({
		path,
		width: w,
		height: h,
		svg: centred(brand.iconSvg, w, h, SPLASH_ICON_SHARE, colour),
		opaque: true,
	});
	for (const { dir, colour } of themes) {
		// Android picks the nearest density; drawable/ is the fallback (landscape mdpi).
		const { width, height } = SPLASH_PORTRAIT_DP;
		out.push(picture(`${ANDROID_RES}${dir}/splash.png`, height, width, colour));
		const night = dir.endsWith("-night") ? "-night" : "";
		for (const { name, scale } of DENSITIES) {
			const w = Math.round(width * scale);
			const h = Math.round(height * scale);
			out.push(
				picture(
					`${ANDROID_RES}drawable-port${night}-${name}/splash.png`,
					w,
					h,
					colour,
				),
				picture(
					`${ANDROID_RES}drawable-land${night}-${name}/splash.png`,
					h,
					w,
					colour,
				),
			);
		}
	}
	for (const [file, colour] of [
		["splash-2732x2732.png", brand.colors.background],
		["splash-2732x2732-dark.png", brand.colors.backgroundDark],
	] as const) {
		out.push({
			path: `${IOS_ASSETS}Splash.imageset/${file}`,
			width: IOS_SPLASH,
			height: IOS_SPLASH,
			svg: centred(
				brand.iconSvg,
				IOS_SPLASH,
				IOS_SPLASH,
				IOS_SPLASH_ICON_SHARE,
				colour,
			),
			opaque: true,
		});
	}
	return out;
}

/** Launcher icons: legacy squares and circles, and the three adaptive layers. */
function launcherIcons(brand: NativeBrand): PictureAsset[] {
	const layers = splitMaskable(brand.maskableSvg, "iconMaskable");
	const out: PictureAsset[] = [];
	for (const { name, scale } of DENSITIES) {
		const dir = `${ANDROID_RES}mipmap-${name}/`;
		const legacy = Math.round(LEGACY_DP * scale);
		const layer = Math.round(LAYER_DP * scale);
		const square = (file: string, size: number, svg: string) => ({
			path: dir + file,
			width: size,
			height: size,
			svg,
			opaque: false,
		});
		out.push(
			square("ic_launcher.png", legacy, brand.iconSvg),
			square(
				"ic_launcher_round.png",
				legacy,
				roundClipped(brand.maskableSvg, legacy),
			),
			square("ic_launcher_background.png", layer, layers.background),
			square(
				"ic_launcher_foreground.png",
				layer,
				centred(layers.foreground, layer, layer, VISIBLE_SHARE),
			),
			square(
				"ic_launcher_monochrome.png",
				layer,
				centred(
					monochrome(layers.foreground, layer),
					layer,
					layer,
					VISIBLE_SHARE,
				),
			),
		);
	}
	return out;
}

export function nativePictures(
	brand: NativeBrand,
	fontWoff2: Buffer,
): PictureAsset[] {
	return [
		{
			// iOS rounds the corners itself: the full-bleed maskable icon, no alpha.
			path: `${IOS_ASSETS}AppIcon.appiconset/AppIcon-512@2x.png`,
			width: IOS_ICON,
			height: IOS_ICON,
			svg: brand.maskableSvg,
			opaque: true,
		},
		...launcherIcons(brand),
		...splashes(brand),
		{
			path: `${PLAY_DIR}icon-512.png`,
			width: 512,
			height: 512,
			svg: brand.maskableSvg,
			opaque: true,
		},
		{
			path: `${PLAY_DIR}feature-graphic.png`,
			width: 1024,
			height: 500,
			html: featureGraphicHtml(brand, fontWoff2),
			opaque: true,
		},
	];
}
