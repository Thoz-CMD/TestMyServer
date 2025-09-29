const express = require('express')
const bodyparser = require('body-parser')
const mysql = require('mysql2/promise')
const cors = require('cors')
require('dotenv').config()
const app = express()

app.use(bodyparser.json())
app.use(cors())

// Server port (will fallback if busy)
let port = parseInt(process.env.PORT || '8000', 10)

// Database configuration via environment variables (with sensible defaults)
const DB_HOST = process.env.DB_HOST || '127.0.0.1'
const DB_USER = process.env.DB_USER || 'root'
const DB_PASSWORD = process.env.DB_PASSWORD || 'root'
const DB_NAME = process.env.DB_NAME || 'webdb'
const DB_PORT = parseInt(process.env.DB_PORT || '8820', 10)

let pool = null

// Utility: normalize & validate a single field length
const limitLength = (val, max) => typeof val === 'string' ? val.substring(0, max) : val

// Initialize MySQL with retry logic (for when container is still starting)
const initMySQL = async (retries = 10, delayMs = 2000) => {
  if (pool) return pool
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      pool = mysql.createPool({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        port: DB_PORT,
        charset: 'utf8mb4_unicode_ci',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      })
      // Simple test query to verify connectivity
      await pool.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci")
      await pool.query('SELECT 1')
      console.log(`MySQL connected (attempt ${attempt})`) 
      return pool
    } catch (err) {
      console.error(`MySQL connection failed (attempt ${attempt}):`, err.code || err.message)
      if (attempt === retries) {
        throw err
      }
      await new Promise(r => setTimeout(r, delayMs))
    }
  }
}

const validateData = (userData) => {
  let errors = []
  // Trim
  ;['firstname','lastname','description'].forEach(k => { if (userData[k]) userData[k] = userData[k].toString().trim() })
  // Basic required
  if (!userData.firstname) errors.push('กรุณากรอกชื่อ')
  if (!userData.lastname) errors.push('กรุณากรอกนามสกุล')
  if (userData.age === undefined || userData.age === null || userData.age === '') errors.push('กรุณากรอกอายุ')
  if (userData.age && (isNaN(Number(userData.age)) || Number(userData.age) < 0 || Number(userData.age) > 120)) errors.push('อายุต้องเป็นตัวเลข 0-120')
  if (!userData.gender) errors.push('กรุณาเลือกเพศ')
  if (!userData.interests) errors.push('กรุณาเลือกความสนใจ')
  if (!userData.description) errors.push('กรุณากรอกคำอธิบาย')

  // Length limits
  userData.firstname = limitLength(userData.firstname, 255)
  userData.lastname = limitLength(userData.lastname, 255)
  userData.description = limitLength(userData.description, 1000)
  userData.interests = limitLength(userData.interests, 500)

  return errors
}

// Central async wrapper
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)



// path = GET /users สำหรับ get users ทั้งหมดที่บันทึกเข้าไปออกมา
app.get('/users', asyncHandler(async (req, res) => {
  const conn = await initMySQL()
  const [rows] = await conn.query('SELECT * FROM users')
  res.json(rows)
}))

// Root route (avoid 404 noise) - simple status
app.get('/', (req, res) => {
  res.json({ service: 'user-api', status: 'ok', endpoints: ['/users','/health','/metrics'] })
})

// Favicon (return empty 204 to silence browser automatic request)
app.get('/favicon.ico', (req, res) => res.status(204).end())

// path = POST /users สำหรับการสร้าง users ใหม่บันทึกเข้าไป
app.post('/users', asyncHandler(async (req, res) => {
  let user = req.body || {}
  // Debug log (safe subset)
  console.log('POST /users body =>', JSON.stringify(user))
  // Normalize age to number (avoid implicit string issues)
  if (user.age !== undefined && user.age !== null && user.age !== '') user.age = Number(user.age)
  const errors = validateData(user)
  if (errors.length) return res.status(400).json({ message: 'ข้อมูลไม่ถูกต้อง', errors })
  try {
    const conn = await initMySQL()
    // Use explicit column list to avoid accidental extra keys
    const { firstname, lastname, age, gender, interests, description } = user
    const sql = 'INSERT INTO users (firstname, lastname, age, gender, interests, description) VALUES (?,?,?,?,?,?)'
    const params = [firstname, lastname, age, gender, interests, description]
    const [result] = await conn.query(sql, params)
    return res.json({ message: 'insert ok', id: result.insertId })
  } catch (e) {
    console.error('Insert failed:', e.code, e.sqlMessage || e.message)
    throw e
  }
}))

// GET /users/:id สำหรับการดึง users รายคนออกมา
app.get('/users/:id', asyncHandler(async (req, res) => {
  const id = req.params.id
  const conn = await initMySQL()
  const [rows] = await conn.query('SELECT * FROM users WHERE id = ?', [id])
  if (rows.length === 0) return res.status(404).json({ message: 'หาไม่เจอ' })
  res.json(rows[0])
}))

// path = PUT /users/:id สำหรับการแก้ไข users รายคน (ตาม id ที่บันทึกเข้าไป)
app.put('/users/:id', asyncHandler(async (req, res) => {
  const id = req.params.id
  let payload = req.body || {}
  // Debug log
  console.log('PUT /users/:id body =>', JSON.stringify(payload))
  // Whitelist fields only
  const allowed = ['firstname','lastname','age','gender','interests','description']
  const user = {}
  allowed.forEach(k => { if (payload[k] !== undefined) user[k] = payload[k] })
  if (user.age !== undefined && user.age !== null && user.age !== '') user.age = Number(user.age)
  const errors = validateData(user)
  if (errors.length) return res.status(400).json({ message: 'ข้อมูลไม่ถูกต้อง', errors })
  const conn = await initMySQL()
  // Build explicit update list
  const setCols = []
  const params = []
  allowed.forEach(k => {
    if (user[k] !== undefined) {
      setCols.push(`${k} = ?`)
      params.push(user[k])
    }
  })
  if (!setCols.length) return res.status(400).json({ message: 'ไม่มีข้อมูลสำหรับอัพเดต' })
  params.push(id)
  const sql = `UPDATE users SET ${setCols.join(', ')} WHERE id = ?`
  try {
    const [result] = await conn.query(sql, params)
    if (result.affectedRows === 0) return res.status(404).json({ message: 'ไม่พบรายการ' })
    res.json({ message: 'update ok' })
  } catch (e) {
    console.error('Update failed:', e.code, e.sqlMessage || e.message)
    throw e
  }
}))


// path DELETE /users/:id สำหรับการลบ users รายคน (ตาม id ที่บันทึกเข้าไป)
app.delete('/users/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)
  const conn = await initMySQL()
  const [result] = await conn.query('DELETE FROM users WHERE id = ?', [id])
  if (result.affectedRows === 0) return res.status(404).json({ message: 'ไม่พบรายการ' })
  res.json({ message: 'delete ok' })
}))

// Health endpoint
app.get('/health', async (req, res) => {
  const status = { uptime: process.uptime(), status: 'ok', timestamp: Date.now() }
  try {
    const conn = await initMySQL()
    await conn.query('SELECT 1')
    status.database = 'up'
  } catch (e) {
    status.database = 'down'
  }
  res.json(status)
})

// Simple metrics (basic counts)
app.get('/metrics', asyncHandler(async (req, res) => {
  const conn = await initMySQL()
  const [[{ total }]] = await conn.query('SELECT COUNT(*) as total FROM users')
  res.json({ users_total: total, timestamp: Date.now() })
}))

app.get('/debug/pingdb', asyncHandler(async (req, res) => {
  try {
    const conn = await initMySQL()
    const [[row]] = await conn.query('SELECT NOW() as now')
    res.json({ ok: true, now: row.now })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}))

// Error handling middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Enhanced logging & SQL error detail (non-sensitive)
  console.error('Unhandled error:', err && err.stack ? err.stack : err)
  const detail = err.sqlMessage || err.message || 'error'
  res.status(500).json({ message: 'internal error', detail })
})

// Graceful start with port fallback if in local dev and port occupied
const MAX_PORT_FALLBACK = 10

let serverInstance = null
const startServer = (currentPort, remainingTries) => {
  serverInstance = app.listen(currentPort, async () => {
    try {
      await initMySQL()
    } catch (e) {
      console.error('Failed to initialize MySQL (startup)', e.message)
    }
    console.log(`http server running at port ${currentPort}`)
    console.log(`DB config => host: ${DB_HOST} port: ${DB_PORT} database: ${DB_NAME}`)
  })

  serverInstance.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && remainingTries > 0) {
      const nextPort = currentPort + 1
      console.warn(`Port ${currentPort} in use. Retrying on ${nextPort} (${remainingTries - 1} tries left)...`)
      startServer(nextPort, remainingTries - 1)
    } else if (err.code === 'EADDRINUSE') {
      console.error('All fallback attempts failed. Last tried port:', currentPort)
      process.exit(1)
    } else {
      console.error('Server failed to start:', err)
      process.exit(1)
    }
  })
}

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down...')
  try { if (pool) await pool.end() } catch (e) { console.error('Error closing pool', e.message) }
  if (serverInstance) {
    serverInstance.close(() => { console.log('Server closed'); process.exit(0) })
  } else process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

startServer(port, MAX_PORT_FALLBACK)