/**
 * Words of a shell command line and the builder the tokenizers share.
 */
import { RequestImportFailure } from "./import-error.js";

export interface ShellWord {
	text: string;
	/** Some part was quoted or escaped, so `|` or `;` is data, not syntax. */
	quoted: boolean;
}

export const unterminatedQuote = (): RequestImportFailure =>
	new RequestImportFailure("UNTERMINATED_QUOTE");

/** Collects characters into words; `add(text, true)` marks the word quoted. */
export class WordBuilder {
	readonly words: ShellWord[] = [];
	private text = "";
	private open = false;
	private quoted = false;

	add(chars: string, quoted = false): void {
		this.text += chars;
		this.open = true;
		if (quoted) this.quoted = true;
	}

	get inWord(): boolean {
		return this.open;
	}

	end(): void {
		if (this.open) this.words.push({ text: this.text, quoted: this.quoted });
		this.text = "";
		this.open = false;
		this.quoted = false;
	}
}
