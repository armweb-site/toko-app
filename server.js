const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'kunci-rahasia-toko',
    resave: false,
    saveUninitialized: true
}));

// Middleware Cek Login
function checkAuth(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

// --- ROUTE AUTENTIKASI ---
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/login.html'));
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (user && bcrypt.compareSync(password, user.password)) {
            req.session.userId = user.id;
            res.redirect('/dashboard');
        } else {
            res.send('Username atau Password salah! <a href="/login">Coba lagi</a>');
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Setup akun default jika belum ada (admin / admin123)
db.get('SELECT * FROM users WHERE username = ?', ['admin'], (err, user) => {
    if (!user) {
        const hash = bcrypt.hashSync('admin123', 10);
        db.run('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hash]);
    }
});

// --- ROUTE DASHBOARD & API ---
app.get('/dashboard', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views/dashboard.html'));
});

// GET Ringkasan Data Dashboard
app.get('/api/dashboard-summary', checkAuth, (req, res) => {
    const data = {};
    db.get('SELECT COUNT(*) as total_barang FROM barang', [], (err, row1) => {
        data.totalBarang = row1.total_barang;
        db.get('SELECT SUM(total_harga) as total_penjualan FROM penjualan', [], (err, row2) => {
            data.totalPenjualan = row2.total_penjualan || 0;
            db.get('SELECT SUM(jumlah_biaya) as total_pengeluaran FROM pengeluaran', [], (err, row3) => {
                data.totalPengeluaran = row3.total_pengeluaran || 0;
                res.json(data);
            });
        });
    });
});

// GET Daftar Barang
app.get('/api/barang', checkAuth, (req, res) => {
    db.all('SELECT * FROM barang', [], (err, rows) => res.json(rows));
});

// POST Tambah Stok / Barang Baru (Stok Masuk Otomatis)
app.post('/api/barang/tambah', checkAuth, (req, res) => {
    const { nama_barang, jumlah, harga_jual } = req.body;
    
    db.get('SELECT * FROM barang WHERE nama_barang = ?', [nama_barang], (err, item) => {
        if (item) {
            // Update Stok
            const stokBaru = item.stok + parseInt(jumlah);
            db.run('UPDATE barang SET stok = ? WHERE id = ?', [stokBaru, item.id], () => {
                // Log Stok Masuk
                db.run('INSERT INTO log_stok (barang_id, tipe, jumlah, keterangan) VALUES (?, "MASUK", ?, "Penambahan Stok")', [item.id, jumlah]);
                res.redirect('/dashboard');
            });
        } else {
            // Tambah Barang Baru
            db.run('INSERT INTO barang (nama_barang, stok, harga_jual) VALUES (?, ?, ?)', [nama_barang, jumlah, harga_jual], function() {
                db.run('INSERT INTO log_stok (barang_id, tipe, jumlah, keterangan) VALUES (?, "MASUK", ?, "Barang Baru")', [this.lastID, jumlah]);
                res.redirect('/dashboard');
            });
        }
    });
});

// POST Transaksi Penjualan (Stok Keluar Otomatis)
app.post('/api/penjualan', checkAuth, (req, res) => {
    const { barang_id, jumlah } = req.body;

    db.get('SELECT * FROM barang WHERE id = ?', [barang_id], (err, item) => {
        if (!item || item.stok < jumlah) {
            return res.send('Stok tidak cukup! <a href="/dashboard">Kembali</a>');
        }

        const totalHarga = item.harga_jual * jumlah;
        const stokSisa = item.stok - jumlah;

        // 1. Kurangi Stok
        db.run('UPDATE barang SET stok = ? WHERE id = ?', [stokSisa, barang_id], () => {
            // 2. Catat Penjualan
            db.run('INSERT INTO penjualan (barang_id, jumlah, total_harga) VALUES (?, ?, ?)', [barang_id, jumlah, totalHarga], () => {
                // 3. Catat Log Stok Keluar Otomatis
                db.run('INSERT INTO log_stok (barang_id, tipe, jumlah, keterangan) VALUES (?, "KELUAR", ?, "Penjualan")', [barang_id, jumlah], () => {
                    res.redirect('/dashboard');
                });
            });
        });
    });
});

// POST Catat Pengeluaran
app.post('/api/pengeluaran', checkAuth, (req, res) => {
    const { keterangan, jumlah_biaya } = req.body;
    db.run('INSERT INTO pengeluaran (keterangan, jumlah_biaya) VALUES (?, ?)', [keterangan, jumlah_biaya], () => {
        res.redirect('/dashboard');
    });
});

// GET Log Mutasi Stok (Keluar/Masuk)
app.get('/api/log-stok', checkAuth, (req, res) => {
    const query = `
        SELECT log_stok.*, barang.nama_barang 
        FROM log_stok 
        JOIN barang ON log_stok.barang_id = barang.id 
        ORDER BY tanggal DESC
    `;
    db.all(query, [], (err, rows) => res.json(rows));
});

// Jalankan Server
app.listen(3000, () => {
    console.log('Server berjalan di http://localhost:3000');
});
