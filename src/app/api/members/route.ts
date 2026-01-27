import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search') || ''
  const constituency = searchParams.get('constituency')
  const limit = parseInt(searchParams.get('limit') || '20')
  const page = parseInt(searchParams.get('page') || '1')
  const offset = (page - 1) * limit

  try {
    const params: (string | number)[] = []
    let paramCount = 1
    let whereClause = '1=1'

    if (search) {
      whereClause += ` AND m.name ILIKE $${paramCount}`
      params.push(`%${search}%`)
      paramCount++
    }

    // CTE to get member constituencies efficiently for filtering
    const constituencyCTE = `
      WITH MemberConstituency AS (
        SELECT 
          m.id as member_id,
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
          ) as constituency
        FROM members m
      )
    `

    // If filtering by constituency, we need to join with the calculated constituency
    if (constituency) {
      whereClause += ` AND mc.constituency = $${paramCount}`
      params.push(constituency)
      paramCount++
    }

    // Get total count
    const countSql = `
      ${constituencyCTE}
      SELECT COUNT(*) as total 
      FROM members m
      LEFT JOIN MemberConstituency mc ON m.id = mc.member_id
      WHERE ${whereClause}
    `
    const countResult = await query(countSql, params)
    const total = parseInt(countResult.rows[0].total)

    // Determine sort order
    let orderBy = 'm.name ASC'
    const sort = searchParams.get('sort')
    if (sort === 'involvements') {
      orderBy = '"sectionCount" DESC, m.name ASC'
    } else if (sort === 'name_desc') {
      orderBy = 'm.name DESC'
    }

    // Get members data
    const sql = `
    ${constituencyCTE}
    SELECT 
      m.id,
      m.name,
      ms.summary,
      COUNT(DISTINCT ss.section_id) as "sectionCount",
      mc.constituency,
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
    LEFT JOIN MemberConstituency mc ON m.id = mc.member_id
    LEFT JOIN member_summaries ms ON m.id = ms.member_id
    LEFT JOIN section_speakers ss ON m.id = ss.member_id
    WHERE ${whereClause}
    GROUP BY m.id, m.name, ms.summary, mc.constituency
    ORDER BY ${orderBy}
    LIMIT $${paramCount} OFFSET $${paramCount + 1}
  `

    const dataParams = [...params, limit, offset]
    const result = await query(sql, dataParams)

    return NextResponse.json({
      members: result.rows,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    })
  } catch (error) {
    console.error('Database error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    )
  }
}
