import express from 'express'
const router = express.Router()
// 產生uuid用和hash字串用
import * as crypto from 'crypto'
// line pay使用npm套件
import { createLinePayClient } from 'line-pay-merchant'

// 存取`.env`設定檔案使用
import 'dotenv/config.js'

import { serverConfig } from '../config/server.config.js'
import { isDev, successResponse, errorResponse } from '../lib/utils.js'

// 定義安全的私鑰字串
const linePayClient = createLinePayClient({
  channelId: isDev
    ? serverConfig.linePay.development.channelId
    : serverConfig.linePay.production.channelId,
  channelSecretKey: isDev
    ? serverConfig.linePay.development.channelSecret
    : serverConfig.linePay.production.channelSecret,
  env: process.env.NODE_ENV,
})

// 設定重新導向與失敗導向的網址
const redirectUrls = {
  confirmUrl: isDev
    ? serverConfig.linePay.development.confirmUrl
    : serverConfig.linePay.production.confirmUrl,
  cancelUrl: isDev
    ? serverConfig.linePay.development.cancelUrl
    : serverConfig.linePay.production.cancelUrl,
}

// 回應line-pay交易網址到前端，由前端導向line pay付款頁面
// 資料格式參考 https://enylin.github.io/line-pay-merchant/api-reference/request.html#example
router.get('/reserve', async (req, res) => {
  // 只需要金額，其它都是範例資料
  const amount = req.query.amount

  // 使用目前最新的v3版本的API，以下是資料的說明:
  // https://pay.line.me/jp/developers/apis/onlineApis?locale=zh_TW

  // packages[]	是包裝的集合，每個包裝可以包含多個商品，以下(Y)是必要的欄位
  //
  // packages[].id	String	50	Y	Package list的唯一ID
  // packages[].amount	Number		Y	一個Package中的商品總價=sum(products[].quantity * products[].price)
  // packages[].userFee	Number		N	手續費：在付款金額中含手續費時設定
  // packages[].name	String	100	N	Package名稱 （or Shop Name）

  // products[]	是商品的集合，包含多個商品，以下有(Y)是必要的欄位
  //
  // packages[].products[].id	String	50	N	商家商品ID
  // packages[].products[].name	String	4000	Y	商品名
  // packages[].products[].imageUrl	String	500	N	商品圖示的URL
  // packages[].products[].quantity	Number		Y	商品數量
  // packages[].products[].price	Number		Y	各商品付款金額
  // packages[].products[].originalPrice	Number		N	各商品原金額

  // 要傳送給line pay的訂單資訊
  const order = {
    orderId: crypto.randomUUID(),
    currency: 'TWD',
    amount: amount,
    packages: [
      {
        id: crypto.randomBytes(5).toString('hex'),
        amount: amount,
        products: [
          {
            id: crypto.randomBytes(5).toString('hex'),
            name: '商品一批',
            quantity: 1,
            price: amount,
          },
        ],
      },
    ],
    options: { display: { locale: 'zh_TW' } },
    redirectUrls, // 設定重新導向與失敗導向的網址
  }

  if (isDev) console.log('訂單資料:', order)

  try {
    // 向line pay傳送的訂單資料
    const linePayResponse = await linePayClient.request.send({
      body: { ...order, redirectUrls },
    })

    // 深拷貝一份order資料
    const reservation = JSON.parse(JSON.stringify(order))

    reservation.returnCode = linePayResponse.body.returnCode
    reservation.returnMessage = linePayResponse.body.returnMessage
    reservation.transactionId = linePayResponse.body.info.transactionId
    reservation.paymentAccessToken =
      linePayResponse.body.info.paymentAccessToken

    if (isDev) console.log('預計付款記錄(Reservation):', reservation)

    // 記錄到session中(這裡是為了安全性，和一個簡單的範例，在實際應用中，應該也需要要存到資料庫妥善保管)
    req.session.reservation = reservation

    // 導向到付款頁面， line pay回應後會帶有info.paymentUrl.web為付款網址
    successResponse(res, {
      paymentUrl: linePayResponse.body.info.paymentUrl.web,
    })
  } catch (error) {
    errorResponse(res, error)
  }
})

// 付款完成後，導回前端同一畫面，之後由伺服器向Line Pay伺服器確認交易結果
// 格式參考: https://enylin.github.io/line-pay-merchant/api-reference/confirm.html#example
router.get('/confirm', async (req, res) => {
  // 網址上需要有transactionId
  const transactionId = req.query.transactionId

  if (!transactionId) {
    return errorResponse(res, '缺少交易編號')
  }

  if (!req.session.reservation) {
    return errorResponse(res, '沒有已記錄的付款資料')
  }

  // 從session得到交易金額
  const amount = req.session?.reservation?.amount

  try {
    // 最後確認交易
    const linePayResponse = await linePayClient.confirm.send({
      transactionId: transactionId,
      body: {
        currency: 'TWD',
        amount: amount,
      },
    })

    // linePayResponse.body回傳的資料
    if (isDev) console.log('line-pay confirm', linePayResponse)

    // 清除session中的reservation的資料
    if (req.session.reservation) delete req.session.reservation

    successResponse(res, { ...linePayResponse.body })
  } catch (error) {
    errorResponse(res, error)
  }
})

// 檢查交易用(查詢LINE Pay付款請求的狀態。商家應隔一段時間後直接檢查付款狀態)
router.get('/check-payment-status', async (req, res) => {
  const transactionId = req.query.transactionId

  try {
    const linePayResponse = await linePayClient.checkPaymentStatus.send({
      transactionId: transactionId,
      params: {},
    })

    // 範例:
    // {
    //   "body": {
    //     "returnCode": "0000",
    //     "returnMessage": "reserved transaction."
    //   },
    //   "comments": {}
    // }

    successResponse(res, { data: linePayResponse.body })
  } catch (error) {
    errorResponse(res, error)
  }
})

export default router
