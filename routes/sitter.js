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
import { successResponse, errorResponse } from '../lib/utils.js'
import db from '../config/mysql.js'

router.get('/manage', authenticate, getMemberSitter)

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
    const [sitterRows] = await db.query('SELECT * FROM sitters WHERE id = ?', [
      sitterId,
    ])
    if (sitterRows.length === 0) {
      return res.status(404).json({ message: 'Sitter not found' })
    }

    const sitter = sitterRows[0]

    const [galleryRows] = await db.query(
      'SELECT image_url FROM sitter_gallery WHERE sitter_id = ?',
      [sitterId]
    )
    const [reviewRows] = await db.query(
      'SELECT content FROM sitter_reviews WHERE sitter_id = ?',
      [sitterId]
    )

    res.json({
      ...sitter,
      gallery: galleryRows.map((row) => row.image_url),
      reviews: reviewRows.map((row) => row.content),
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
