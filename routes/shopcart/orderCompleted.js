import express from 'express'
const router = express.Router()

// 接收付款成功的回傳資料
router.post(
  '/orderCompleted',
  express.urlencoded({ extended: false }),
  (req, res) => {
    // 所有綠界傳回的資料都會在 req.body 裡面
    const ecpayData = req.body

    console.log('收到綠界回傳資料:', ecpayData)
    res.redirect(`http://localhost:3000/shopcart/orderCompleted`)
  }
)

export default router
