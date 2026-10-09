import { en } from "./messages/en/dictionary";
import { type Translator, createTranslator } from "./translate";

/**
 * The translator of the language on screen, for plain functions that run
 * outside React (`errorMessage`, `invalidJsonMessage`). `I18nProvider`
 * keeps it current; without a provider it stays English. Components use
 * `useT()` instead, so they re-render when the language changes.
 */
let active: Translator = createTranslator("en", en);

export function setActiveTranslator(translator: Translator): void {
	active = translator;
}

export function activeTranslator(): Translator {
	return active;
}
