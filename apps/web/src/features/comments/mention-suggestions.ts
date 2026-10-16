/** Finding the `@name` being typed and completing it with a username. */

export interface MentionCandidate {
	username: string;
	name: string | null;
}

export interface MentionQuery {
	/** Offset of the `@`. */
	start: number;
	/** What follows the `@` up to the caret. */
	prefix: string;
}

/** Same rule as the API: `@` not glued to a word, an email or a dot. */
const TYPING = /(?:^|[^\w@.])@([A-Za-z0-9._-]{0,63})$/;
/** Suggestions shown at most. */
export const MENTION_SUGGESTIONS_MAX = 6;

/** The mention ending at `caret`, or `null` when the caret is not in one. */
export function mentionAt(text: string, caret: number): MentionQuery | null {
	const match = TYPING.exec(text.slice(0, caret));
	const prefix = match?.[1];
	if (prefix === undefined) return null;
	return { start: caret - prefix.length - 1, prefix };
}

/** People whose username or name starts with the prefix (case aside). */
export function suggestPeople(
	people: readonly MentionCandidate[],
	prefix: string,
): MentionCandidate[] {
	const wanted = prefix.toLowerCase();
	return people
		.filter(
			(person) =>
				person.username.toLowerCase().startsWith(wanted) ||
				(person.name ?? "").toLowerCase().startsWith(wanted),
		)
		.slice(0, MENTION_SUGGESTIONS_MAX);
}

/** The text with the mention completed (and a space after), and the caret. */
export function completeMention(
	text: string,
	caret: number,
	query: MentionQuery,
	username: string,
): { text: string; caret: number } {
	const inserted = `@${username} `;
	return {
		text: text.slice(0, query.start) + inserted + text.slice(caret),
		caret: query.start + inserted.length,
	};
}
