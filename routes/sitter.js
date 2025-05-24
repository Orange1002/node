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
  try {
    const [rows] = await db.query(`
      SELECT id, name, avatar_url, rating, introduction
      FROM sitters
    `)
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
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
    { name: 'gallery', maxCount: 2 },
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
