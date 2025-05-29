import express from 'express'
import db from '../../config/mysql.js'
import authenticate from '../../middlewares/authenticate.js'

const router = express.Router()

// 新增收藏
router.post('/add', authenticate, async (req, res) => {
    const memberId = req.member.id
    const { articleId } = req.body

    if (!articleId) {
        return res.status(400).json({ success: false, message: 'articleId 為必填欄位' })
    }

    try {
        const [articleRows] = await db.query('SELECT 1 FROM article WHERE id = ? LIMIT 1', [articleId])
        if (articleRows.length === 0) {
            return res.status(404).json({ success: false, message: '文章不存在' })
        }

        const [favoriteRows] = await db.query(
            'SELECT 1 FROM article_favorites WHERE member_id = ? AND article_id = ? LIMIT 1',
            [memberId, articleId]
        )
        if (favoriteRows.length > 0) {
            return res.status(409).json({ success: false, message: '已收藏此文章' })
        }

        await db.query('INSERT INTO article_favorites (member_id, article_id) VALUES (?, ?)', [
            memberId,
            articleId,
        ])

        const [countRows] = await db.query(
            'SELECT COUNT(*) AS favoriteCount FROM article_favorites WHERE article_id = ?',
            [articleId]
        )
        const favoriteCount = countRows[0].favoriteCount

        res.json({ success: true, message: '收藏成功', favoriteCount })
    } catch (err) {
        console.error('POST /article-favorites/add 錯誤:', err)
        res.status(500).json({ success: false, message: '資料庫錯誤' })
    }
})

// 查詢收藏狀態與收藏數量
router.get('/status/:articleId', authenticate, async (req, res) => {
    const memberId = req.member.id
    const articleId = req.params.articleId

    try {
        const [articleRows] = await db.query('SELECT 1 FROM article WHERE id = ? LIMIT 1', [articleId])
        if (articleRows.length === 0) {
            return res.status(404).json({ success: false, message: '文章不存在' })
        }

        const [favoriteRows] = await db.query(
            'SELECT 1 FROM article_favorites WHERE member_id = ? AND article_id = ? LIMIT 1',
            [memberId, articleId]
        )
        const isFavorited = favoriteRows.length > 0

        const [countRows] = await db.query(
            'SELECT COUNT(*) AS favoriteCount FROM article_favorites WHERE article_id = ?',
            [articleId]
        )
        const favoriteCount = countRows[0].favoriteCount

        res.json({ success: true, isFavorited, favoriteCount })
    } catch (err) {
        console.error('GET /article-favorites/status/:articleId 錯誤:', err)
        res.status(500).json({ success: false, message: '資料庫錯誤' })
    }
})

// 取消收藏
router.post('/remove', authenticate, async (req, res) => {
    const memberId = req.member.id
    const { articleId } = req.body

    if (!articleId) {
        return res.status(400).json({ success: false, message: 'articleId 為必填欄位' })
    }

    try {
        const [articleRows] = await db.query('SELECT 1 FROM article WHERE id = ? LIMIT 1', [articleId])
        if (articleRows.length === 0) {
            return res.status(404).json({ success: false, message: '文章不存在' })
        }

        const [favoriteRows] = await db.query(
            'SELECT 1 FROM article_favorites WHERE member_id = ? AND article_id = ? LIMIT 1',
            [memberId, articleId]
        )
        if (favoriteRows.length === 0) {
            return res.status(409).json({ success: false, message: '尚未收藏此文章' })
        }

        await db.query('DELETE FROM article_favorites WHERE member_id = ? AND article_id = ?', [
            memberId,
            articleId,
        ])

        const [countRows] = await db.query(
            'SELECT COUNT(*) AS favoriteCount FROM article_favorites WHERE article_id = ?',
            [articleId]
        )
        const favoriteCount = countRows[0].favoriteCount

        res.json({ success: true, message: '取消收藏成功', favoriteCount })
    } catch (err) {
        console.error('POST /article-favorites/remove 錯誤:', err)
        res.status(500).json({ success: false, message: '資料庫錯誤' })
    }
})
router.get('/top-favorites', async (req, res) => {
    try {
      const [rows] = await db.query(`
        SELECT a.*, IFNULL(f.favoriteCount, 0) AS favoriteCount
        FROM article a
        LEFT JOIN (
          SELECT article_id, COUNT(*) AS favoriteCount
          FROM article_favorites
          GROUP BY article_id
        ) f ON a.id = f.article_id
        ORDER BY favoriteCount DESC
        LIMIT 8
      `)
  
      res.json({ success: true, result: rows })
    } catch (error) {
      console.error('GET /article-popular/top-favorites 錯誤:', error)
      res.status(500).json({ success: false, message: '資料庫錯誤' })
    }
  })
  
export default router

