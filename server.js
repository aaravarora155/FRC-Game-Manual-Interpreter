const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;
const FLASK_URL = 'http://localhost:5000';

// Configure the JSON parser with a high capacity limit to handle base64 image strings safely
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));


// ── Proxy: forward POST /api/query to Flask ────────────────────────────────
app.post('/api/query', async (req, res) => {
  try {
    const flaskRes = await axios.post(`${FLASK_URL}/api/query`, req.body);
    res.json(flaskRes.data);
  } catch (err) {
    const status = err.response?.status || 502;
    const message = err.response?.data?.error
      || 'Flask backend is not reachable. Make sure main.py is running on port 5000.';
    res.status(status).json({ error: message });
  }
});

// ── Home page ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 FRC Manual Interpreter UI running at http://localhost:${PORT}`);
  console.log(`   Proxying /api/query → ${FLASK_URL}/api/query\n`);
});