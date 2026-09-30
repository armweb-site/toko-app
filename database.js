const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./toko.db');

db.serialize(() => {
    // Tabel User
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`);

    // Tabel Stok Barang
    db.run(`CREATE TABLE IF NOT EXISTS barang (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama_barang TEXT,
        stok INTEGER DEFAULT 0,
        harga_jual REAL
    )`);

    // Tabel Penjualan
    db.run(`CREATE TABLE IF NOT EXISTS penjualan (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barang_id INTEGER,
        jumlah INTEGER,
        total_harga REAL,
        tanggal DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabel Pengeluaran
    db.run(`CREATE TABLE IF NOT EXISTS pengeluaran (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keterangan TEXT,
        jumlah_biaya REAL,
        tanggal DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabel Log Stok (Keluar/Masuk Otomatis)
    db.run(`CREATE TABLE IF NOT EXISTS log_stok (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barang_id INTEGER,
        tipe TEXT, -- 'MASUK' atau 'KELUAR'
        jumlah INTEGER,
        keterangan TEXT,
        tanggal DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

module.exports = db;
