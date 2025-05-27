export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' })
  }

  console.log('req.body:', req.body)

  const storeName = req.body.storename || ''
  const storeAddress = req.body.storeaddress || ''

  if (!storeName || !storeAddress) {
    return res.status(400).json({ message: '缺少門市資訊' })
  }

  const html = `
  <script>
    window.opener.postMessage({ storeName: "${storeName}", storeAddress: "${storeAddress}" }, "*");
    window.close();
  </script>
`
  res.setHeader('Content-Type', 'text/html')
  res.status(200).send(html)
}
