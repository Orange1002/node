// import express from 'express'
// import db from '../../config/mysql.js'

export default function handler(req, res) {
  if (req.method === 'POST') {
    const orderData = req.body

    if (!orderData || Object.keys(orderData).length === 0) {
      console.log('收到空白的訂單')
    } else {
      console.log('收到的訂單資料：')
      console.log(orderData)
    }

    // 你可以在這裡做進一步驗證或儲存資料到資料庫

    // 假設回傳成功
    res.status(200).json({
      success: true,
      orderId: 'ORDER' + Date.now(), // 模擬產生訂單編號
    })
  } else {
    res.status(405).json({ success: false, message: 'Method Not Allowed' })
  }
}
