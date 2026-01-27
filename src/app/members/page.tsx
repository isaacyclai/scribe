'use client'

import { useState, useEffect, useCallback } from 'react'
import SearchBar from '@/components/SearchBar'
import MemberCard from '@/components/MemberCard'
import type { Member } from '@/types'

export default function MembersPage() {
    const [members, setMembers] = useState<Member[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [constituencies, setConstituencies] = useState<string[]>([])
    const [selectedConstituency, setSelectedConstituency] = useState('')
    const [sortBy, setSortBy] = useState('name')

    // Fetch available constituencies on mount
    useEffect(() => {
        async function fetchConstituencies() {
            try {
                const res = await fetch('/api/constituencies')
                if (res.ok) {
                    const data = await res.json()
                    setConstituencies(data)
                }
            } catch (error) {
                console.error('Failed to fetch constituencies:', error)
            }
        }
        fetchConstituencies()
    }, [])

    const fetchMembers = useCallback(async (search: string, constituency: string, sort: string, pageNum: number) => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (search) params.set('search', search)
            if (constituency) params.set('constituency', constituency)
            params.set('sort', sort)
            params.set('page', pageNum.toString())
            params.set('limit', '20')

            const res = await fetch(`/api/members?${params}`)
            const data = await res.json()
            setMembers(data.members)
            setTotalPages(data.totalPages)
        } catch (error) {
            console.error('Failed to fetch members:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    // Reset pagination when filters change
    useEffect(() => {
        setPage(1)
    }, [searchQuery, selectedConstituency, sortBy])

    useEffect(() => {
        // Debounce search/pagination
        const timer = setTimeout(() => {
            fetchMembers(searchQuery, selectedConstituency, sortBy, page)
        }, 300)
        return () => clearTimeout(timer)
    }, [searchQuery, selectedConstituency, sortBy, page, fetchMembers])

    const handleSearch = useCallback((query: string) => {
        setSearchQuery(query)
    }, [])

    return (
        <div>
            <section className="mb-8">
                <h1 className="mb-2 text-3xl font-bold text-zinc-900">
                    Members of Parliament
                </h1>
                <p className="mb-4 text-zinc-600">
                    Browse profiles of Members of Parliament. (Placeholder)
                </p>
                <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="flex-1">
                        <SearchBar
                            placeholder="Search members by name..."
                            onSearch={handleSearch}
                        />
                    </div>
                    <div className="flex w-full gap-2 sm:w-auto">
                        <select
                            value={selectedConstituency}
                            onChange={(e) => setSelectedConstituency(e.target.value)}
                            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:w-48"
                        >
                            <option value="">All Constituencies</option>
                            {constituencies.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:w-48"
                        >
                            <option value="name">Name (A-Z)</option>
                            <option value="involvements">Most Active</option>
                        </select>
                    </div>
                </div>
            </section>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                </div>
            ) : members.length === 0 ? (
                <p className="py-12 text-center text-zinc-500">
                    No members found
                </p>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {members.map((member) => (
                            <MemberCard key={member.id} member={member} />
                        ))}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="mt-8 flex justify-center gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="rounded border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="flex items-center text-sm text-zinc-600">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="rounded border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
