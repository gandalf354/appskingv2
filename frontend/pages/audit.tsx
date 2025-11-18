import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuthStore } from '@/store/authStore';
import { formatDateDisplay } from '@/utils/dateUtils';
import { toast } from 'react-hot-toast';

interface AuditLog {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  action_type: 'CREATE' | 'EDIT';
  transaction_id: number;
  transaction_code: string;
  transaction_type: 'income' | 'expense';
  transaction_amount: number;
  transaction_description: string;
  transaction_date: string;
  project_name?: string;
  changes: string;
  created_at: string;
  created_at_formatted: string;
}

interface Stats {
  total_logs: number;
  total_edits: number;
  total_creates: number;
}

export default function AuditPage() {
  const router = useRouter();
  const { user, token, checkAuth } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<Stats>({ total_logs: 0, total_edits: 0, total_creates: 0 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  useEffect(() => {
    setMounted(true);
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (mounted && !user) {
      router.push('/login');
    } else if (mounted && user && user.role !== 'admin' && user.role !== 'manager') {
      toast.error('Akses ditolak. Halaman ini hanya untuk admin atau manager.');
      router.push('/dashboard');
    }
  }, [mounted, user, router]);

  useEffect(() => {
    if (mounted && user && (user.role === 'admin' || user.role === 'manager')) {
      fetchLogs();
      fetchStats();
    }
  }, [mounted, user, currentPage, actionFilter, startDate, endDate]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20'
      });

      if (actionFilter) params.append('action_type', actionFilter);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/audit-logs?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch audit logs');

      const data = await response.json();
      setLogs(data.logs);
      setTotalPages(data.pagination.pages);
      setTotalLogs(data.pagination.total);
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast.error('Gagal mengambil data audit log');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/audit-logs/stats?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch stats');

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleViewDetail = (log: AuditLog) => {
    setSelectedLog(log);
    setShowModal(true);
  };

  const handleDelete = async (logId: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus log audit ini?')) {
      return;
    }

    try {
      setDeleting(logId);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/audit-logs/${logId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to delete audit log');

      toast.success('Log audit berhasil dihapus');
      
      // Refresh logs and stats
      fetchLogs();
      fetchStats();
    } catch (error) {
      console.error('Error deleting log:', error);
      toast.error('Gagal menghapus log audit');
    } finally {
      setDeleting(null);
    }
  };

  const clearFilters = () => {
    setActionFilter('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  if (!mounted || !user) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Log Audit - AppsKing Finance</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 md:space-x-3">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="text-gray-600 hover:text-gray-900 text-sm"
                >
                  ← Kembali
                </button>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-gray-900">📝 Log Audit</h1>
                  <p className="text-xs text-gray-500">Riwayat aktivitas user</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className="text-xs sm:text-sm text-gray-600">{user.name}</div>
              </div>
            </div>
          </div>
        </div>

  <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3 mb-4">
            <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Total Log</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.total_logs}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Edit Transaksi</p>
                  <p className="text-lg sm:text-xl font-bold text-warning-600">{stats.total_edits}</p>
                </div>
                <div className="p-3 bg-warning-100 rounded-lg">
                  <svg className="h-6 w-6 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Transaksi Mundur</p>
                  <p className="text-lg sm:text-xl font-bold text-secondary-600">{stats.total_creates}</p>
                </div>
                <div className="p-3 bg-secondary-100 rounded-lg">
                  <svg className="h-6 w-6 text-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Filter</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tipe Aksi</label>
                <select
                  value={actionFilter}
                  onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Semua</option>
                  <option value="EDIT">Edit</option>
                  <option value="CREATE">Create (Tanggal Mundur)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tanggal Mulai</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tanggal Akhir</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="w-full px-2 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs md:text-sm font-medium"
                >
                  Reset Filter
                </button>
              </div>
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs md:text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Waktu Log
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aksi
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transaksi
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Perubahan
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Detail
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                        <p className="text-sm text-gray-500 mt-2">Memuat data...</p>
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center">
                        <svg className="h-12 w-12 text-gray-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-sm text-gray-500">Belum ada log audit</p>
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-sm text-gray-900">{log.created_at_formatted}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{log.user_name}</p>
                          <p className="text-xs text-gray-500">{log.user_email}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            log.action_type === 'EDIT' 
                              ? 'bg-warning-100 text-warning-700' 
                              : 'bg-secondary-100 text-secondary-700'
                          }`}>
                            {log.action_type === 'EDIT' ? 'Edit' : 'Create'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                log.transaction_type === 'income'
                                  ? 'bg-success-100 text-success-700'
                                  : 'bg-error-100 text-error-700'
                              }`}>
                                {log.transaction_type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                              </span>
                              <span className="text-xs font-semibold text-gray-900">
                                Rp {new Intl.NumberFormat('id-ID').format(log.transaction_amount)}
                              </span>
                              {log.project_name && (
                                <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700">
                                  📁 {log.project_name}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-900 font-medium truncate max-w-xs">
                              {log.transaction_description || '-'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {log.transaction_code}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-700 truncate max-w-md">
                            {log.changes}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleViewDetail(log)}
                              className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                            >
                              Lihat
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              onClick={() => handleDelete(log.id)}
                              disabled={deleting === log.id}
                              className="text-red-600 hover:text-red-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {deleting === log.id ? 'Menghapus...' : 'Hapus'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Menampilkan <span className="font-medium">{((currentPage - 1) * 20) + 1}</span> - 
                      <span className="font-medium"> {Math.min(currentPage * 20, totalLogs)}</span> dari 
                      <span className="font-medium"> {totalLogs}</span> log
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <span className="sr-only">Previous</span>
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      
                      {[...Array(totalPages)].map((_, i) => {
                        const pageNum = i + 1;
                        if (
                          pageNum === 1 ||
                          pageNum === totalPages ||
                          (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                        ) {
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                currentPage === pageNum
                                  ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                          return <span key={pageNum} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>;
                        }
                        return null;
                      })}

                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <span className="sr-only">Next</span>
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {showModal && selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Detail Log Audit</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* User Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Informasi User</h3>
                <div className="space-y-1">
                  <p className="text-sm"><span className="font-medium">Nama:</span> {selectedLog.user_name}</p>
                  <p className="text-sm"><span className="font-medium">Email:</span> {selectedLog.user_email}</p>
                  <p className="text-sm"><span className="font-medium">ID User:</span> {selectedLog.user_id}</p>
                </div>
              </div>

              {/* Action Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Informasi Aksi</h3>
                <div className="space-y-1">
                  <p className="text-sm">
                    <span className="font-medium">Tipe Aksi:</span>{' '}
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      selectedLog.action_type === 'EDIT' 
                        ? 'bg-warning-100 text-warning-700' 
                        : 'bg-secondary-100 text-secondary-700'
                    }`}>
                      {selectedLog.action_type === 'EDIT' ? 'Edit Transaksi' : 'Create Transaksi (Tanggal Mundur)'}
                    </span>
                  </p>
                  <p className="text-sm"><span className="font-medium">Waktu:</span> {selectedLog.created_at_formatted}</p>
                </div>
              </div>

              {/* Transaction Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Informasi Transaksi</h3>
                <div className="space-y-1">
                  <p className="text-sm"><span className="font-medium">Kode:</span> {selectedLog.transaction_code}</p>
                  <p className="text-sm"><span className="font-medium">ID:</span> {selectedLog.transaction_id}</p>
                  <p className="text-sm">
                    <span className="font-medium">Tipe:</span>{' '}
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      selectedLog.transaction_type === 'income'
                        ? 'bg-success-100 text-success-700'
                        : 'bg-error-100 text-error-700'
                    }`}>
                      {selectedLog.transaction_type === 'income' ? 'Pemasukan' : selectedLog.transaction_type === 'expense' ? 'Pengeluaran' : selectedLog.transaction_type}
                    </span>
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Jumlah:</span> Rp {new Intl.NumberFormat('id-ID').format(selectedLog.transaction_amount)}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Deskripsi:</span>{' '}
                    {selectedLog.transaction_type && selectedLog.transaction_type.toLowerCase() === 'detail lengkap'
                      ? (selectedLog.transaction_description || '-')
                      : (selectedLog.transaction_description || '-')}
                  </p>
                  {selectedLog.project_name && (
                    <p className="text-sm">
                      <span className="font-medium">Proyek:</span>{' '}
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700">
                        📁 {selectedLog.project_name}
                      </span>
                    </p>
                  )}
                  <p className="text-sm"><span className="font-medium">Tanggal Transaksi:</span> {formatDateDisplay(selectedLog.transaction_date)}</p>
                </div>
              </div>

              {/* Changes */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Detail Perubahan</h3>
                <div className="text-sm text-gray-700">
                  {selectedLog.changes.split(' | ').map((change, index) => {
                    // Check if this is an item change
                    if (change.startsWith('TAMBAH_ITEM::')) {
                      const itemData = change.replace('TAMBAH_ITEM::', '').split('||');
                      return (
                        <div key={index} className="mb-3 p-3 bg-green-50 border border-green-200 rounded">
                          <p className="font-semibold text-green-800 mb-2">✚ Item Baru Ditambahkan:</p>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs">
                              <thead className="bg-green-100">
                                <tr>
                                  <th className="px-2 py-1 text-left">Nama Item</th>
                                  <th className="px-2 py-1 text-right">Jumlah</th>
                                  <th className="px-2 py-1 text-left">Satuan</th>
                                  <th className="px-2 py-1 text-right">Harga Satuan</th>
                                  <th className="px-2 py-1 text-right">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="bg-white">
                                  <td className="px-2 py-1">{itemData[0]}</td>
                                  <td className="px-2 py-1 text-right">{itemData[1]}</td>
                                  <td className="px-2 py-1">{itemData[2]}</td>
                                  <td className="px-2 py-1 text-right">Rp {new Intl.NumberFormat('id-ID').format(parseFloat(itemData[3]))}</td>
                                  <td className="px-2 py-1 text-right">Rp {new Intl.NumberFormat('id-ID').format(parseFloat(itemData[4]))}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    } else if (change.startsWith('UBAH_ITEM::')) {
                      const [oldPart, newPart] = change.replace('UBAH_ITEM::', '').split('>>>');
                      const oldItem = oldPart.split('||');
                      const newItem = newPart.split('||');
                      return (
                        <div key={index} className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
                          <p className="font-semibold text-blue-800 mb-2">✎ Item Diubah:</p>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs">
                              <thead className="bg-blue-100">
                                <tr>
                                  <th className="px-2 py-1 text-left">Status</th>
                                  <th className="px-2 py-1 text-left">Nama Item</th>
                                  <th className="px-2 py-1 text-right">Jumlah</th>
                                  <th className="px-2 py-1 text-left">Satuan</th>
                                  <th className="px-2 py-1 text-right">Harga Satuan</th>
                                  <th className="px-2 py-1 text-right">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="bg-red-50">
                                  <td className="px-2 py-1 font-medium text-red-700">Lama</td>
                                  <td className="px-2 py-1">{oldItem[0]}</td>
                                  <td className="px-2 py-1 text-right">{oldItem[1]}</td>
                                  <td className="px-2 py-1">{oldItem[2]}</td>
                                  <td className="px-2 py-1 text-right">Rp {new Intl.NumberFormat('id-ID').format(parseFloat(oldItem[3]))}</td>
                                  <td className="px-2 py-1 text-right">Rp {new Intl.NumberFormat('id-ID').format(parseFloat(oldItem[4]))}</td>
                                </tr>
                                <tr className="bg-green-50">
                                  <td className="px-2 py-1 font-medium text-green-700">Baru</td>
                                  <td className="px-2 py-1">{newItem[0]}</td>
                                  <td className="px-2 py-1 text-right">{newItem[1]}</td>
                                  <td className="px-2 py-1">{newItem[2]}</td>
                                  <td className="px-2 py-1 text-right">Rp {new Intl.NumberFormat('id-ID').format(parseFloat(newItem[3]))}</td>
                                  <td className="px-2 py-1 text-right">Rp {new Intl.NumberFormat('id-ID').format(parseFloat(newItem[4]))}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    } else if (change.startsWith('HAPUS_ITEM::')) {
                      const itemData = change.replace('HAPUS_ITEM::', '').split('||');
                      return (
                        <div key={index} className="mb-3 p-3 bg-red-50 border border-red-200 rounded">
                          <p className="font-semibold text-red-800 mb-2">✖ Item Dihapus:</p>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs">
                              <thead className="bg-red-100">
                                <tr>
                                  <th className="px-2 py-1 text-left">Nama Item</th>
                                  <th className="px-2 py-1 text-right">Jumlah</th>
                                  <th className="px-2 py-1 text-left">Satuan</th>
                                  <th className="px-2 py-1 text-right">Harga Satuan</th>
                                  <th className="px-2 py-1 text-right">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="bg-white">
                                  <td className="px-2 py-1">{itemData[0]}</td>
                                  <td className="px-2 py-1 text-right">{itemData[1]}</td>
                                  <td className="px-2 py-1">{itemData[2]}</td>
                                  <td className="px-2 py-1 text-right">Rp {new Intl.NumberFormat('id-ID').format(parseFloat(itemData[3]))}</td>
                                  <td className="px-2 py-1 text-right">Rp {new Intl.NumberFormat('id-ID').format(parseFloat(itemData[4]))}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    } else {
                      // Regular change (not item-related)
                      return (
                        <p key={index} className="py-1 border-b border-yellow-100 last:border-0">
                          • {change}
                        </p>
                      );
                    }
                  })}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setShowModal(false)}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
