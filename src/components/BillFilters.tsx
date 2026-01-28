'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import SearchBar from '@/components/SearchBar'

export default function BillFilters({
    initialSearch = ''
}: {
    initialSearch?: string
}) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const handleSearch = (query: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (query) params.set('search', query)
        else params.delete('search')

        router.push(`/bills?${params.toString()}`)
    }

    return (
        <div className="mb-6">
            <SearchBar
                placeholder="Search bills..."
                onSearch={handleSearch}
                defaultValue={initialSearch}
            />
        </div>
    )
}
