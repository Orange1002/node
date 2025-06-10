import express from 'express'
import db from '../../config/mysql.js'

const router = express.Router()

router.post('/', async (req, res) => {
  const { memberId } = req.body
  console.log('收到的 memberId:', memberId)

  if (!memberId) {
    return res.status(400).json({ error: '缺少會員 ID' })
  }

  try {
    // 1. 抓該會員所有訂單，並加上付款與狀態名稱
    const [orders] = await db.execute(
      `
      SELECT 
        o.*,
        op.name AS order_payment_name,
        os.name AS order_status_name
      FROM orders o
      LEFT JOIN order_payment op ON o.order_payment_id = op.id
      LEFT JOIN order_status os ON o.order_status_id = os.id
      WHERE o.member_id = ?
      ORDER BY o.order_number DESC
      `,
      [memberId]
    )

    if (orders.length === 0) {
      return res.json([])
    }

    // 2. 取得所有訂單 id
    const orderIds = orders.map((o) => o.id)
    const placeholders = orderIds.map(() => '?').join(',')

    // 3. 抓所有訂單的 order_items
    const [items] = await db.execute(
      `SELECT * FROM order_items WHERE order_id IN (${placeholders})`,
      orderIds
    )

    // 4. 抓所有訂單的 order_services，並串上 sitter_name 和 dog_name
    const [services] = await db.execute(
      `
      SELECT 
        os.*,
        s.name AS sitter_name,
        d.name AS dog_name
      FROM order_services os
      LEFT JOIN sitters s ON os.sitter_id = s.id
      LEFT JOIN dogs d ON os.dogs_id = d.id
      WHERE os.order_id IN (${placeholders})
      `,
      orderIds
    )

    // 5. 將 items 和 services 按 order_id 分組
    const orderItemsMap = {}
    const orderServicesMap = {}

    items.forEach((item) => {
      if (!orderItemsMap[item.order_id]) orderItemsMap[item.order_id] = []
      orderItemsMap[item.order_id].push(item)
    })

    services.forEach((service) => {
      if (!orderServicesMap[service.order_id])
        orderServicesMap[service.order_id] = []
      orderServicesMap[service.order_id].push(service)
    })

    // 6. 整合每筆訂單的明細資料
    const ordersWithDetails = orders.map((order) => ({
      ...order,
      items: orderItemsMap[order.id] || [],
      services: orderServicesMap[order.id] || [],
    }))

    console.log('組合後的訂單資料:', JSON.stringify(ordersWithDetails, null, 2))

    // 7. 回傳前端
    res.json(ordersWithDetails)
  } catch (error) {
    console.error('訂單查詢錯誤:', error)
    res.status(500).json({ error: '伺服器錯誤' })
  }
})

export default router
