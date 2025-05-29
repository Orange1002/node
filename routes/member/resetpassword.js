import express from 'express'
import bcrypt from 'bcrypt'
import db from '../../config/mysql.js'

const router = express.Router()

router.post('/', async (req, res) => {
  const { secret, otpToken, newPassword } = req.body
  if (!secret || !otpToken || !newPassword) {
    return res.status(400).json({ message: '缺少必要欄位' })
  }

  const [rows] = await db.query(
    'SELECT id FROM member WHERE reset_token = ? AND reset_token_secret = ? AND reset_token_expiry > NOW()',
    [otpToken, secret]
  )

  if (rows.length === 0) {
    return res.status(400).json({ message: '驗證碼錯誤或已過期' })
  }

  const memberId = rows[0].id
  const hashedPassword = await bcrypt.hash(newPassword, 10)

  await db.query(
    'UPDATE member SET password = ?, reset_token = NULL, reset_token_expiry = NULL, reset_token_secret = NULL WHERE id = ?',
    [hashedPassword, memberId]
  )

  return res.json({ message: '密碼已成功重設，請重新登入' })
})

export default router
