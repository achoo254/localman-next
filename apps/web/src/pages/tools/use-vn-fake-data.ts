import {
	VN_FAKE_DATA_MAX_COUNT,
	VN_FAKE_DATA_MIN_COUNT,
	type VnFakeDataLocale,
	type VnFakeDataType,
	type VnFakeRecord,
	generateVnFakeData,
} from "@localman/shared/vn-fake-data";
import { useMemo, useState } from "react";

/**
 * The first list: a fixed seed and "today", so the prerendered page and
 * the browser hydrating it render the same rows. "Generate new data"
 * switches to a random seed and the real date.
 */
const SAMPLE_RUN = {
	seed: 20_261_024,
	refDate: new Date("2026-01-01T00:00:00Z"),
};

const DEFAULT_COUNT = 10;

function randomSeed(): number {
	return globalThis.crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

/** The count typed, or null when it is not a whole number in range. */
function parseCount(text: string): number | null {
	if (!/^\d+$/.test(text.trim())) return null;
	const count = Number(text);
	return count >= VN_FAKE_DATA_MIN_COUNT && count <= VN_FAKE_DATA_MAX_COUNT
		? count
		: null;
}

export interface VnFakeDataState {
	readonly type: VnFakeDataType;
	readonly setType: (type: VnFakeDataType) => void;
	readonly locale: VnFakeDataLocale;
	readonly setLocale: (locale: VnFakeDataLocale) => void;
	/** What the count field shows, valid or not. */
	readonly countText: string;
	readonly setCountText: (text: string) => void;
	readonly countValid: boolean;
	/** Built from the last valid count while the field holds a bad one. */
	readonly records: readonly VnFakeRecord[];
	readonly regenerate: () => void;
}

/**
 * Choices of the fake data tool and the records they give, built in the
 * browser by the shared generators (nothing goes to the server). Changing
 * the type, count or language keeps the seed; `regenerate` draws a new one.
 */
export function useVnFakeData(): VnFakeDataState {
	const [type, setType] = useState<VnFakeDataType>("person");
	const [locale, setLocale] = useState<VnFakeDataLocale>("vi");
	const [countText, setCountTextState] = useState(String(DEFAULT_COUNT));
	const [count, setCount] = useState(DEFAULT_COUNT);
	const [run, setRun] = useState(SAMPLE_RUN);

	const records = useMemo(
		() => generateVnFakeData({ type, count, locale, ...run }),
		[type, count, locale, run],
	);

	const setCountText = (text: string) => {
		setCountTextState(text);
		const parsed = parseCount(text);
		if (parsed !== null) setCount(parsed);
	};

	return {
		type,
		setType,
		locale,
		setLocale,
		countText,
		setCountText,
		countValid: parseCount(countText) !== null,
		records,
		regenerate: () => setRun({ seed: randomSeed(), refDate: new Date() }),
	};
}
