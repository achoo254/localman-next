/** Placeholder while a lazily loaded page's code is fetched. */
export function PageLoading() {
	return (
		<output
			data-id="page-loading"
			className="block py-16 text-center font-mono text-muted text-sm"
		>
			Đang tải trang…
		</output>
	);
}
