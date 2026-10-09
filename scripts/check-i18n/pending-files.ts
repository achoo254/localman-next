/**
 * Files of `apps/web/src` that still hold Vietnamese text, grouped by the
 * area that moves them to the dictionaries. `pnpm check:i18n` fails on
 * Vietnamese in any other file, and on a listed file that is already
 * clean, so this list only shrinks. It must end empty.
 */
export const PENDING_FILES: readonly string[] = [];
