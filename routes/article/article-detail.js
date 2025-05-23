import express from 'express'
import multer from 'multer'
import path from 'path'
import db from '../../config/mysql.js'
import authenticate from '../../middlewares/authenticate.js' // 請依實際路徑調整

const router = express.Router()

// 設定 multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/article_upload/')
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const filename = `${Date.now()}-${Math.floor(Math.random() * 100000)}${ext}`
    cb(null, filename)
  },
})
const upload = multer({ storage })

// GET 所有文章
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM article')
    res.json({ success: true, result: rows })
  } catch (err) {
    console.error('GET /article-detail 錯誤:', err)
    res.status(500).json({ success: false, message: '資料庫抓取失敗' })
  }
})
// GET 登入會員自己的文章
router.get('/my-articles', authenticate, async (req, res) => {
  const memberId = req.member.id

  try {
    const [rows] = await db.query(
      'SELECT * FROM article WHERE member_id = ? ORDER BY created_date DESC',
      [memberId]
    )
    res.json({ success: true, result: rows })
  } catch (err) {
    console.error('GET /my-articles 錯誤:', err)
    res.status(500).json({ success: false, message: '資料庫錯誤' })
  }
})
// GET 單篇文章
router.get('/:id', async (req, res) => {
  const { id } = req.params

  try {
    const [rows] = await db.query('SELECT * FROM article WHERE id = ?', [id])
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '找不到該文章' })
    }
    res.json({ success: true, result: rows[0] })
  } catch (err) {
    console.error('GET /:id 錯誤:', err)
    res.status(500).json({ success: false, message: '資料庫錯誤' })
  }
})

// POST 新增文章（需會員認證）
router.post('/', authenticate, upload.array('images', 5), async (req, res) => {
  const memberId = req.member.id

  const { title, content1, category } = req.body
  const created_date = new Date()

  if (!title || !content1 || !category) {
    return res
      .status(400)
      .json({ success: false, message: '標題、內容與分類為必填' })
  }

  const imagePaths = req.files.map((file) => `/article_upload/${file.filename}`)
  const imagesJson = JSON.stringify(imagePaths)

  try {
    const sql = `
      INSERT INTO bark_bijou.article
      (title, content1, category_name, article_images, created_date, member_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    const [result] = await db.query(sql, [
      title,
      content1,
      category,
      imagesJson,
      created_date,
      memberId,
    ])
    res.json({ success: true, message: '文章新增成功', id: result.insertId })
  } catch (err) {
    console.error('POST /article-detail 錯誤:', err)
    res
      .status(500)
      .json({ success: false, message: '資料庫錯誤: ' + err.message })
  }
})

// PATCH 更新文章（需會員認證）
router.patch(
  '/update/:id',
  authenticate,
  upload.array('images', 5),
  async (req, res) => {
    const { id } = req.params
    const memberId = req.member.id
    const { title, content1, category } = req.body

    if (!title || !content1 || !category) {
      return res
        .status(400)
        .json({ success: false, message: '標題、內容與分類為必填' })
    }

    try {
      const [rows] = await db.query(
        'SELECT * FROM article WHERE id = ? AND member_id = ?',
        [id, memberId]
      )
      if (rows.length === 0) {
        return res
          .status(403)
          .json({ success: false, message: '你沒有權限修改此文章或文章不存在' })
      }

      // 處理圖片
      let imagePaths = null
      if (req.files && req.files.length > 0) {
        imagePaths = req.files.map((file) => `/article_upload/${file.filename}`)
      }

      // 動態組合 SQL
      let sql = `
        UPDATE article
        SET title = ?, content1 = ?, category_name = ?
      `
      const values = [title, content1, category]

      if (imagePaths) {
        sql += `, article_images = ?`
        values.push(JSON.stringify(imagePaths))
      }

      sql += ` WHERE id = ?`
      values.push(id)

      await db.query(sql, values)

      res.json({ success: true, message: '文章更新成功' })
    } catch (err) {
      console.error('PATCH /article-detail/update/:id 錯誤:', err)
      res.status(500).json({ success: false, message: '資料庫錯誤' })
    }
  }
)
// DELETE 刪除文章（需會員認證）
router.delete('/delete/:id', authenticate, async (req, res) => {
  const { id } = req.params
  const memberId = req.member.id

  try {
    // 先確認文章是否存在且屬於該會員
    const [rows] = await db.query(
      'SELECT * FROM article WHERE id = ? AND member_id = ?',
      [id, memberId]
    )
    if (rows.length === 0) {
      return res
        .status(403)
        .json({ success: false, message: '你沒有權限刪除此文章或文章不存在' })
    }

    // 執行刪除
    await db.query('DELETE FROM article WHERE id = ?', [id])

    res.json({ success: true, message: '文章刪除成功' })
  } catch (err) {
    console.error('DELETE /delete/:id 錯誤:', err)
    res.status(500).json({ success: false, message: '資料庫錯誤' })
  }
})
export default router

// import express from 'express'
// import multer from 'multer'
// import path from 'path'
// import db from '../../config/mysql.js'
// import authenticate from '../../middlewares/authenticate.js' // 請依實際路徑調整

// const router = express.Router()

// // 設定 multer
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'public/article_upload/')
//   },
//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname)
//     const filename = `${Date.now()}-${Math.floor(Math.random() * 100000)}${ext}`
//     cb(null, filename)
//   },
// })
// const upload = multer({ storage })

// // GET 所有文章
// router.get('/', async (req, res) => {
//   try {
//     const [rows] = await db.query('SELECT * FROM article')
//     res.json({ success: true, result: rows })
//   } catch (err) {
//     console.error('GET /article-detail 錯誤:', err)
//     res.status(500).json({ success: false, message: '資料庫抓取失敗' })
//   }
// })

// // GET 單篇文章
// router.get('/:id', async (req, res) => {
//   const { id } = req.params

//   try {
//     const [rows] = await db.query('SELECT * FROM article WHERE id = ?', [id])
//     if (rows.length === 0) {
//       return res.status(404).json({ success: false, message: '找不到該文章' })
//     }
//     res.json({ success: true, result: rows[0] })
//   } catch (err) {
//     console.error('GET /:id 錯誤:', err)
//     res.status(500).json({ success: false, message: '資料庫錯誤' })
//   }
// })

// // POST 新增文章（需會員認證）
// router.post('/', authenticate, upload.array('images', 5), async (req, res) => {
//   const memberId = req.member.id

//   const { title, content1, category } = req.body
//   const created_date = new Date()

//   if (!title || !content1 || !category) {
//     return res
//       .status(400)
//       .json({ success: false, message: '標題、內容與分類為必填' })
//   }

//   const imagePaths = req.files.map((file) => `/article_upload/${file.filename}`)
//   const imagesJson = JSON.stringify(imagePaths)

//   try {
//     const sql = `
//       INSERT INTO bark_bijou.article
//       (title, content1, category_name, article_images, created_date, member_id)
//       VALUES (?, ?, ?, ?, ?, ?)
//     `
//     const [result] = await db.query(sql, [
//       title,
//       content1,
//       category,
//       imagesJson,
//       created_date,
//       memberId,
//     ])
//     res.json({ success: true, message: '文章新增成功', id: result.insertId })
//   } catch (err) {
//     console.error('POST /article-detail 錯誤:', err)
//     res
//       .status(500)
//       .json({ success: false, message: '資料庫錯誤: ' + err.message })
//   }
// })

// // PATCH 更新文章（需會員認證）
// router.patch(
//   '/update/:id',
//   authenticate,
//   upload.array('images', 5),
//   async (req, res) => {
//     const { id } = req.params
//     const memberId = req.member.id
//     const { title, content1, category } = req.body

//     if (!title || !content1 || !category) {
//       return res
//         .status(400)
//         .json({ success: false, message: '標題、內容與分類為必填' })
//     }

//     try {
//       const [rows] = await db.query(
//         'SELECT * FROM article WHERE id = ? AND member_id = ?',
//         [id, memberId]
//       )
//       if (rows.length === 0) {
//         return res
//           .status(403)
//           .json({ success: false, message: '你沒有權限修改此文章或文章不存在' })
//       }

//       // 處理圖片
//       let imagePaths = null
//       if (req.files && req.files.length > 0) {
//         imagePaths = req.files.map((file) => `/article_upload/${file.filename}`)
//       }

//       // 動態組合 SQL
//       let sql = `
//         UPDATE article
//         SET title = ?, content1 = ?, category_name = ?
//       `
//       const values = [title, content1, category]

//       if (imagePaths) {
//         sql += `, article_images = ?`
//         values.push(JSON.stringify(imagePaths))
//       }

//       sql += ` WHERE id = ?`
//       values.push(id)

//       await db.query(sql, values)

//       res.json({ success: true, message: '文章更新成功' })
//     } catch (err) {
//       console.error('PATCH /article-detail/update/:id 錯誤:', err)
//       res.status(500).json({ success: false, message: '資料庫錯誤' })
//     }
//   }
// )
// export default router
