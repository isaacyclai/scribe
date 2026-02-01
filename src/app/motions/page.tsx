import QuestionCard from '@/components/QuestionCard'
import QuestionFilters from '@/components/QuestionFilters'
import ServerPagination from '@/components/ServerPagination'
import { query } from '@/lib/db'
import type { Section, Speaker } from '@/types'

export default async function MotionsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const search = typeof params.search === 'string' ? params.search : ''
    const sort = typeof params.sort === 'string' ? params.sort : 'relevance'
    const limit = 20

    const sqlParams: (string | number)[] = []
    let paramCount = 1

    let rankClause = ''
    if (search) {
        sqlParams.push(search)
        rankClause = `, ts_rank(to_tsvector('english', s.content_plain), plainto_tsquery('english', $${paramCount})) as rank`
        paramCount++
    }

    let sql = `
        SELECT 
            s.id,
            s.session_id as "sessionId",
            s.section_type as "sectionType",
            s.section_title as "sectionTitle",
            s.category,
            LEFT(s.content_plain, 300) as "contentSnippet",
            s.section_order as "sectionOrder",
            m.acronym as ministry,
            m.id as "ministryId",
            sess.date as "sessionDate",
            sess.sitting_no as "sittingNo",
            COALESCE(
                json_agg(
                    json_build_object(
                        'memberId', mem.id,
                        'name', mem.name,
                        'constituency', ss.constituency,
                        'designation', ss.designation
                    ) ORDER BY mem.name
                ) FILTER (WHERE mem.id IS NOT NULL),
                '[]'
            ) as speakers
            ${rankClause}
        FROM sections s
        JOIN sessions sess ON s.session_id = sess.id
        LEFT JOIN ministries m ON s.ministry_id = m.id
        LEFT JOIN section_speakers ss ON s.id = ss.section_id
        LEFT JOIN members mem ON ss.member_id = mem.id
        WHERE s.category IN ('motion', 'adjournment_motion')
    `

    if (search) {
        sql += ` AND (
            to_tsvector('english', s.content_plain) @@ plainto_tsquery('english', $1) OR 
            s.section_title ILIKE $${paramCount}
        )`
        sqlParams.push(`%${search}%`)
        paramCount++
    }

    // Determine sort order
    let orderBy = 'sess.date DESC, s.section_order ASC'
    if (sort === 'oldest') {
        orderBy = 'sess.date ASC, s.section_order ASC'
    } else if (sort === 'relevance' && search) {
        orderBy = 'rank DESC, sess.date DESC, s.section_order ASC'
    }
    // Default 'newest' matches the initial value

    // Calculate offset
    const pageNum = typeof params.page === 'string' ? parseInt(params.page) : 1
    const offset = (pageNum - 1) * limit



    // Count Query
    let countSql = `
        SELECT COUNT(*) as total
        FROM sections s
        JOIN sessions sess ON s.session_id = sess.id
        WHERE s.category IN ('motion', 'adjournment_motion')
    `
    if (search) {
        countSql += ` AND (
            to_tsvector('english', s.content_plain) @@ plainto_tsquery('english', $1) OR 
            s.section_title ILIKE $${search ? '1' : ''} -- Reuse param 1 if search exists
        )`
    }
    const countResult = await query(countSql, search ? [`%${search}%`] : [])
    const totalCount = parseInt(countResult.rows[0]?.total || '0')
    const totalPages = Math.ceil(totalCount / limit)

    // Data Query
    sql += ` GROUP BY s.id, s.session_id, s.section_type, s.section_title, 
             s.category, s.section_order, m.acronym, m.id, sess.date, sess.sitting_no
             ${search ? ', rank' : ''}
             ORDER BY ${orderBy}
             LIMIT $${paramCount} OFFSET $${paramCount + 1}`
    sqlParams.push(limit, offset)

    const result = await query(sql, sqlParams)
    const motions: Section[] = result.rows.map(row => ({
        ...row,
        speakers: row.speakers as Speaker[]
    }))

    return (
        <div>
            <header className="mb-8">
                <h1 className="mb-2 text-3xl font-bold text-zinc-900">
                    Motions
                </h1>
                <p className="mb-4 text-zinc-600">
                    Here, you can find motions that have been debated in Parliament, such as adjournment motions and ministerial statements.
                    Note that some very short motions (such as ones to ask for extension of time) may not be included in this list.
                </p>
                <p className="text-zinc-600">
                    There is typically one adjournment motion at the end of each sitting which can be moved by any MP.
                </p>
            </header>

            <QuestionFilters
                initialSearch={search}
                placeholder="Search motions..."
            />

            <section>
                <h2 className="mb-4 text-xl font-semibold text-zinc-900">
                    {search ? `Search Results for "${search}"` : 'Recent Motions'}
                </h2>

                {motions.length === 0 ? (
                    <p className="py-12 text-center text-zinc-500">
                        {search ? `No motions found matching "${search}"` : 'No motions found'}
                    </p>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {motions.map((motion) => (
                            <QuestionCard key={motion.id} question={motion} showContent={false} />
                        ))}
                    </div>
                )}
            </section>

            <ServerPagination
                currentPage={pageNum}
                totalPages={totalPages}
                baseUrl="/motions"
            />
        </div>
    )
}
