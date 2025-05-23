import express from 'express'

const router = express.Router()

router.post('/', (req, res) => {
  // 清除 cookie
  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: false, // 如果部署 https，改為 true
    sameSite: 'Lax',
  })

  res.json({ message: '登出成功' })
})

export default router
