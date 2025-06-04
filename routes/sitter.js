import express from 'express'
import db from '../config/mysql.js'
import upload from '../middlewares/upload.js'
import authenticate from '../middlewares/authenticate.js'

import {
  createSitter,
  updateSitter,
  deleteSitter,
  getMemberSitter,
} from '../controllers/sitterController.js'

const router = express.Router()

// 🔍 取得最新評論清單（全部保母）
router.get('/reviews', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        r.rating, r.comment, r.created_at,
        m.username, NULL AS avatar
      FROM reviews r
      JOIN member m ON r.member_id = m.id
      ORDER BY r.created_at DESC
      LIMIT 100
    `)
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '伺服器錯誤' })
  }
})

// 👤 取得登入會員的保母管理資料
router.get('/manage', authenticate, getMemberSitter)

// ✍️ 新增保母（含頭像）
router.post(
  '/',
  authenticate,
  upload.fields([{ name: 'avatar', maxCount: 1 }]),
  createSitter
)

// ✏️ 更新保母（頭像 + 圖片）
router.put(
  '/:id',
  authenticate,
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'gallery', maxCount: 2 },
  ]),
  updateSitter
)

// ❌ 刪除保母
router.delete('/:id', authenticate, deleteSitter)

// 📝 新增評論（需要登入與曾預約過）
router.post('/:id/reviews', authenticate, async (req, res) => {
  const sitterId = req.params.id
  const memberId = req.member.id
  const { rating, comment } = req.body

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: '請提供 1~5 的評分' })
  }

  try {
    const [bookings] = await db.execute(
      `SELECT id FROM sitter_bookings WHERE member_id = ? AND sitter_id = ?`,
      [memberId, sitterId]
    )

    if (bookings.length === 0) {
      return res.status(403).json({ message: '只有預約過的會員才能留下評論' })
    }

    const [existingReviews] = await db.execute(
      `SELECT id FROM reviews WHERE member_id = ? AND sitter_id = ?`,
      [memberId, sitterId]
    )

    if (existingReviews.length > 0) {
      return res
        .status(409)
        .json({ message: '你已經評論過這位保母了，無法重複評價' })
    }

    await db.execute(
      `INSERT INTO reviews (member_id, sitter_id, rating, comment)
       VALUES (?, ?, ?, ?)`,
      [memberId, sitterId, rating, comment]
    )

    res.json({ message: '評論已新增成功' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: '伺服器錯誤，請稍後再試' })
  }
})

// 📋 取得保母列表（搜尋 + 排序 + 分頁）
router.get('/', async (req, res) => {
  const {
    search = '',
    sort = 'rating',
    page = 1,
    pageSize = 12,
    area = '',
  } = req.query

  const offset = (parseInt(page) - 1) * parseInt(pageSize)
  const allowedSorts = ['rating', 'price', 'area']
  const sortKey = allowedSorts.includes(sort) ? sort : 'rating'
  const sortDirection = ['price', 'area'].includes(sortKey) ? 'ASC' : 'DESC'
  const sortQuery =
    sortKey === 'rating'
      ? `average_rating ${sortDirection}`
      : `${sortKey} ${sortDirection}`

  const conditions = []
  const values = []

  if (search.trim()) {
    conditions.push(`(s.name LIKE ? OR s.area LIKE ? OR s.introduction LIKE ?)`)
    values.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }

  if (area.trim()) {
    conditions.push(`s.area = ?`)
    values.push(area)
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  try {
    const [countResult] = await db.query(
      `SELECT COUNT(*) AS total FROM sitters s ${whereClause}`,
      values
    )
    const total = countResult[0]?.total || 0

    const [rows] = await db.query(
      `
      SELECT 
        s.id, s.name, s.area, s.price, s.avatar_url, s.introduction,
        IFNULL(ROUND(AVG(r.rating), 1), 0) AS average_rating
      FROM sitters s
      LEFT JOIN reviews r ON s.id = r.sitter_id
      ${whereClause}
      GROUP BY s.id
      ORDER BY ${sortQuery}
      LIMIT ? OFFSET ?
      `,
      [...values, parseInt(pageSize), offset]
    )

    const updatedRows = rows.map((sitter) => ({
      ...sitter,
      rating: sitter.average_rating,
      avatar_url:
        sitter.avatar_url && sitter.avatar_url.trim() !== ''
          ? sitter.avatar_url
          : '/images/default-avatar.png',
    }))

    res.json({
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      data: updatedRows,
    })
  } catch (err) {
    console.error('❌ 取得保母平均評分錯誤:', err)
    res.status(500).json({ message: '伺服器錯誤，請稍後再試' })
  }
})

// 📄 取得單一保母詳細資料
router.get('/:id', async (req, res) => {
  const sitterId = req.params.id
  const memberId = req.member?.id

  try {
    const [sitterRows] = await db.query('SELECT * FROM sitters WHERE id = ?', [
      sitterId,
    ])

    if (sitterRows.length === 0) {
      return res.status(404).json({ message: 'Sitter not found' })
    }

    const sitter = sitterRows[0]
    sitter.avatar_url =
      sitter.avatar_url && sitter.avatar_url.trim() !== ''
        ? sitter.avatar_url
        : '/images/default-avatar.png'

    const [galleryRows] = await db.query(
      'SELECT image_url FROM sitter_gallery WHERE sitter_id = ?',
      [sitterId]
    )

    const [reviewRows] = await db.query(
      `SELECT r.rating, r.comment, r.created_at, m.username
       FROM reviews r
       JOIN member m ON r.member_id = m.id
       WHERE r.sitter_id = ?
       ORDER BY r.created_at DESC`,
      [sitterId]
    )

    const [avgRow] = await db.query(
      `SELECT AVG(rating) AS average_rating, COUNT(*) AS review_count
       FROM reviews WHERE sitter_id = ?`,
      [sitterId]
    )

    let reviewStatus = 'unauthorized'
    if (memberId) {
      const [[booking]] = await db.query(
        `SELECT id FROM sitter_bookings WHERE member_id = ? AND sitter_id = ?`,
        [memberId, sitterId]
      )
      if (booking) {
        const [[existingReview]] = await db.query(
          `SELECT id FROM reviews WHERE member_id = ? AND sitter_id = ?`,
          [memberId, sitterId]
        )
        reviewStatus = existingReview ? 'already' : 'ok'
      }
    }

    res.json({
      ...sitter,
      gallery: galleryRows.map((r) => r.image_url),
      reviews: reviewRows,
      average_rating: avgRow[0]?.average_rating || 0,
      review_count: avgRow[0]?.review_count || 0,
      reviewStatus,
    })
  } catch (err) {
    console.error('❌ 錯誤取得保母資料:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
