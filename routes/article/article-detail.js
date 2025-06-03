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

// GET 所有文章（支援搜尋 title/content1 和分類 category_name）
router.get('/', async (req, res) => {
  const { keyword, category_name, member_id } = req.query

  // 預設查詢條件與參數
  let sql = `
    SELECT a.*, 
           COUNT(af.id) AS favorite_count
    FROM article a
    LEFT JOIN article_favorites af ON a.id = af.article_id
  `
  let conditions = []
  let params = []

  if (keyword) {
    // 關鍵字搜尋：標題或內容含關鍵字
    conditions.push(`(a.title LIKE ? OR a.content1 LIKE ?)`)
    params.push(`%${keyword}%`, `%${keyword}%`)
  }
  if (category_name) {
    // 新增分類搜尋條件
    conditions.push(`a.category_name = ?`)
    params.push(category_name)
  }

  // 新增 member_id 篩選條件
  if (member_id) {
    conditions.push(`a.member_id = ?`)
    params.push(member_id)
  }
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ')
  }

  sql += ' GROUP BY a.id ORDER BY a.created_date DESC'

  try {
    const [rows] = await db.query(sql, params)
    res.json({ success: true, result: rows })
  } catch (err) {
    console.error('GET /article 錯誤:', err)
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
    const [rows] = await db.query(
      `SELECT
         a.*,
         m.image_url AS member_image_url,
         d.dogs_images AS dogs_image_url,
         m.username AS member_username,
         d.name AS dogs_name,
         d.breed AS dogs_breed
       FROM bark_bijou.article a
       LEFT JOIN member m ON a.member_id = m.id
       LEFT JOIN dogs d ON d.member_id = m.id
       WHERE a.id = ?`,
      [id]
    )
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

  try {
    // 取得該會員的第一隻狗 ID
    const [dogRows] = await db.query(
      'SELECT id FROM dogs WHERE member_id = ? LIMIT 1',
      [memberId]
    )
    const dogId = dogRows[0]?.id || null

    // 上傳的文章圖片處理
    const imagePaths = req.files.map(
      (file) => `/article_upload/${file.filename}`
    )
    const imagesJson = JSON.stringify(imagePaths)

    // 寫入資料庫，只存 member_id 和 dogs_id，不存圖片路徑
    const sql = `
      INSERT INTO bark_bijou.article
      (title, content1, category_name, article_images, created_date, member_id, dogs_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    const [result] = await db.query(sql, [
      title,
      content1,
      category,
      imagesJson,
      created_date,
      memberId,
      dogId,
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
