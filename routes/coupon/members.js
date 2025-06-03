import express from 'express'
import {
  getMemberCoupons,
  getAvailableCoupons,
  getUsedCoupons,
  getClaimableCoupons,
  claimCoupon,
} from '../../services/coupon.js'
import { successResponse, errorResponse } from '../../lib/utils.js'

const router = express.Router()

// GET /api/coupon/members/:memberId/coupons
router.get('/:memberId/coupons', async (req, res) => {
  try {
    const memberId = Number(req.params.memberId)
    const result = await getMemberCoupons(memberId)
    successResponse(res, result)
  } catch (error) {
    errorResponse(res, error)
  }
})

export default router
router.get('/:memberId/coupons/available', async (req, res) => {
  try {
    const memberId = Number(req.params.memberId)
    const result = await getAvailableCoupons(memberId)
    successResponse(res, { coupons: result })
  } catch (error) {
    errorResponse(res, error)
  }
})
router.get('/:memberId/coupons/used', async (req, res) => {
  try {
    const memberId = Number(req.params.memberId)
    const result = await getUsedCoupons(memberId)
    successResponse(res, { coupons: result })
  } catch (error) {
    errorResponse(res, error)
  }
})
router.get('/:memberId/coupons/claimable', async (req, res) => {
  try {
    const memberId = Number(req.params.memberId)
    const result = await getClaimableCoupons(memberId)
    successResponse(res, { coupons: result })
  } catch (error) {
    errorResponse(res, error)
  }
})

router.post('/:memberId/claim/:couponId', async (req, res) => {
  try {
    const memberId = Number(req.params.memberId)
    const couponId = Number(req.params.couponId)
    const result = await claimCoupon(memberId, couponId)
    successResponse(res, { result })
  } catch (error) {
    errorResponse(res, error)
  }
})
