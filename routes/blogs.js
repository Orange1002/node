import express from 'express'
const router = express.Router()

// 導入服務層的函式
import {
  getBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
} from '../services/blog.js'
// 導入回應函式
import { successResponse, errorResponse } from '../lib/utils.js'

// 得到所有部落格資料
// 網址: /api/blogs
router.get('/', async (req, res) => {
  try {
    // 需要加上await等待取得資料
    const blogs = await getBlogs()
    successResponse(res, { blogs })
  } catch (error) {
    errorResponse(res, error)
  }
})

// 得到單筆資料(注意，網址有動態參數時要寫在GET區段最後面)
// 網址: /api/blogs/:blogId
router.get('/:blogId', async (req, res) => {
  // 需要轉換成數字
  const blogId = Number(req.params.blogId)

  try {
    // 需要加上await等待取得資料
    const blog = await getBlogById(blogId)
    successResponse(res, { blog })
  } catch (error) {
    errorResponse(res, error)
  }
})

// 新增部落格資料
// 網址: /api/blogs
router.post('/', async (req, res) => {
  try {
    // 需要加上await等待新增完成
    await createBlog(req.body)
    // 成功新增的回應，沒有資料要回傳
    successResponse(res)
  } catch (error) {
    errorResponse(res, error)
  }
})

// 更新部落格資料 (註: PUT需要給定所有欄位的資料)
// 網址: /api/blogs/:blogId
// 範例:
// {
//   "title": "更新後的標題",
//   "content": "更新後的內容"
// }
router.put('/:blogId', async (req, res) => {
  // 需要轉換成數字
  const blogId = Number(req.params.blogId)

  try {
    // 需要加上await等待更新完成
    await updateBlog(blogId, req.body)
    // 成功更新的回應，沒有資料要回傳
    successResponse(res)
  } catch (error) {
    errorResponse(res, error)
  }
})

router.delete('/:blogId', async (req, res) => {
  // 需要轉換成數字
  const blogId = Number(req.params.blogId)

  try {
    // 需要加上await等待刪除完成
    await deleteBlog(blogId)
    // 成功刪除的回應
    successResponse(res)
  } catch (error) {
    errorResponse(res, error)
  }
})

export default router
