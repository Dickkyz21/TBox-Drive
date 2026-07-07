'use client';

const PAGE_SIZE_OPTIONS = [10, 30, 50] as const;

function getVisiblePages(currentPage: number, totalPages: number): number[] {
  const pages = new Set<number>([1, totalPages, currentPage]);
  if (currentPage > 1) pages.add(currentPage - 1);
  if (currentPage < totalPages) pages.add(currentPage + 1);
  return [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
}

export function Pagination({
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'data',
}: {
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  itemLabel?: string;
}) {
  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(totalItems, currentPage * pageSize);
  const visiblePages = getVisiblePages(currentPage, totalPages);

  function goTo(nextPage: number) {
    onPageChange(Math.min(Math.max(nextPage, 1), totalPages));
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-base-700 bg-base-800/45 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-ink-500">
        Menampilkan <span className="font-mono text-ink-300">{start}-{end}</span> dari{' '}
        <span className="font-mono text-ink-300">{totalItems}</span> {itemLabel}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex items-center justify-between gap-2 text-xs text-ink-500 sm:justify-start">
          <span>Per halaman</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-9 rounded-lg border border-base-700 bg-base-900 px-2.5 text-sm text-ink-300 focus:border-tg-500"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center justify-between gap-1 sm:justify-start">
          <button
            type="button"
            onClick={() => goTo(1)}
            disabled={currentPage === 1}
            className="hidden h-9 rounded-lg border border-base-700 px-2.5 text-xs text-ink-500 hover:bg-base-700 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-40 sm:inline-flex sm:items-center"
          >
            Awal
          </button>
          <button
            type="button"
            onClick={() => goTo(currentPage - 1)}
            disabled={currentPage === 1}
            className="inline-flex h-9 items-center rounded-lg border border-base-700 px-3 text-xs text-ink-500 hover:bg-base-700 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Prev
          </button>

          <div className="flex items-center gap-1">
            {visiblePages.map((visiblePage, index) => {
              const previousPage = visiblePages[index - 1];
              const hasGap = previousPage !== undefined && visiblePage - previousPage > 1;
              return (
                <div key={visiblePage} className="flex items-center gap-1">
                  {hasGap && <span className="px-1 text-xs text-ink-500">...</span>}
                  <button
                    type="button"
                    onClick={() => goTo(visiblePage)}
                    className={`h-9 min-w-9 rounded-lg px-2.5 text-sm font-medium ${
                      currentPage === visiblePage
                        ? 'bg-tg-500 text-white'
                        : 'border border-base-700 text-ink-500 hover:bg-base-700 hover:text-ink-100'
                    }`}
                    aria-current={currentPage === visiblePage ? 'page' : undefined}
                  >
                    {visiblePage}
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => goTo(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="inline-flex h-9 items-center rounded-lg border border-base-700 px-3 text-xs text-ink-500 hover:bg-base-700 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => goTo(totalPages)}
            disabled={currentPage === totalPages}
            className="hidden h-9 rounded-lg border border-base-700 px-2.5 text-xs text-ink-500 hover:bg-base-700 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-40 sm:inline-flex sm:items-center"
          >
            Akhir
          </button>
        </div>
      </div>
    </div>
  );
}
