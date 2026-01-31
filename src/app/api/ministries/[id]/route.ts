// src/app/api/ministries/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const sort = searchParams.get('sort') || 'relevance'

    try {
        // Get ministry info
        const ministryResult = await query(
            `SELECT id, name, acronym FROM ministries WHERE id = $1`,
            [id]
        )

        if (ministryResult.rows.length === 0) {
            return NextResponse.json({ error: 'Ministry not found' }, { status: 404 })
        }

        const ministry = ministryResult.rows[0]

        // Get questions under this ministry (excluding bills)
        const questionsParams: (string | number)[] = [id]
        let qParamCount = 2
        let qRankSelect = ''

        if (search) {
            questionsParams.push(search)
            qRankSelect = `, ts_rank(to_tsvector('english', s.content_plain), plainto_tsquery('english', $${qParamCount})) as rank`
            qParamCount++
        }

        let questionsSql = `SELECT 
        s.id,
        s.section_type as "sectionType",
        s.section_title as "sectionTitle",
        -- s.content_plain as "contentPlain", -- Optimization
        s.category,
        sess.date as "sessionDate",
        ARRAY_AGG(DISTINCT mem.name ORDER BY mem.name) as speakers
        ${qRankSelect}
        FROM sections s
        JOIN sessions sess ON s.session_id = sess.id
        LEFT JOIN section_speakers ss ON s.id = ss.section_id
        LEFT JOIN members mem ON ss.member_id = mem.id
        WHERE s.ministry_id = $1 AND s.section_type NOT IN ('BI', 'BP')`

        if (search) {
            questionsSql += ` AND (
            to_tsvector('english', s.content_plain) @@ plainto_tsquery('english', $${qParamCount - 1}) OR 
            s.section_title ILIKE $${qParamCount}
        )`
            questionsParams.push(`%${search}%`)
            qParamCount++
        }

        questionsSql += ` GROUP BY s.id, s.section_type, s.section_title, s.content_plain, s.category, sess.date, s.section_order ${search ? ', rank' : ''}
        ORDER BY ${search ? 'rank DESC,' : ''} sess.date DESC, s.section_order ASC
        LIMIT 1000`

        const questionsResult = await query(questionsSql, questionsParams)

        // Get bills under this ministry (BP sections with bill_id for linking)
        const billsParams: (string | number)[] = [id]
        let bParamCount = 2
        let bRankSelect = ''

        if (search) {
            billsParams.push(search)
            bRankSelect = `, ts_rank(to_tsvector('english', s.content_plain), plainto_tsquery('english', $${bParamCount})) as rank`
            bParamCount++
        }

        let billsSql = `SELECT DISTINCT ON (s.bill_id)
        s.bill_id as "billId",
        s.section_type as "sectionType",
        s.section_title as "sectionTitle",
        sess.date as "sessionDate"
        ${bRankSelect}
        FROM sections s
        JOIN sessions sess ON s.session_id = sess.id
        WHERE s.ministry_id = $1 AND s.section_type = 'BP' AND s.bill_id IS NOT NULL`

        if (search) {
            billsSql += ` AND (
            to_tsvector('english', s.content_plain) @@ plainto_tsquery('english', $${bParamCount - 1}) OR 
            s.section_title ILIKE $${bParamCount}
            )`
            billsParams.push(`%${search}%`)
            bParamCount++
        }

        if (search) {
            billsSql = `SELECT * FROM (${billsSql} ORDER BY s.bill_id, rank DESC, sess.date DESC) as sub
                        ORDER BY rank DESC, "sessionDate" DESC LIMIT 500`
        } else {
            billsSql += ` ORDER BY s.bill_id, sess.date DESC LIMIT 500`
        }

        const billsResult = await query(billsSql, billsParams)

        return NextResponse.json({
            ...ministry,
            questions: questionsResult.rows,
            bills: billsResult.rows
        }, {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
            }
        })
    } catch (error) {
        console.error('Database error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch ministry' },
            { status: 500 }
        )
    }
}
