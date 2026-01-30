'use client'

import { useState, useEffect } from 'react'

interface PaginatedListProps<T> {
    items: T[]
    renderItem: (item: T) => React.ReactNode
    itemsPerPage?: number,
    emptyMessage?: string
}

export default function PaginatedList<T>({
    items,
    renderItem,
    itemsPerPage = 10,
    emptyMessage = "No items found."
}: PaginatedListProps<T>) {
    const [currentPage, setCurrentPage] = useState(1)

    // Reset page when items change (e.g. search filter)
    useEffect(() => {
        setCurrentPage(1)
    }, [items.length]) // Simple heuristic, better to check items ref if stable

    if (items.length === 0) {
        return (
            <p className="py-8 text-center text-zinc-500">
                {emptyMessage}
            </p>
        )
    }

    const totalPages = Math.ceil(items.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const displayedItems = items.slice(startIndex, startIndex + itemsPerPage)

    const handlePageChange = (page: number) => {
        setCurrentPage(page)
        // Optional: Scroll to top of list?
        // window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    return (
        <div>
            <div className="grid gap-4 md:grid-cols-2">
                {displayedItems.map(renderItem)}
            </div>

            {totalPages > 1 && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="rounded-md border border-zinc-200 px-3 py-1 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50"
                    >
                        Previous
                    </button>

                    <span className="text-sm text-zinc-600">
                        Page {currentPage} of {totalPages}
                    </span>

                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="rounded-md border border-zinc-200 px-3 py-1 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    )
}
