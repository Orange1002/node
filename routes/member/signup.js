import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import db from '../../config/mysql.js'
import { body, validationResult } from 'express-validator'

const router = express.Router()

const validateSignup = [
  body('username').notEmpty().withMessage('請輸入使用者名稱'),
  body('email').isEmail().withMessage('請輸入正確的 Email'),
  body('password').isLength({ min: 6 }).withMessage('密碼長度至少 6 碼'),
  body('repassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('兩次密碼輸入不一致')
    }
    return true
  }),
]

const validateField = (field) => {
  switch (field) {
    case 'username':
      return body('value').notEmpty().withMessage('請輸入使用者名稱')
    case 'email':
      return body('value').isEmail().withMessage('請輸入正確的 Email')
    case 'password':
      return body('value').isLength({ min: 6 }).withMessage('密碼長度至少 6 碼')
    case 'repassword':
      return body('value').custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('兩次密碼輸入不一致')
        }
        return true
      })
    default:
      return (req, res, next) => next()
  }
}

router.post('/', validateSignup, async (req, res) => {
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

  const { username, email, password } = req.body

  try {
    const [rows] = await db.query('SELECT * FROM member WHERE email = ?', [
      email,
    ])
    if (rows.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: '此 Email 已被註冊',
        errors: [{ field: 'email', reason: '此 Email 已被註冊' }],
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const [insertResult] = await db.query(
      'INSERT INTO member (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    )

    const token = jwt.sign(
      { id: insertResult.insertId, email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    )

    res.cookie('accessToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    })

    res.status(201).json({
      status: 'success',
      message: '註冊成功',
      data: {
        id: insertResult.insertId,
        name: username,
        email,
      },
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ status: 'error', message: '伺服器錯誤' })
  }
})

router.post('/validate-field', async (req, res) => {
  const { field, value, password } = req.body

  if (!field) {
    return res.status(400).json({
      status: 'error',
      message: '缺少欄位名稱',
      errors: [{ field: null, reason: '缺少欄位名稱' }],
    })
  }

  req.body.value = value
  const middleware = validateField(field)
  await middleware(req, res, () => {})

  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: `${field} 驗證失敗`,
      errors: errors.array().map((e) => ({
        field: 'value',
        reason: e.msg,
      })),
    })
  }

  if (field === 'email') {
    try {
      const [rows] = await db.query('SELECT * FROM member WHERE email = ?', [
        value,
      ])
      if (rows.length > 0) {
        return res.status(409).json({
          status: 'error',
          message: '此 Email 已被註冊',
          errors: [{ field: 'email', reason: '此 Email 已被註冊' }],
        })
      }
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        status: 'error',
        message: '伺服器錯誤',
        errors: [{ field: null, reason: error.message }],
      })
    }
  }

  if (field === 'repassword') {
    if (value !== password) {
      return res.status(400).json({
        status: 'error',
        message: '兩次密碼輸入不一致',
        errors: [{ field: 'repassword', reason: '兩次密碼輸入不一致' }],
      })
    }
  }

  res.json({
    status: 'success',
    message: `${field} 驗證通過`,
  })
})

export default router
