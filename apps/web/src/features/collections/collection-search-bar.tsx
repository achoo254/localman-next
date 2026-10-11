import { IconArrowsSort, IconStar } from "@tabler/icons-react";
import type { RefObject } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { IconButton } from "../../components/ui/icon-button";
import { Input } from "../../components/ui/input";
import { useT } from "../../i18n/i18n-context";
import {
	COLLECTION_SORTS,
	type CollectionSort,
	isCollectionSort,
} from "./tree-rows";

const SORT_KEYS = {
	"name-asc": "collections.sorts.nameAsc",
	"name-desc": "collections.sorts.nameDesc",
	updated: "collections.sorts.updated",
} as const satisfies Record<CollectionSort, string>;

export interface CollectionSearchBarProps {
	query: string;
	onQueryChange: (query: string) => void;
	sort: CollectionSort;
	onSortChange: (sort: CollectionSort) => void;
	inputRef: RefObject<HTMLInputElement | null>;
}

/** Search box and sort menu above the collections tree. */
export function CollectionSearchBar({
	query,
	onQueryChange,
	sort,
	onSortChange,
	inputRef,
}: CollectionSearchBarProps) {
	const t = useT();
	const sortLabel = t(SORT_KEYS[sort]);
	return (
		<div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 p-2">
			<Input
				ref={inputRef}
				type="search"
				value={query}
				aria-label={t("collections.sidebar.search")}
				placeholder={t("collections.sidebar.searchPlaceholder")}
				data-id="sidebar-collections-search"
				className="min-h-9 text-xs"
				onChange={(event) => onQueryChange(event.target.value)}
			/>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<IconButton
						size="sm"
						data-id="sidebar-collections-sort"
						label={t("collections.sidebar.sort", { label: sortLabel })}
						title={t("collections.sidebar.sort", { label: sortLabel })}
						icon={<IconArrowsSort size={16} aria-hidden="true" />}
					/>
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuLabel>
						{t("collections.sidebar.sortHeading")}
					</DropdownMenuLabel>
					<DropdownMenuRadioGroup
						value={sort}
						onValueChange={(value) => {
							if (isCollectionSort(value)) onSortChange(value);
						}}
					>
						{COLLECTION_SORTS.map((option) => (
							<DropdownMenuRadioItem
								key={option}
								value={option}
								data-id={`sort-${option}`}
							>
								{t(SORT_KEYS[option])}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
					<DropdownMenuSeparator />
					<DropdownMenuLabel className="flex items-center gap-2">
						<IconStar size={14} aria-hidden="true" />
						{t("collections.sidebar.favoritesFirst")}
					</DropdownMenuLabel>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
