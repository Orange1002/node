import db from '../config/mysql.js'

export async function getFavoriteProductsByMember(memberId) {
  const sql = `
SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.price AS product_price,
  pi.image AS primary_image
FROM product_favorites pf
JOIN product p ON pf.product_id = p.id
LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
WHERE pf.member_id = ?
ORDER BY pf.created_at DESC
  `

  try {
    const [rows] = await db.query(sql, [memberId])
    return rows
  } catch (error) {
    console.error('DB 查詢錯誤：', error)
    throw error
  }
}
