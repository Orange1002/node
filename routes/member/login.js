import express from 'express'
import db from '../../config/mysql.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import dotenv from 'dotenv'

dotenv.config() // 載入 .env 環境變數
const accessTokenSecret = process.env.JWT_SECRET

const router = express.Router()

router.post('/', async (req, res) => {
  const { email, password } = req.body

  try {
    // 從資料庫查詢會員
    const [rows] = await db.query(
      `SELECT id, username, email, password, image_url FROM member WHERE email = ?`,
      [email]
    )

    if (rows.length === 0) {
      return res.status(401).json({ message: '帳號或密碼錯誤' })
    }

    const member = rows[0]

    // 驗證密碼
    const match = await bcrypt.compare(password, member.password)
    if (!match) {
      return res.status(401).json({ message: '帳號或密碼錯誤' })
    }

    // 產生 JWT
    const token = jwt.sign(
      {
        id: member.id,
        name: member.username,
        avatar: member.image_url, // 假設是圖片網址
      },
      accessTokenSecret,
      { expiresIn: '2h' }
    )

    // 放入 Cookie（HttpOnly）
    res.cookie('accessToken', token, {
      httpOnly: true,
      secure: false, // 你部署在 https 時記得改為 true
      sameSite: 'Lax',
      maxAge: 2 * 60 * 60 * 1000, // 2 小時
    })

    res.json({
      message: '登入成功',
      member: {
        id: member.id,
        name: member.username,
        email: member.email,
        image_url: member.image_url,
        vip_levels_id: member.vip_levels_id,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: '伺服器錯誤' })
  }
})

export default router
