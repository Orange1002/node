// controllers/sitterBookingController.js
import db from '../config/mysql.js'

export const createSitterBooking = async (req, res) => {
  const memberId = req.member.id
  const { sitterId, startDate, endDate, petId } = req.body

  if (!startDate || !endDate || !petId) {
    return res.status(400).json({ status: 'error', message: '缺少必要欄位' })
  }

  try {
    // 1️⃣ 寫入預約
    const [result] = await db.query(
      'INSERT INTO sitter_bookings (user_id, sitter_id, pet_id, start_time, end_time) VALUES (?, ?, ?, ?, ?)',
      [memberId, sitterId, petId, startDate, endDate]
    )

    const bookingId = result.insertId

    // 2️⃣ 查詢詳細資料
    const [details] = await db.query(
      `SELECT 
         sb.id AS booking_id,
         m.username,
         m.email,
         d.name AS dog_name,
         s.name AS sitter_name,
         sb.start_time AS start_date,
         sb.end_time AS end_date
       FROM sitter_bookings sb
       JOIN member m ON sb.user_id = m.id
       JOIN dogs d ON sb.pet_id = d.id
       JOIN sitters s ON sb.sitter_id = s.id
       WHERE sb.id = ?`,
      [bookingId]
    )

    if (!Array.isArray(details) || details.length === 0) {
      return res
        .status(404)
        .json({ status: 'error', message: '找不到預約資料' })
    }

    const { username, dog_name, sitter_name, start_date, end_date } = details[0]

    // 3️⃣ 寫入通知（正確對應欄位）
    const content = `您已成功預約 ${sitter_name} 的服務，寵物：${dog_name}，期間：${start_date} ~ ${end_date}`
    await db.query(
      `INSERT INTO notifications (member_id, content, is_read) VALUES (?, ?, 0)`,
      [memberId, content]
    )

    // 4️⃣ 回傳結果
    res.json({ status: 'success', booking: details[0] })
  } catch (err) {
    console.error('預約失敗:', err)
    res.status(500).json({ status: 'error', message: '預約失敗，請稍後再試' })
  }
}
