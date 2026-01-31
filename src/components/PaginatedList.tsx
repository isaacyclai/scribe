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
    }

    const getPageNumbers = () => {
        const delta = 1 // Number of pages to show around current page
        const range = []
        const rangeWithDots: (number | string)[] = []

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
                range.push(i)
            }
        }

        let l: number | null = null
        for (const i of range) {
            if (l) {
                if (i - l === 2) {
                    rangeWithDots.push(l + 1)
                } else if (i - l !== 1) {
                    rangeWithDots.push('...')
                }
            }
            rangeWithDots.push(i)
            l = i
        }

        return rangeWithDots
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
                        className="rounded-md border border-zinc-200 px-3 py-1 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50 disabled:hover:bg-white"
                    >
                        Previous
                    </button>

                    <div className="flex items-center gap-1">
                        {getPageNumbers().map((page, index) => (
                            page === '...' ? (
                                <span key={`dots-${index}`} className="px-2 text-zinc-400">...</span>
                            ) : (
                                <button
                                    key={page}
                                    onClick={() => handlePageChange(page as number)}
                                    className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${currentPage === page
                                        ? 'bg-blue-600 text-white'
                                        : 'border border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                                        }`}
                                >
                                    {page}
                                </button>
                            )
                        ))}
                    </div>

                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="rounded-md border border-zinc-200 px-3 py-1 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50 disabled:hover:bg-white"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    )
}
