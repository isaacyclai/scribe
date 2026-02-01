'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import SearchBar from '@/components/SearchBar'

export default function QuestionFilters({
    initialSearch = '',
    placeholder = 'Search questions...'
}: {
    initialSearch?: string
    placeholder?: string
}) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handleSearch = (query: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (query) params.set('search', query)
        else params.delete('search')

        router.push(`${pathname}?${params.toString()}`)
    }

    const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('sort', e.target.value)
        router.push(`${pathname}?${params.toString()}`)
    }

    const sort = searchParams.get('sort') || 'relevance'

    return (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
                <SearchBar
                    placeholder={placeholder}
                    onSearch={handleSearch}
                    defaultValue={initialSearch}
                />
            </div>
            <div className="w-full sm:w-48">
                <select
                    value={sort}
                    onChange={handleSortChange}
                    className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-purple-300"
                >
                    <option value="relevance">Relevance</option>
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                </select>
            </div>
        </div>
    )
}
