import express from 'express'
import db from '../../config/mysql.js'

const router = express.Router()

router.get('/', async (req, res) => {
  const memberId = req.query.memberId

  if (!memberId) return res.status(400).json({ message: '缺少會員 ID' })

  try {
    const [rows] = await db.query(
      `SELECT 
         c.id, 
         c.title, 
         c.discount_type, 
         c.discount_value, 
         c.min_purchase, 
         c.end_at,
         c.usage_type_id,
         cut.name AS usage_type_name,
         ci.image,
         ccm.category_id
       FROM member_coupons mc
       JOIN coupons c ON mc.coupon_id = c.id
       LEFT JOIN coupon_images ci ON c.id = ci.coupon_id
       LEFT JOIN coupon_usage_types cut ON c.usage_type_id = cut.id
       LEFT JOIN category_coupon_map ccm ON c.id = ccm.coupon_id
       WHERE mc.member_id = ? 
         AND mc.used_at IS NULL
         AND c.enabled = 1`,
      [memberId]
    )

    console.log('優惠券資料：', rows)
    res.json(rows)
  } catch (err) {
    console.error('取得優惠券失敗:', err)
    res.status(500).json({ message: '伺服器錯誤' })
  }
})

export default router
