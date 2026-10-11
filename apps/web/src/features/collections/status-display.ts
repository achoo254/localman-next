import type {
	CollectionStatus,
	CollectionStatusPreset,
} from "@localman/shared/api-client";
import type { Translate } from "../../i18n/translate";

/** The emoji each preset shows with. */
export const PRESET_EMOJI: Readonly<Record<CollectionStatusPreset, string>> = {
	stable: "🟢",
	"in-development": "🛠️",
	"in-review": "👀",
	deprecated: "⛔",
};

const PRESET_KEYS = {
	stable: "collections.status.presets.stable",
	"in-development": "collections.status.presets.inDevelopment",
	"in-review": "collections.status.presets.inReview",
	deprecated: "collections.status.presets.deprecated",
} as const satisfies Record<CollectionStatusPreset, string>;

/** Emoji and label of a status, in the language on screen. */
export function statusDisplay(
	status: CollectionStatus,
	t: Translate,
): { emoji: string; label: string } {
	return status.kind === "preset"
		? {
				emoji: PRESET_EMOJI[status.preset],
				label: t(PRESET_KEYS[status.preset]),
			}
		: { emoji: status.emoji, label: status.name };
}

export function presetLabel(
	preset: CollectionStatusPreset,
	t: Translate,
): string {
	return t(PRESET_KEYS[preset]);
}

/** A few emoji to pick from; any single emoji can be typed too. */
export const STATUS_EMOJI_CHOICES = [
	"🟢",
	"🟡",
	"🔴",
	"🔵",
	"🟣",
	"⚪",
	"✅",
	"🚧",
	"🧪",
	"🚀",
	"📦",
	"🔒",
	"⭐",
	"🐛",
	"📝",
	"🔥",
] as const;
