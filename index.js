import express from 'express'
import usersRouter from './routes/members.js'
import couponRouter from './routes/coupon.js'

const app = express()

app.get('/', (req, res) => {
  res.send('首頁')
})
// app.use(express.static('public'))

app.use('/users', usersRouter)

app.use('/coupon', couponRouter)


app.listen(3000, () => {
  console.log('伺服器已啟動 http://localhost:3000')
})
