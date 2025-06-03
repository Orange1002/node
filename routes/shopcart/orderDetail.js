import express from 'express'
import db from '../../config/mysql.js'

const router = express.Router()

router.get('/', async (req, res) => {
  const { order_number } = req.query
  console.log('order_number為', order_number)

  if (!order_number) {
    return res.status(400).json({ error: '缺少 order_number' })
  }

  try {
    // 1. 先從 orders 表找出對應的 order
    const [orderRows] = await db.query(
      'SELECT * FROM orders WHERE order_number = ?',
      [order_number]
    )

    if (orderRows.length === 0) {
      return res.status(404).json({ error: '找不到對應的訂單' })
    }

    const order = orderRows[0]
    const orderId = order.id
    const paymentId = order.order_payment_id
    let paymentName = null
    const couponId = order.coupon_id
    let discount_type = null
    let discount_value = null

    // 2. 用 orderId 去找 order_items
    const [items] = await db.query(
      'SELECT * FROM order_items WHERE order_id = ?',
      [orderId]
    )

    // 3. 用 orderId 去找 order_services
    const [servicesRaw] = await db.query(
      'SELECT * FROM order_services WHERE order_id = ?',
      [orderId]
    )

    // 4. 整合 sitter 與 dog 名稱
    const services = await Promise.all(
      servicesRaw.map(async (service) => {
        const [[sitterRow]] = await db.query(
          'SELECT name FROM sitters WHERE id = ?',
          [service.sitter_id]
        )
        const [[dogRow]] = await db.query(
          'SELECT name FROM dogs WHERE id = ?',
          [service.dogs_id]
        )

        return {
          ...service,
          sitter_name: sitterRow ? sitterRow.name : null,
          dog_name: dogRow ? dogRow.name : null,
        }
      })
    )

    // 5. 抓取 優惠卷的值
    if (couponId) {
      const [couponRows] = await db.query(
        'SELECT discount_type, discount_value FROM coupons WHERE id = ?',
        [couponId]
      )

      if (couponRows.length > 0) {
        discount_type = couponRows[0].discount_type
        discount_value = couponRows[0].discount_value
      }
    }

    // 6. 抓取付款方式
    if (paymentId) {
      const [paymentRows] = await db.query(
        'SELECT name FROM order_payment WHERE id = ?',
        [paymentId]
      )

      if (paymentRows.length > 0) {
        paymentName = paymentRows[0].name
      }
    }

    res.json({
      order: {
        ...order,
        discount_type,
        discount_value,
        paymentName,
      },
      items,
      services,
      paymentName,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '伺服器錯誤，請稍後再試' })
  }
})

export default router
