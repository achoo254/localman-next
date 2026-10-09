/**
 * Classes of the schema grid: 10 columns (name 3, type 3, Faker method or
 * resource 3, remove 1); below 640px each field becomes a two-row card
 * (name + remove, then type + method), as in the prototype.
 */
export const SCHEMA_ROW =
	"grid grid-cols-[minmax(8rem,1fr)_minmax(0,1.2fr)_2.75rem] items-center gap-2 rounded-md border border-border-subtle p-2 " +
	"sm:grid-cols-10 sm:rounded-none sm:border-0 sm:p-0";
export const CELL_NAME = "col-span-2 row-start-1 sm:col-span-3 sm:row-auto";
export const CELL_TYPE = "col-start-1 row-start-2 sm:col-span-3 sm:row-auto";
export const CELL_THIRD = "col-[2/4] row-start-2 sm:col-span-3 sm:row-auto";
export const CELL_REMOVE =
	"col-start-3 row-start-1 justify-self-center sm:col-span-1 sm:row-auto";
/** Compact controls of the grid (40px high, 13px text). */
export const COMPACT_CONTROL = "min-h-10! text-[0.8125rem]";
