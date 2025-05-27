// routes/reply.js
import express from 'express'
import mysql from 'mysql2/promise'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

dotenv.config() // 載入 .env 變數

const router = express.Router()

// 建立資料庫連線池
const pool = mysql.createPool({
    host: 'localhost',
    user: 'admin',
    password: '12345',
    database: 'bark_bijou',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
})

// 從 .env 拿 JWT 密鑰
const jwtSecret = process.env.JWT_SECRET

// JWT 驗證中介軟體，從 cookie 讀取 accessToken
function authMiddleware(req, res, next) {
    const token = req.cookies?.accessToken
    if (!token) {
        return res.status(401).json({ message: '未登入' })
    }

    try {
        const user = jwt.verify(token, jwtSecret)
        req.user = user
        next()
    } catch (err) {
        return res.status(401).json({ message: 'Token 無效' })
    }
}

// 取得某文章的留言和回覆（兩層結構）
router.get('/comments', async (req, res) => {
    const articleId = req.query.article_id
    if (!articleId) return res.status(400).json({ message: '缺少 article_id' })

    try {
        const [comments] = await pool.query(
            `SELECT r.id, r.content, r.created_date, r.member_id, m.username AS author
       FROM reply r
       JOIN member m ON r.member_id = m.id
       WHERE r.article_id = ? AND r.parent_id IS NULL
       ORDER BY r.created_date DESC`,
            [articleId]
        )

        const [replies] = await pool.query(
            `SELECT r.id, r.content, r.created_date, r.member_id, r.parent_id, m.username AS author
       FROM reply r
       JOIN member m ON r.member_id = m.id
       WHERE r.article_id = ? AND r.parent_id IS NOT NULL
       ORDER BY r.created_date ASC`,
            [articleId]
        )

        // 將回覆依 parent_id 分組
        const replyMap = {}
        replies.forEach(r => {
            if (!replyMap[r.parent_id]) replyMap[r.parent_id] = []
            replyMap[r.parent_id].push(r)
        })

        // 將回覆塞入對應留言
        const result = comments.map(comment => ({
            ...comment,
            replies: replyMap[comment.id] || [],
        }))

        res.json(result)
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: '伺服器錯誤' })
    }
})

// 新增留言或回覆（需登入）
router.post('/comments', authMiddleware, async (req, res) => {
    const { article_id, content, parent_id } = req.body
    const member_id = req.user.id

    if (!article_id || !content) {
        return res.status(400).json({ message: '缺少必要欄位' })
    }

    try {
        const [result] = await pool.query(
            `INSERT INTO reply (content, member_id, article_id, parent_id) VALUES (?, ?, ?, ?)`,
            [content, member_id, article_id, parent_id || null]
        )

        res.status(201).json({ message: '留言成功', replyId: result.insertId })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: '伺服器錯誤' })
    }
})

export default router
