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
    // Get member info with summary and most recent designation/constituency
    // Check both section_speakers and session_attendance
    const memberResult = await query(
      `SELECT 
              m.id, 
              m.name, 
              ms.summary,
              COALESCE(
                (
                  SELECT ss2.constituency 
                  FROM section_speakers ss2
                  JOIN sections s2 ON ss2.section_id = s2.id
                  JOIN sessions sess2 ON s2.session_id = sess2.id
                  WHERE ss2.member_id = m.id AND ss2.constituency IS NOT NULL
                  ORDER BY sess2.date DESC
                  LIMIT 1
                ),
                (
                  SELECT sa.constituency
                  FROM session_attendance sa
                  JOIN sessions sess ON sa.session_id = sess.id
                  WHERE sa.member_id = m.id AND sa.constituency IS NOT NULL
                  ORDER BY sess.date DESC
                  LIMIT 1
                )
              ) as constituency,
              COALESCE(
                (
                  SELECT ss3.designation 
                  FROM section_speakers ss3
                  JOIN sections s3 ON ss3.section_id = s3.id
                  JOIN sessions sess3 ON s3.session_id = sess3.id
                  WHERE ss3.member_id = m.id AND ss3.designation IS NOT NULL
                  ORDER BY sess3.date DESC
                  LIMIT 1
                ),
                (
                  SELECT sa2.designation
                  FROM session_attendance sa2
                  JOIN sessions sess4 ON sa2.session_id = sess4.id
                  WHERE sa2.member_id = m.id AND sa2.designation IS NOT NULL
                  ORDER BY sess4.date DESC
                  LIMIT 1
                )
              ) as designation
            FROM members m
            LEFT JOIN member_summaries ms ON m.id = ms.member_id
            WHERE m.id = $1`,
      [id]
    )

    if (memberResult.rows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const member = memberResult.rows[0]

    // Get questions this member spoke in (excluding bills)
    // Get questions this member spoke in (excluding bills)
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
              -- s.content_plain as "contentPlain", -- Optimization: Don't fetch full content
              s.category,
              m.acronym as ministry,
              sess.date as "sessionDate",
              ss.designation,
              ss.constituency
              ${qRankSelect}
            FROM section_speakers ss
            JOIN sections s ON ss.section_id = s.id
            JOIN sessions sess ON s.session_id = sess.id
            LEFT JOIN ministries m ON s.ministry_id = m.id
            WHERE ss.member_id = $1 AND s.section_type NOT IN ('BI', 'BP')`

    if (search) {
      questionsSql += ` AND (
            to_tsvector('english', s.content_plain) @@ plainto_tsquery('english', $${qParamCount - 1}) OR 
            s.section_title ILIKE $${qParamCount}
        )`
      questionsParams.push(`%${search}%`)
      qParamCount++
    }

    // Determine order clause for questions
    let qOrderBy = 'sess.date DESC, s.section_order ASC'
    if (sort === 'oldest') {
      qOrderBy = 'sess.date ASC, s.section_order ASC'
    } else if (sort === 'relevance' && search) {
      qOrderBy = 'rank DESC, sess.date DESC, s.section_order ASC'
    }

    questionsSql += ` ORDER BY ${qOrderBy} LIMIT 1000`

    const questionsResult = await query(questionsSql, questionsParams)

    // Get bills this member is involved in (BP sections only, with bill_id for linking)
    const billsParams: (string | number)[] = [id]
    let bParamCount = 2
    let bRankSelect = ''

    if (search) {
      billsParams.push(search)
      bRankSelect = `, ts_rank(to_tsvector('english', s.content_plain), plainto_tsquery('english', $${bParamCount})) as rank`
      bParamCount++
    }

    // Inner query to get distinct bills with rank
    let billsSql = `
        SELECT DISTINCT ON (s.bill_id)
            s.bill_id as "billId",
            s.section_type as "sectionType",
            s.section_title as "sectionTitle",
            m.acronym as ministry,
            sess.date as "sessionDate"
            ${bRankSelect}
        FROM section_speakers ss
        JOIN sections s ON ss.section_id = s.id
        JOIN sessions sess ON s.session_id = sess.id
        LEFT JOIN ministries m ON s.ministry_id = m.id
        WHERE ss.member_id = $1 AND s.section_type = 'BP' AND s.bill_id IS NOT NULL`

    if (search) {
      billsSql += ` AND (
            to_tsvector('english', s.content_plain) @@ plainto_tsquery('english', $${bParamCount - 1}) OR 
            s.section_title ILIKE $${bParamCount}
        )`
      billsParams.push(`%${search}%`)
      bParamCount++
    }

    // Determine sort for bills
    let bOrderBy = 's.bill_id, sess.date DESC'
    let bFinalOrderBy = 's.bill_id, sess.date DESC' // default without subquery

    if (sort === 'oldest') {
      bOrderBy = 's.bill_id, sess.date ASC'
      bFinalOrderBy = '"sessionDate" ASC'
    } else if (sort === 'relevance' && search) {
      bOrderBy = 's.bill_id, rank DESC, sess.date DESC'
      bFinalOrderBy = 'rank DESC, "sessionDate" DESC'
    } else {
      // newest / default
      bOrderBy = 's.bill_id, sess.date DESC'
      bFinalOrderBy = '"sessionDate" DESC'
    }

    // Wrap in subquery to sort correctly after DISTINCT ON
    billsSql = `SELECT * FROM (${billsSql} ORDER BY ${bOrderBy}) as sub 
                ORDER BY ${bFinalOrderBy} LIMIT 500`

    const billsResult = await query(billsSql, billsParams)

    return NextResponse.json({
      ...member,
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
      { error: 'Failed to fetch member' },
      { status: 500 }
    )
  }
}
