'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import QuestionCard from '@/components/QuestionCard'
import SearchBar from '@/components/SearchBar'
import AISummaryCard from '@/components/AISummaryCard'
import PaginatedList from '@/components/PaginatedList'
import type { Section } from '@/types'

interface Bill {
    billId: string
    sectionType: string
    sectionTitle: string
    ministry: string | null
    sessionDate: string
}

interface MemberDetail {
    id: string
    name: string
    summary: string | null
    constituency: string | null
    designation: string | null
    attendance?: {
        total: number
        present: number
        history: Array<{
            sessionId: string
            date: string
            present: boolean
            sittingNo: number
        }>
    }
    questions: Section[]
    bills: Bill[]
}

export default function MemberDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params)
    const [member, setMember] = useState<MemberDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [showAttendanceHistory, setShowAttendanceHistory] = useState(false)
    const [attendancePage, setAttendancePage] = useState(1)

    useEffect(() => {
        async function fetchMember() {
            try {
                const params = new URLSearchParams()
                if (searchQuery) params.set('search', searchQuery)

                const res = await fetch(`/api/members/${id}?${params}`)
                if (!res.ok) throw new Error('Member not found')
                const data = await res.json()
                setMember(data)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load member')
            } finally {
                setLoading(false)
            }
        }
        fetchMember()
    }, [id, searchQuery])

    // Use member data directly as it's now filtered on the server
    const filteredBills = member?.bills || []
    const allQuestions = member?.questions || []

    const motions = allQuestions.filter(q =>
        ['motion', 'statement', 'adjournment_motion', 'clarification'].includes(q.category || '') ||
        (!q.category && q.sectionType === 'OS')
    )
    const questions = allQuestions.filter(q => !motions.includes(q))

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
            </div>
        )
    }

    if (error || !member) {
        return (
            <div className="py-12 text-center">
                <p className="text-red-500">{error || 'Member not found'}</p>
            </div>
        )
    }

    return (
        <div>
            <Link href="/members" className="mb-6 inline-flex items-center text-sm text-blue-600 hover:underline">
                ← Back to Members
            </Link>

            <section className="mb-8">
                <h1 className="mb-2 text-3xl font-bold text-zinc-900">
                    {member.name}
                </h1>
                {(member.designation || member.constituency) && (
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                        {member.designation && (
                            <span className="text-lg text-zinc-600">
                                {member.designation}
                            </span>
                        )}
                        {member.constituency && (
                            <span className="rounded bg-zinc-100 px-2 py-1 text-sm text-zinc-600">
                                {member.constituency}
                            </span>
                        )}
                        {member.attendance && member.attendance.total > 0 && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowAttendanceHistory(!showAttendanceHistory)}
                                    className="flex items-center gap-2 rounded bg-blue-50 px-2 py-1 text-sm text-blue-700 hover:bg-blue-100"
                                    title="Click to view full attendance history"
                                >
                                    <span>
                                        Attendance: {Math.round((member.attendance.present / member.attendance.total) * 100)}% ({member.attendance.present}/{member.attendance.total})
                                    </span>
                                    <svg
                                        className={`h-4 w-4 transition-transform ${showAttendanceHistory ? 'rotate-180' : ''}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {showAttendanceHistory && (
                                    <div className="absolute left-0 top-full z-10 mt-2 w-72 rounded-lg border border-zinc-200 bg-white p-4 shadow-lg ring-1 ring-black ring-opacity-5">
                                        <h3 className="mb-3 text-sm font-semibold text-zinc-900">Attendance History</h3>
                                        <div className="max-h-60 overflow-y-auto pr-1">
                                            <div className="space-y-2">
                                                {(member.attendance.history || [])
                                                    .slice((attendancePage - 1) * 10, attendancePage * 10)
                                                    .map((record) => (
                                                        <Link
                                                            key={record.sessionId}
                                                            href={`/sessions/${record.sessionId}`}
                                                            className="flex items-center justify-between rounded p-2 text-sm hover:bg-zinc-50"
                                                        >
                                                            <span className="text-zinc-600">
                                                                {new Date(record.date).toLocaleDateString('en-SG', {
                                                                    day: 'numeric',
                                                                    month: 'short',
                                                                    year: 'numeric'
                                                                })}
                                                            </span>
                                                            {record.present ? (
                                                                <span className="flex items-center gap-1 text-green-600">
                                                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                    <span className="text-xs font-medium">Present</span>
                                                                </span>
                                                            ) : (
                                                                <span className="flex items-center gap-1 text-red-500">
                                                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                    </svg>
                                                                    <span className="text-xs font-medium">Absent</span>
                                                                </span>
                                                            )}
                                                        </Link>
                                                    ))}
                                            </div>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between text-xs border-t border-zinc-100 pt-3">
                                            <button
                                                disabled={attendancePage === 1}
                                                onClick={() => setAttendancePage(p => p - 1)}
                                                className="rounded px-2 py-1 hover:bg-zinc-100 disabled:opacity-50 disabled:hover:bg-transparent"
                                            >
                                                Previous
                                            </button>
                                            <select
                                                value={attendancePage}
                                                onChange={(e) => setAttendancePage(Number(e.target.value))}
                                                className="rounded border-none bg-transparent py-0 pl-1 pr-6 text-xs text-zinc-500 hover:text-zinc-700 focus:ring-0 cursor-pointer"
                                            >
                                                {Array.from({ length: Math.ceil((member.attendance?.history || []).length / 10) }, (_, i) => i + 1).map(page => (
                                                    <option key={page} value={page}>
                                                        Page {page} of {Math.ceil((member.attendance?.history || []).length / 10)}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                disabled={attendancePage >= Math.ceil((member.attendance?.history || []).length / 10)}
                                                onClick={() => setAttendancePage(p => p + 1)}
                                                className="rounded px-2 py-1 hover:bg-zinc-100 disabled:opacity-50 disabled:hover:bg-transparent"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Member Summary */}
                <div className="mt-6">
                    <AISummaryCard
                        title="Summary of Recent Topics"
                        content={member.summary}
                        fallbackMessage="Summary of recent topics has not been generated yet."
                    />
                </div>
            </section>

            <div className="mb-8">
                <SearchBar
                    placeholder="Search involvements..."
                    onSearch={setSearchQuery}
                    defaultValue={searchQuery}
                />
            </div>

            {/* Motions Section */}
            {motions.length > 0 && (
                <section className="mb-8">
                    <h2 className="mb-4 text-xl font-semibold text-zinc-900">
                        Motions ({motions.length})
                    </h2>
                    <PaginatedList
                        items={motions}
                        itemsPerPage={10}
                        renderItem={(motion) => (
                            <QuestionCard key={motion.id} question={motion} showSpeakers={false} />
                        )}
                    />
                </section>
            )}

            {/* Bills Section */}
            {filteredBills.length > 0 && (
                <section className="mb-8">
                    <h2 className="mb-4 text-xl font-semibold text-zinc-900">
                        Bills ({filteredBills.length})
                    </h2>
                    <PaginatedList
                        items={filteredBills}
                        itemsPerPage={10}
                        renderItem={(bill) => (
                            <Link key={bill.billId} href={`/bills/${bill.billId}`}>
                                <div className="group cursor-pointer rounded-lg border border-zinc-200 bg-white p-4 transition-all hover:border-purple-300 hover:shadow-md">
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                        <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                                            Bill
                                        </span>
                                        {bill.ministry && (
                                            <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                                {bill.ministry}
                                            </span>
                                        )}
                                        <span className="text-xs text-zinc-500">
                                            {new Date(bill.sessionDate).toLocaleDateString('en-SG', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </span>
                                    </div>
                                    <h3 className="line-clamp-2 font-semibold text-zinc-900 group-hover:text-purple-600">
                                        {bill.sectionTitle}
                                    </h3>
                                </div>
                            </Link>
                        )}
                    />
                </section>
            )}


            {/* Questions Section */}
            <section>
                <h2 className="mb-4 text-xl font-semibold text-zinc-900">
                    Parliamentary Questions ({questions.length || 0})
                </h2>
                <PaginatedList
                    items={questions}
                    itemsPerPage={10}
                    emptyMessage={searchQuery ? 'No results found matching your search' : 'No recorded questions'}
                    renderItem={(question) => (
                        <QuestionCard key={question.id} question={question} showSpeakers={false} />
                    )}
                />
            </section>
        </div>
    )
}
