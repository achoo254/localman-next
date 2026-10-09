import { Button } from "../../components/ui/button";

export interface PaginationProps {
	page: number;
	pages: number;
	onPage: (page: number) => void;
}

/** Previous / next with "page/pages"; hidden when everything fits one page. */
export function Pagination({ page, pages, onPage }: PaginationProps) {
	if (pages <= 1) return null;
	return (
		<nav
			aria-label="Phân trang"
			data-id="admin-pro-pagination"
			className="flex items-center justify-end gap-2 border-border-subtle border-t px-5 py-3"
		>
			<Button size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
				Trang trước
			</Button>
			<span className="font-mono text-[0.8125rem] text-muted">
				{page}/{pages}
			</span>
			<Button
				size="sm"
				disabled={page >= pages}
				onClick={() => onPage(page + 1)}
			>
				Trang sau
			</Button>
		</nav>
	);
}
