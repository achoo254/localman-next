/** Id of the `<main>` element of both layouts, target of the skip link. */
export const MAIN_ID = "main";

/**
 * First focusable element of every page: jumps keyboard and screen reader
 * users past the top bar. Hidden until it receives focus.
 */
export function SkipLink() {
	return (
		<a
			href={`#${MAIN_ID}`}
			data-id="skip-to-main"
			className="sr-only z-90 rounded-md bg-surface px-4 py-2 font-mono font-semibold text-sm shadow-lg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
		>
			Bỏ qua tới nội dung
		</a>
	);
}

/** Class list shared by the `<main>` of the public and signed-in layouts. */
export const MAIN_CLASS =
	"mx-auto w-full max-w-page px-gutter pt-8 pb-16 focus:outline-none";
