# Timezone Configuration - Asia/Jakarta

## Perubahan yang Dilakukan

Semua sistem penanggalan di aplikasi AppsKing sekarang menggunakan timezone **Asia/Jakarta (WIB/UTC+7)**.

## File yang Diubah

### Frontend

1. **`frontend/src/utils/dateUtils.ts`** (BARU)
   - `getJakartaDate()`: Mendapatkan tanggal hari ini dalam format YYYY-MM-DD (Asia/Jakarta)
   - `formatDateToJakarta()`: Konversi ISO date string ke YYYY-MM-DD (Asia/Jakarta)
   - `formatDateDisplay()`: Format tanggal untuk tampilan dalam format DD/MM/YYYY
   - `getJakartaDateTime()`: Mendapatkan datetime lengkap dalam ISO string (Asia/Jakarta)

2. **`frontend/pages/dashboard.tsx`**
   - Import dan gunakan `getJakartaDate()` untuk default transaction_date
   - Digunakan saat membuka modal transaksi baru

3. **`frontend/pages/projects.tsx`**
   - Import dan gunakan `formatDateToJakarta()` untuk format tanggal project
   - Digunakan saat load data Edit Project

4. **`frontend/pages/projects/create.tsx`**
   - Import `getJakartaDate()` untuk digunakan jika diperlukan

### Backend

5. **`backend/config/database.js`**
   - Tambahkan konfigurasi `timezone: '+07:00'` ke connection pool MySQL
   - Semua query NOW() dan timestamp akan menggunakan WIB

## Cara Penggunaan

### Di Frontend

```typescript
import { getJakartaDate, formatDateToJakarta, formatDateDisplay } from '@/utils/dateUtils';

// Mendapatkan tanggal hari ini (YYYY-MM-DD)
const today = getJakartaDate(); // "2025-11-03"

// Konversi ISO date ke format input date
const formattedDate = formatDateToJakarta("2025-10-31T17:00:00.000Z"); // "2025-11-01"

// Format untuk display
const displayDate = formatDateDisplay("2025-10-31T17:00:00.000Z"); // "01/11/2025"
```

### Di Backend

Semua fungsi `NOW()` dan timestamp MySQL otomatis menggunakan Asia/Jakarta timezone karena konfigurasi connection pool.

## Manfaat

1. ✅ Konsistensi timezone di seluruh aplikasi
2. ✅ Tanggal yang ditampilkan sesuai dengan waktu lokal Indonesia
3. ✅ Database menyimpan waktu dalam WIB
4. ✅ Form tanggal menampilkan dan menyimpan tanggal yang benar untuk pengguna Indonesia

## Testing

Untuk memverifikasi timezone bekerja dengan benar:

1. Buka modal transaksi - tanggal default harus tanggal hari ini (WIB)
2. Edit project - tanggal mulai/selesai harus tampil dengan benar
3. Cek database - timestamp harus dalam WIB (+07:00)

## Catatan Penting

- Frontend menggunakan `toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })` untuk konversi
- Backend menggunakan MySQL timezone offset `+07:00`
- Semua tanggal baru akan otomatis menggunakan timezone yang benar
