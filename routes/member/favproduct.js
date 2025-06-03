// routes/favorites.js
import express from 'express'
import { getFavoriteProductsByMember } from '../../services/favoriteProduct.js'

const router = express.Router()

router.get('/', async (req, res) => {
  const memberId = Number(req.query.memberId)
  if (!memberId) {
    return res.status(401).json({ status: 'error', message: '缺少會員ID' })
  }

  try {
    const favoriteProducts = await getFavoriteProductsByMember(memberId)
    res.json({
      status: 'success',
      data: favoriteProducts,
    })
  } catch (error) {
    console.error('查詢收藏商品失敗:', error)
    res.status(500).json({ status: 'error', message: '資料庫查詢錯誤' })
  }
})

export default router
