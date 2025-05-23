import express from 'express'
import db from '../../config/mysql.js'

const router = express.Router()

export const createOrder = async (req, res) => {
  try {
    const {
      memberId,
      recipientName,
      recipientPhone,
      recipientEmail,
      deliveryMethod,
      recipientCity,
      recipientTown,
      recipientAddress,
      storeName,
      storeAddress,
      paymentMethod,
      totalAmount,
      orderItems,
      orderServices,
    } = req.body

    console.log('收到的 orderData:', req.body)

    if (
      !recipientName ||
      !recipientPhone ||
      !recipientEmail ||
      !deliveryMethod ||
      totalAmount == null ||
      !Array.isArray(orderItems) ||
      !Array.isArray(orderServices)
    ) {
      return res
        .status(400)
        .json({ success: false, message: '缺少必要訂單欄位' })
    }

    // 建立 orders 主表
    const [orderResult] = await db.execute(
      `INSERT INTO orders (member_id,
        recipient_name, recipient_phone, recipient_email,
        delivery_method, city, town, address,
        store_name, store_address,
        order_payment_id, total_amount,
        order_status_id, created_at
      ) VALUES (?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '1', NOW())`,
      [
        memberId,
        recipientName,
        recipientPhone,
        recipientEmail,
        deliveryMethod,
        recipientCity,
        recipientTown,
        recipientAddress,
        storeName,
        storeAddress,
        paymentMethod,
        totalAmount,
      ]
    )

    const orderId = orderResult.insertId

    // 新增 order_items
    for (const item of orderItems) {
      if (item.product_id == null || item.count == null || item.price == null) {
        continue
      }

      await db.execute(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES (?, ?, ?, ?)`,
        [orderId, item.product_id, item.count, item.price]
      )
    }

    // 新增 order_services
    for (const service of orderServices) {
      if (
        service.sitter_id == null ||
        !service.pet_id ||
        service.price == null
      ) {
        continue
      }

      await db.execute(
        `INSERT INTO order_services (order_id, sitter_id, pet_id, start_time, end_time, price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          service.sitter_id,
          service.pet_id,
          service.start_time,
          service.end_time,
          service.price,
        ]
      )
    }

    return res.status(201).json({
      success: true,
      message: '訂單建立成功',
      orderId,
    })
  } catch (error) {
    console.error('建立訂單時發生錯誤：', error)
    return res.status(500).json({
      success: false,
      message: '訂單建立失敗',
    })
  }
}

// 將路由設置為 POST /api/order
router.post('/', createOrder)

export default router
