# CASCADE DELETE - Project & Transactions

## 📋 Perubahan Database

### Foreign Key Constraint Update

Tabel `transactions` telah diupdate dengan perubahan pada foreign key `project_id`:

**Sebelum:**
```sql
FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
```

**Sesudah:**
```sql
FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE
```

## 🎯 Fungsi CASCADE DELETE

Ketika sebuah **project dihapus**, semua **transaksi yang terkait** dengan project tersebut akan **otomatis ikut terhapus**.

### Contoh Skenario:

1. **Project**: "Labor Diza" (ID: 5)
2. **Transaksi terkait**:
   - TRX-001: Pembayaran DP Rp 350.000.000
   - TRX-002: Biaya Material Rp 50.000.000
   - TRX-003: Pembayaran Progres Rp 150.000.000

**Ketika Project "Labor Diza" dihapus:**
- ✅ Project terhapus
- ✅ Semua 3 transaksi (TRX-001, TRX-002, TRX-003) **otomatis terhapus**

## ⚠️ Peringatan

- **Data tidak bisa dikembalikan** setelah dihapus
- Pastikan sudah backup data sebelum menghapus project
- Pertimbangkan untuk menggunakan "soft delete" jika perlu riwayat data

## ✅ Testing

CASCADE DELETE telah ditest dan berfungsi dengan baik:

```sql
-- Test dilakukan pada: 2025-11-03
-- Status: BERHASIL ✅
-- Project test dan 2 transaksi terkait berhasil terhapus secara otomatis
```

## 📝 File yang Diupdate

- `/database/complete_schema.sql` - Schema SQL diupdate
- `/backend/config/database.js` - Tidak perlu perubahan (menggunakan constraint dari DB)

## 🔄 Migrasi

Jika database sudah ada, jalankan SQL berikut untuk update constraint:

```sql
USE db_appsking;

-- Drop constraint lama
ALTER TABLE transactions DROP FOREIGN KEY transactions_ibfk_1;

-- Tambah constraint baru dengan CASCADE
ALTER TABLE transactions 
ADD CONSTRAINT transactions_ibfk_1 
FOREIGN KEY (project_id) REFERENCES projects(id) 
ON DELETE CASCADE 
ON UPDATE CASCADE;
```

---
**Last Updated**: November 3, 2025  
**Tested By**: System Administrator
