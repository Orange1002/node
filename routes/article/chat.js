import express from 'express'
import authenticate from '../../middlewares/authenticate.js' // 你的驗證中介軟體

const router = express.Router()

// 只有會員可以看歷史訊息
router.get('/messages', authenticate, (req, res) => {
  // 驗證通過後，req.user 通常會有會員資料
  res.json({
    success: true,
    messages: req.messages || [],
  })
})

export default router