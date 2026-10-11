/**
 * Line diff of two texts (pure), for the changelog: the lines both start
 * and end with are kept aside, then the longest common subsequence of the
 * rest, removed lines before added ones at each change. Past `MAX_CELLS`
 * comparisons the rest falls back to "all removed, then all added", which
 * stays correct, only less precise.
 */

export type DiffLine =
	| { kind: "same"; text: string }
	| { kind: "removed"; text: string }
	| { kind: "added"; text: string };

const MAX_CELLS = 4_000_000;

/** Pretty JSON lines of a value; no lines when it did not exist. */
export function jsonLines(value: unknown): string[] {
	if (value === null || value === undefined) return [];
	return JSON.stringify(value, null, 2).split("\n");
}

const same = (text: string): DiffLine => ({ kind: "same", text });

export function diffLines(
	before: readonly string[],
	after: readonly string[],
): DiffLine[] {
	let start = 0;
	while (
		start < before.length &&
		start < after.length &&
		before[start] === after[start]
	) {
		start += 1;
	}
	let end = 0;
	while (
		end < before.length - start &&
		end < after.length - start &&
		before[before.length - 1 - end] === after[after.length - 1 - end]
	) {
		end += 1;
	}
	return [
		...before.slice(0, start).map(same),
		...diffMiddle(
			before.slice(start, before.length - end),
			after.slice(start, after.length - end),
		),
		...before.slice(before.length - end).map(same),
	];
}

function diffMiddle(
	before: readonly string[],
	after: readonly string[],
): DiffLine[] {
	const n = before.length;
	const m = after.length;
	if (n * m > MAX_CELLS) {
		return [
			...before.map((text): DiffLine => ({ kind: "removed", text })),
			...after.map((text): DiffLine => ({ kind: "added", text })),
		];
	}
	// lcs[i][j]: common lines of before[i..] and after[j..], flattened.
	const width = m + 1;
	const lcs = new Uint32Array((n + 1) * width);
	for (let i = n - 1; i >= 0; i -= 1) {
		for (let j = m - 1; j >= 0; j -= 1) {
			lcs[i * width + j] =
				before[i] === after[j]
					? (lcs[(i + 1) * width + j + 1] ?? 0) + 1
					: Math.max(
							lcs[(i + 1) * width + j] ?? 0,
							lcs[i * width + j + 1] ?? 0,
						);
		}
	}
	const out: DiffLine[] = [];
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		const a = before[i] ?? "";
		const b = after[j] ?? "";
		if (a === b) {
			out.push({ kind: "same", text: a });
			i += 1;
			j += 1;
		} else if (
			(lcs[(i + 1) * width + j] ?? 0) >= (lcs[i * width + j + 1] ?? 0)
		) {
			out.push({ kind: "removed", text: a });
			i += 1;
		} else {
			out.push({ kind: "added", text: b });
			j += 1;
		}
	}
	for (; i < n; i += 1) out.push({ kind: "removed", text: before[i] ?? "" });
	for (; j < m; j += 1) out.push({ kind: "added", text: after[j] ?? "" });
	return out;
}

/** Shown lines, or unchanged lines folded away behind a "show" button. */
export type DiffChunk =
	| { kind: "lines"; lines: DiffLine[] }
	| { kind: "folded"; lines: DiffLine[] };

/**
 * Folds each run of unchanged lines down to `context` lines next to a
 * change (pure). A diff without any change stays one chunk.
 */
export function collapseDiff(
	lines: readonly DiffLine[],
	context = 3,
): DiffChunk[] {
	// shown[i]: line i is a change or within `context` lines of one.
	const shown = new Uint8Array(lines.length);
	for (const [index, line] of lines.entries()) {
		if (line.kind === "same") continue;
		const last = Math.min(lines.length - 1, index + context);
		for (let at = Math.max(0, index - context); at <= last; at += 1) {
			shown[at] = 1;
		}
	}
	if (!shown.includes(1)) return [{ kind: "lines", lines: [...lines] }];
	const chunks: DiffChunk[] = [];
	for (const [index, line] of lines.entries()) {
		const kind = shown[index] === 1 ? "lines" : "folded";
		const last = chunks.at(-1);
		if (last?.kind === kind) last.lines.push(line);
		else chunks.push({ kind, lines: [line] });
	}
	return chunks;
}
