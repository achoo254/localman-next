import { auth } from "./auth";
import { common } from "./common";
import { landing } from "./landing";
import { layout } from "./layout";

/**
 * English dictionary: the source of every key and of the `Messages` type
 * that the other languages must fill. One namespace per area of the app.
 */
export const en = { common, auth, layout, landing } as const;
