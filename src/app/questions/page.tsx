import QuestionCard from '@/components/QuestionCard'
import QuestionFilters from '@/components/QuestionFilters'
import ServerPagination from '@/components/ServerPagination'
import { query } from '@/lib/db'
import type { Section, Speaker } from '@/types'

export default async function QuestionsPage({
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
        WHERE (s.category = 'question' OR s.category IS NULL)
            AND s.section_type NOT IN ('BI', 'BP')
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

    // Calculate offset
    const pageNum = typeof params.page === 'string' ? parseInt(params.page) : 1
    const offset = (pageNum - 1) * limit

    // Count Query
    let countSql = `
        SELECT COUNT(*) as total
        FROM sections s
        JOIN sessions sess ON s.session_id = sess.id
        WHERE (s.category = 'question' OR s.category IS NULL)
            AND s.section_type NOT IN ('BI', 'BP')
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
    const questions: Section[] = result.rows.map(row => ({
        ...row,
        speakers: row.speakers as Speaker[]
    }))

    return (
        <div>
            <header className="mb-8">
                <h1 className="mb-2 text-3xl font-bold text-zinc-900">
                    Questions
                </h1>
                <p className="mb-4 text-zinc-600">
                    Here, you can find all parliamentary questions (PQs) that have been asked. PQs are formal inquiries made by MPs to ministers for information,
                    clarification, or updates on specific issues. There are two types of PQs that can be asked: oral and written. Each MP can file up to 5 PQs per
                    sitting (three oral and two written). After the initial answer from the Minister, supplementary questions may be asked by any MP.
                </p>
                <h3 className="mb-3 text-2xl font-bold text-zinc-900">Oral Questions</h3>
                <p className="mb-4 text-zinc-600">
                    Oral questions are answered and can be debated during question time, the first 90 minutes of each sitting. The order of questions to be answered
                    is decided by the Leader of the House, and is published in the Order Paper prior to the sitting. After 90 minutes, the remaining questions which
                    have not been answered will be provided with written answers.
                </p>
                <h3 className="mb-3 text-2xl font-bold text-zinc-900">Written Questions</h3>
                <p className="mb-4 text-zinc-600">
                    Written questions are not answered during question time and are instead provided with written answers. They are also included in the Order Paper.
                </p>
            </header>

            <QuestionFilters initialSearch={search} />

            <section>
                <h2 className="mb-4 text-xl font-semibold text-zinc-900">
                    {search ? `Search Results for "${search}"` : 'Recent Questions'}
                </h2>

                {questions.length === 0 ? (
                    <p className="py-12 text-center text-zinc-500">
                        {search ? `No questions found matching "${search}"` : 'No questions found'}
                    </p>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {questions.map((question) => (
                            <QuestionCard key={question.id} question={question} showContent={false} />
                        ))}
                    </div>
                )}
            </section>

            <ServerPagination
                currentPage={pageNum}
                totalPages={totalPages}
                baseUrl="/questions"
            />
        </div>
    )
}
