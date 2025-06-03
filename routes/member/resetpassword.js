import express from 'express'
import bcrypt from 'bcrypt'
import db from '../../config/mysql.js'
import { body, validationResult } from 'express-validator'

const router = express.Router()

// 驗證規則
const validateResetPassword = [
  body('secret').notEmpty().withMessage('缺少驗證用 secret'),
  body('otpToken').notEmpty().withMessage('缺少驗證碼'),
  body('newPassword').isLength({ min: 6 }).withMessage('新密碼長度至少 6 碼'),
]

router.post('/', validateResetPassword, async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: '欄位驗證未通過',
      errors: errors.array().map((e) => ({
        field: e.param,
        reason: e.msg,
      })),
    })
  }

  const { secret, otpToken, newPassword } = req.body

  try {
    const [rows] = await db.query(
      'SELECT id FROM member WHERE reset_token = ? AND reset_token_secret = ? AND reset_token_expiry > NOW()',
      [otpToken, secret]
    )

    if (rows.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: '驗證碼錯誤或已過期',
        errors: [{ field: 'otpToken', reason: '驗證碼錯誤或已過期' }],
      })
    }

    const memberId = rows[0].id
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await db.query(
      'UPDATE member SET password = ?, reset_token = NULL, reset_token_expiry = NULL, reset_token_secret = NULL WHERE id = ?',
      [hashedPassword, memberId]
    )

    return res.json({
      status: 'success',
      message: '密碼已成功重設，請重新登入',
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({
      status: 'error',
      message: '伺服器錯誤',
    })
  }
})

export default router
