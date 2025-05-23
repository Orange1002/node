// controllers/sitterBookingController.js
import db from '../config/mysql.js'

export const createSitterBooking = async (req, res) => {
  const memberId = req.member.id //正式版 之後要改回來
  // const sitterId = req.params.id

  const { sitterId, startDate, endDate, petId } = req.body

  if (!startDate || !endDate || !petId) {
    return res.status(400).json({ status: 'error', message: '缺少必要欄位' })
  }

  try {
    // 新增預約紀錄
    const [result] = await db.query(
      'INSERT INTO sitter_bookings (user_id, sitter_id, pet_id, start_time, end_time) VALUES (?, ?, ?, ?, ?)',
      [memberId, sitterId, petId, startDate, endDate]
    )

    const bookingId = result.insertId

    // 查詢相關詳細資料
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

    res.json({ status: 'success', booking: details[0] })
  } catch (err) {
    console.error('預約失敗:', err)
    res.status(500).json({ status: 'error', message: '預約失敗，請稍後再試' })
  }
}
