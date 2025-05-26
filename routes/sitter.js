import express from 'express'
import { createSitterBooking } from '../controllers/sitterBookingController.js'
import {
  createSitter,
  updateSitter,
  deleteSitter,
  getMemberSitter,
} from '../controllers/sitterController.js'
import upload from '../middlewares/upload.js'
import authenticate from '../middlewares/authenticate.js' // ✅ 記得加上驗證

const router = express.Router()

// 導入回應函式
// import { successResponse, errorResponse } from '../lib/utils.js'
import db from '../config/mysql.js'

router.get('/manage', authenticate, getMemberSitter)
// 新增評論
router.post('/:id/reviews', authenticate, async (req, res) => {
  const sitterId = req.params.id
  const memberId = req.member.id
  const { rating, comment } = req.body

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: '請提供 1~5 的評分' })
  }

  try {
    // 檢查是否預約過該保母
    const [bookings] = await db.execute(
      `SELECT * FROM sitter_bookings WHERE member_id = ? AND sitter_id = ?`,
      [memberId, sitterId]
    )

    if (bookings.length === 0) {
      return res.status(403).json({ message: '只有預約過的會員才能留下評論' })
    }

    // 檢查是否已經寫過評論
    const [existingReviews] = await db.execute(
      `SELECT * FROM reviews WHERE member_id = ? AND sitter_id = ?`,
      [memberId, sitterId]
    )

    if (existingReviews.length > 0) {
      return res
        .status(409)
        .json({ message: '你已經評論過這位保母了，無法重複評價' })
    }

    // 寫入新評論
    await db.execute(
      `INSERT INTO reviews (member_id, sitter_id, rating, comment)
       VALUES (?, ?, ?, ?)`,
      [memberId, sitterId, rating, comment]
    )

    return res.json({ message: '評論已新增成功' })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: '伺服器錯誤，請稍後再試' })
  }
})

router.get('/', async (req, res) => {
  const { search = '', sort = 'rating', page = 1, pageSize = 12 } = req.query

  const offset = (parseInt(page) - 1) * parseInt(pageSize)

  // 排序欄位映射
  const allowedSorts = ['rating', 'price', 'area']
  const sortKey = allowedSorts.includes(sort) ? sort : 'rating'
  const sortDirection = ['price', 'area'].includes(sortKey) ? 'ASC' : 'DESC'

  // 因為 rating 是動態計算，所以要特別處理排序欄位
  const sortQuery =
    sortKey === 'rating'
      ? `average_rating ${sortDirection}`
      : `${sortKey} ${sortDirection}`

  const hasSearch = search.trim() !== ''
  const searchSQL = hasSearch
    ? `WHERE s.name LIKE ? OR s.area LIKE ? OR s.introduction LIKE ?`
    : ''
  const searchParams = hasSearch
    ? [`%${search}%`, `%${search}%`, `%${search}%`]
    : []

  try {
    // 總筆數查詢不需 JOIN
    const [countResult] = await db.query(
      `SELECT COUNT(*) AS total FROM sitters s ${searchSQL}`,
      searchParams
    )
    const total = countResult[0]?.total || 0

    // 主查詢：JOIN reviews，計算平均 rating
    const [rows] = await db.query(
      `
      SELECT 
        s.id, s.name, s.area, s.price, s.avatar_url, s.introduction,
        IFNULL(ROUND(AVG(r.rating), 1), 0) AS average_rating
      FROM sitters s
      LEFT JOIN reviews r ON s.id = r.sitter_id
      ${searchSQL}
      GROUP BY s.id
      ORDER BY ${sortQuery}
      LIMIT ? OFFSET ?
      `,
      [...searchParams, parseInt(pageSize), offset]
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

// GET /api/sitters/:id
router.get('/:id', async (req, res) => {
  const sitterId = req.params.id

  try {
    // 保母主資料
    const [sitterRows] = await db.query('SELECT * FROM sitters WHERE id = ?', [
      sitterId,
    ])
    if (sitterRows.length === 0) {
      return res.status(404).json({ message: 'Sitter not found' })
    }
    const sitter = sitterRows[0]

    // 圖片集
    const [galleryRows] = await db.query(
      'SELECT image_url FROM sitter_gallery WHERE sitter_id = ?',
      [sitterId]
    )

    // 所有留言（rating + comment）
    // 多抓 username + created_at
    const [reviewRows] = await db.query(
      `SELECT r.rating, r.comment, r.created_at, m.username
   FROM reviews r
   JOIN member m ON r.member_id = m.id
   WHERE r.sitter_id = ?
   ORDER BY r.created_at DESC`,
      [sitterId]
    )

    // 平均與總數
    const [avgRow] = await db.query(
      'SELECT AVG(rating) AS average_rating, COUNT(*) AS review_count FROM reviews WHERE sitter_id = ?',
      [sitterId]
    )

    res.json({
      ...sitter,
      gallery: galleryRows.map((row) => row.image_url),
      reviews: reviewRows,
      average_rating: avgRow[0].average_rating || 0,
      review_count: avgRow[0].review_count || 0,
      canReview: true, // 這可根據是否曾預約改寫
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// 新增保母（包含大頭照 + 其他圖片）
router.post(
  '/',
  authenticate,
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    // { name: 'gallery', maxCount: 2 },
  ]),
  createSitter
)
// 更新保母
router.put(
  '/:id',
  authenticate,
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'gallery', maxCount: 2 },
  ]),
  updateSitter
)
router.delete('/:id', authenticate, deleteSitter)

export default router
