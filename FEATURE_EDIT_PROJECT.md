# Fitur Edit Project - AppsKing

## Deskripsi
Fitur ini memungkinkan pengguna untuk mengedit data project dengan mengklik salah satu project di halaman daftar project.

## Implementasi

### 1. Halaman Edit Project (`/pages/projects/[id].tsx`)
- **Route**: `/projects/{project_id}`
- **Fitur**:
  - Form lengkap untuk mengedit semua data project
  - Validasi form (nama dan budget wajib diisi)
  - Auto-populate form dengan data existing
  - Toast notification untuk feedback
  - Navigasi kembali ke daftar project

### 2. API Backend Endpoints

#### GET `/api/projects/:id`
- Mengambil detail project berdasarkan ID
- Hanya project milik user yang login yang bisa diakses
- Response: Detail project dengan kategori

#### PUT `/api/projects/:id`
- Update data project berdasarkan ID
- Validasi bahwa project milik user yang login
- Fields yang bisa diupdate:
  - name (required)
  - description
  - category_id
  - budget (required)
  - start_date
  - end_date
  - client_name
  - client_email
  - client_phone
  - status

### 3. Navigasi Click Handler
- Di halaman `/projects`, setiap project card bisa diklik
- onClick handler: `router.push(\`/projects/\${project.id}\`)`
- Hover effect untuk menunjukkan bahwa element bisa diklik

## Penggunaan

1. **Buka halaman Daftar Project**: `/projects`
2. **Klik salah satu project** di daftar untuk membuka halaman edit
3. **Edit data project** di form yang tersedia
4. **Klik "Simpan Perubahan"** untuk menyimpan
5. **Redirect otomatis** ke halaman daftar project setelah berhasil

## Form Fields
- **Informasi Dasar**:
  - Nama Project (required)
  - Kategori (dropdown)
  - Budget (required)
  - Status (dropdown)
  - Tanggal Mulai
  - Tanggal Selesai
  - Deskripsi

- **Informasi Klien**:
  - Nama Klien
  - Email Klien
  - Telepon Klien

## Status Options
- `planning` → Perencanaan
- `active` → Aktif
- `on_hold` → Ditunda
- `completed` → Selesai
- `cancelled` → Dibatalkan

## Error Handling
- 404 jika project tidak ditemukan
- 403 jika user tidak memiliki akses ke project
- Validasi form client-side dan server-side
- Toast notification untuk error dan success

## Styling
- Responsive design
- Tailwind CSS
- Consistent dengan design system
- Loading states dan error states
- Form validation styling