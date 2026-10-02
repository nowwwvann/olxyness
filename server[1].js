// OLXYNESS server © VANNERST
const express = require('express'), http = require('http'), crypto = require('crypto');
const { Server } = require('socket.io');
const app = express(), srv = http.createServer(app), io = new Server(srv);
app.use(express.json());
app.use(express.static('public'));

const RAW = `AHMAD KHANIF AZIZIY|112
ANGGRAENI VIDI ASTUTI|331
ARINI ALFI CHASANAH|414
ANI ZULIYAH|661
ATIKA HILDA PRAYOGA|990
BUNGA MARSHA OLIVIA|889
CAHAYA WULAN AFIANANDA|776
ERI ZAZKIA ZALIYANTI|123
HAFSAH AZ ZAHRA|505
KEREN KURNIASARI|070
KHUSNUL DESNELA SARI|212
LARISA KUSUMA WARDANI|334
LINTANG WAHYU MULYANI|565
MAHDANIA CAHYANI|676
MAIRA PUTRI KIRANA|432
MEINEISYA NUR AINI|989
MIFTA AINUR ROHMAH|476
MUHAMMAD NADHIR MUNDHIR|899
MUHAMMAD GALIH FEBRIAN|777
MUHAMMAD MAFTUH ROYAN|999
MHAMMAD MAKITS AL JHAYYID|090
MUHAMMAD SYAFIN ARZAQ|050
MUHAMMAD TAMAM NADZHORI|232
NAVANO ALKANI IBRAHIM|555
NAYLA IZZA KAMILIA|444
NURMA ULI FAIZ AZIZAH|766
REVANIA AZIRA LESTARI|003
RIZAL AULIA ALBAB|222
SASKIA RAGIL SHOBRIYANTI|919
SHARIFUDDIN ULIL AIDI|487
SITI FATIMAH|333
TIARA RAHMAWATI|404
ZAKA ALFAIS|005`;
const norm = s => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
const USERS = {};
RAW.split('\n').forEach(l => { const [n, c] = l.split('|'); USERS[norm(n)] = c; });

const sessions = new Map();           // token -> nama
const CHANNELS = ['umum', 'belajar', 'santai', 'pengumuman'];
const history = Object.fromEntries(CHANNELS.map(c => [c, []]));
let statuses = [];                    // {id,name,text,bg,ts}
const online = new Map();             // socket.id -> nama
const DAY = 864e5;
const liveStatuses = () => (statuses = statuses.filter(s => Date.now() - s.ts < DAY));
const members = () => [...new Set(online.values())];

app.post('/login', (req, res) => {
  const name = norm(req.body.username), code = String(req.body.code || '').trim();
  if (USERS[name] !== undefined && USERS[name] === code) {
    const token = crypto.randomUUID(); sessions.set(token, name);
    return res.json({ token, name });
  }
  res.status(401).json({ error: 'Username atau code salah.' });
});

io.use((s, next) => {
  const name = sessions.get(s.handshake.auth.token);
  if (!name) return next(new Error('unauthorized'));
  s.data.name = name; next();
});

io.on('connection', s => {
  const name = s.data.name;
  online.set(s.id, name);
  s.emit('init', { name, channels: CHANNELS, history, statuses: liveStatuses() });
  io.emit('members', members());

  s.on('chat', ({ ch, text }) => {
    if (!history[ch] || !String(text).trim()) return;
    const m = { name, text: String(text).slice(0, 2000), ts: Date.now() };
    history[ch].push(m); if (history[ch].length > 200) history[ch].shift();
    io.emit('chat', { ch, m });
  });

  s.on('status:add', ({ text, bg }) => {
    if (!String(text).trim()) return;
    statuses.push({ id: crypto.randomUUID(), name, text: String(text).slice(0, 200), bg: String(bg).slice(0, 7), ts: Date.now() });
    io.emit('statuses', liveStatuses());
  });

  // ---- WebRTC signaling (mesh) ----
  s.on('call:join', () => {
    const peers = [...io.sockets.adapter.rooms.get('call') || []].map(id => ({ id, name: online.get(id) }));
    s.join('call');
    s.emit('call:peers', peers);
  });
  const leave = () => { if (s.rooms.has('call')) { s.leave('call'); s.to('call').emit('call:left', s.id); } };
  s.on('call:leave', leave);
  s.on('signal', ({ to, data }) => io.to(to).emit('signal', { from: s.id, name, data }));

  s.on('disconnect', () => { leave(); online.delete(s.id); io.emit('members', members()); });
});

const PORT = process.env.PORT || 3000;
srv.listen(PORT, () => console.log(`OLXYNESS jalan di http://localhost:${PORT}`));
