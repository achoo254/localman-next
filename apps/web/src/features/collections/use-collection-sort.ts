import { useCallback, useState } from "react";
import { type CollectionSort, isCollectionSort } from "./tree-rows";

/** Sort of the collections sidebar, remembered in this browser. */
export const SORT_STORAGE_KEY = "localman-collections-sort";

function readSort(): CollectionSort {
	try {
		const saved = window.localStorage.getItem(SORT_STORAGE_KEY);
		return isCollectionSort(saved) ? saved : "name-asc";
	} catch {
		return "name-asc";
	}
}

export function useCollectionSort(): [
	CollectionSort,
	(sort: CollectionSort) => void,
] {
	const [sort, setSort] = useState<CollectionSort>(readSort);
	const choose = useCallback((next: CollectionSort) => {
		setSort(next);
		try {
			window.localStorage.setItem(SORT_STORAGE_KEY, next);
		} catch {
			// Storage unavailable (privacy mode): the choice holds for this view.
		}
	}, []);
	return [sort, choose];
}
