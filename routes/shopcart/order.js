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
      couponId,
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
        coupon_id, order_status_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '1', NOW())`,
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
        couponId,
      ]
    )

    const orderId = orderResult.insertId

    // 2. 從資料庫取訂單的 created_at 日期（'yyyy-mm-dd'）
    const [rows] = await db.execute(
      `SELECT DATE(created_at) as created_date FROM orders WHERE id = ?`,
      [orderId]
    )

    const createdDate = rows[0].created_date // '2025-05-31'

    const dateString = createdDate.replace(/-/g, '') // '20250531'

    const orderIdString = orderId.toString().padStart(3, '0')

    const orderNumber = `${dateString}${orderIdString}`

    // 更新訂單號碼
    await db.execute(`UPDATE orders SET order_number = ? WHERE id = ?`, [
      orderNumber,
      orderId,
    ])

    console.log('訂單建立完成，訂單號碼:', orderNumber)

    // 新增 order_items
    for (const item of orderItems) {
      if (item.product_id == null || item.count == null || item.price == null) {
        continue
      }

      await db.execute(
        `INSERT INTO order_items (order_id, product_id, name, image, color, size, packing, items_group, quantity, price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          item.product_id,
          item.name,
          item.image,
          item.color,
          item.size,
          item.packing,
          item.items_group,
          item.count,
          item.price,
        ]
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
        `INSERT INTO order_services (order_id, sitter_id, image, dogs_id, start_time, end_time, price)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          service.sitter_id,
          service.image,
          service.pet_id,
          service.start_time,
          service.end_time,
          service.price,
        ]
      )
    }

    // 刪除對應的優惠卷
    if (couponId !== 0) {
      await db.query(
        `UPDATE member_coupons SET used_at = NOW() WHERE member_id = ? AND coupon_id = ?`,
        [memberId, couponId]
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
