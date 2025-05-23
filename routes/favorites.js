import express from 'express'
const router = express.Router()

import authenticate from '../middlewares/authenticate.js'
import {
  getMemberFavorites,
  addMemberFavorite,
  deleteUserFavorite,
} from '../services/member.js'
import { successResponse, errorResponse, isDev } from '../lib/utils.js'

// 獲得某會員id的有加入到我的最愛清單中的商品id們
// 此路由只有登入會員能使用
router.get('/', authenticate, async (req, res) => {
  // 取得會員id，從req.member.id取得(透過JWT解碼)
  const userId = req.member.id
  // 如果是開發環境，顯示訊息
  if (isDev) console.log('userId', userId)

  try {
    const favorites = await getMemberFavorites(userId)
    successResponse(res, { favorites })
  } catch (error) {
    errorResponse(res, error)
  }
})

router.put('/:productId', authenticate, async (req, res) => {
  // 取得商品id，從req.params.productId取得
  const productId = Number(req.params.productId)
  // 取得會員id，從req.member.id取得(透過JWT解碼)
  const userId = req.member.id
  // 如果是開發環境，顯示訊息
  if (isDev) console.log('productId', productId, 'userId', userId)

  try {
    await addMemberFavorite(userId, productId)
    successResponse(res)
  } catch (error) {
    errorResponse(res, error)
  }
})

router.delete('/:productId', authenticate, async (req, res) => {
  // 取得商品id，從req.params.productId取得
  const productId = Number(req.params.productId)
  // 取得會員id，從req.member.id取得(透過JWT解碼)
  const userId = req.member.id
  // 如果是開發環境，顯示訊息
  if (isDev) console.log('productId', productId, 'userId', userId)

  try {
    await deleteUserFavorite(userId, productId)
    successResponse(res)
  } catch (error) {
    errorResponse(res, error)
  }
})

export default router
