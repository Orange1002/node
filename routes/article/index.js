// import express from 'express'
// const router = express.Router()

// router.get("/home",  (req, res) => {
//     res.send("文章首頁")
// });

// router.get("/list",  (req, res) => {
//     res.send("文章列表")
// });
// router.get("/:id",  (req, res) => {
//     res.send("文章內容")
// });
// router.get("/eventpage",  (req, res) => {
//     res.send("活動專區")
// });

// export default router;
import express from 'express'

import db from '../../config/mysql.js'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1')
    res.json({ success: true, message: '資料庫連線成功', result: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '資料庫連線失敗' })
  }
})

export default router
