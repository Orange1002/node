import express from 'express'
import tryAuth from '../../middlewares/tryAuth.js'
import {
  deleteCoupon,
  updateCoupon,
  createCoupon,
} from '../../services/coupon.js'
const router = express.Router()

import {
  getCoupons,
  getCouponById,
  claimCoupon,
  useCoupon,
} from '../../services/coupon.js'

import { successResponse, errorResponse } from '../../lib/utils.js'

// 取得所有優惠券
router.get('/', tryAuth, async (req, res) => {
  try {
    const coupons = await getCoupons()
    successResponse(res, { coupons })
  } catch (error) {
    errorResponse(res, error)
  }
})

// 取得單一優惠券
router.get('/:id', tryAuth, async (req, res) => {
  try {
    const couponId = Number(req.params.id)
    const memberId = req.member?.id || null
    const { coupon, products } = await getCouponById(couponId, memberId)
    successResponse(res, { coupon, products })
  } catch (error) {
    errorResponse(res, error)
  }
})

// 領取優惠券
router.post('/:id/claim', tryAuth, async (req, res) => {
  try {
    const couponId = Number(req.params.id)
    const memberId = req.member.id
    const result = await claimCoupon(memberId, couponId)
    successResponse(res, { result })
  } catch (error) {
    errorResponse(res, error)
  }
})

// 使用優惠券
router.post('/:id/use', tryAuth, async (req, res) => {
  try {
    const couponId = Number(req.params.id)
    const memberId = req.member.id
    const result = await useCoupon(memberId, couponId)
    successResponse(res, { result })
  } catch (error) {
    errorResponse(res, error)
  }
})

export default router
// 新增優惠券
router.post('/', async (req, res) => {
  try {
    const newCoupon = await createCoupon(req.body)
    successResponse(res, { coupon: newCoupon })
  } catch (error) {
    errorResponse(res, error)
  }
})

// 修改優惠券
router.put('/:id', async (req, res) => {
  try {
    const couponId = Number(req.params.id)
    const updated = await updateCoupon(couponId, req.body)
    successResponse(res, { coupon: updated })
  } catch (error) {
    errorResponse(res, error)
  }
})

// 刪除優惠券
router.delete('/:id', async (req, res) => {
  try {
    const couponId = Number(req.params.id)
    const deleted = await deleteCoupon(couponId)
    successResponse(res, { coupon: deleted })
  } catch (error) {
    errorResponse(res, error)
  }
})
