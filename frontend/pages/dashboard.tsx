import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuthStore } from '@/store/authStore';
import { getJakartaDate, formatDateDisplay } from '@/utils/dateUtils';
import { formatNumberWithSeparator, parseFormattedNumber } from '@/utils/numberFormat';
import { toast } from 'react-hot-toast';

interface Project {
  id: number;
  name: string;
  client_name?: string;
  status: 'planning' | 'active' | 'completed' | 'on_hold' | 'cancelled';
}

interface RecentTransaction {
  id: number;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category_name: string;
  reference_number?: string;
  project_name?: string;
  transaction_date: string;
  created_at: string;
  notes?: string;
  items?: Array<{
    item_name?: string;
    quantity?: number;
    unit?: string;
    unit_price?: number;
    subtotal?: number;
    total_price?: number;
  }>;
}

export default function Dashboard() {
  const router = useRouter();
  const { user, token, checkAuth, logout } = useAuthStore();

  // --- Daily Reports Modal State ---
  const [showDailyReportsModal, setShowDailyReportsModal] = useState(false);
  const [allTransactions, setAllTransactions] = useState<RecentTransaction[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [expandedTransactions, setExpandedTransactions] = useState<Set<number>>(new Set<number>());

  // --- Daily Reports Modal Logic ---
  const fetchAllTransactions = async () => {
    if (!token) return;
    setLoadingDaily(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions?limit=1000`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAllTransactions(data.transactions || []);
      } else {
        toast.error('Gagal memuat transaksi harian');
      }
    } catch (error) {
      toast.error('Gagal memuat transaksi harian');
    } finally {
      setLoadingDaily(false);
    }
  };

  useEffect(() => {
    if (showDailyReportsModal) {
      fetchAllTransactions();
    }
    if (!showDailyReportsModal) {
      setExpandedTransactions(new Set<number>());
    }
  }, [showDailyReportsModal, token]);
  const [mounted, setMounted] = useState(false);
  const [totalProjects, setTotalProjects] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Recent Activity Pagination
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const activityPerPage = 10;
  
  // Transaction Modal States
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('income');
  const [expenseType, setExpenseType] = useState<'simple' | 'detailed'>('simple');
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  
  // Edit & Delete States
  const [editingTransaction, setEditingTransaction] = useState<RecentTransaction | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Selected Project Summary
  const [projectSummary, setProjectSummary] = useState<{
    name: string;
    total_income: number;
    total_expense: number;
  } | null>(null);
  const [loadingProjectSummary, setLoadingProjectSummary] = useState(false);
  
  // Transaction Form Data
  const [transactionForm, setTransactionForm] = useState({
    project_id: '',
    category_id: '',
    payment_method_id: '',
    amount: '',
    description: '',
    transaction_date: getJakartaDate(),
    receipt_number: '',
    notes: ''
  });
  
  // Detail Items for detailed expense
  const [detailItems, setDetailItems] = useState<Array<{
    item_name: string;
    quantity: number;
    unit: string;
    unit_price: number;
    subtotal: number;
  }>>([{
    item_name: '',
    quantity: 1,
    unit: 'Buah',
    unit_price: 0,
    subtotal: 0
  }]);

  useEffect(() => {
    setMounted(true);
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (mounted && !user) {
      router.push('/login');
    }
  }, [user, router, mounted]);

  useEffect(() => {
    if (token && user) {
      fetchDashboardData();
    }
  }, [token, user]);

  // Handle edit transaction from URL parameter
  useEffect(() => {
    const { editTransaction } = router.query;
    if (editTransaction && token) {
      const transactionId = parseInt(editTransaction as string);
      if (!isNaN(transactionId)) {
        handleEditTransaction({ id: transactionId } as RecentTransaction);
        // Clean up URL
        router.replace('/dashboard', undefined, { shallow: true });
      }
    }
  }, [router.query, token]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [projectsRes, categoriesRes, paymentMethodsRes, dashboardRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects?status=active&limit=1000`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/payment-methods`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/overview`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })
      ]);

      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setTotalProjects(data.pagination?.total || data.projects?.length || 0);
        setProjects(data.projects || []);
      }
      
      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        // Extract transaction_categories from the response
        const transactionCategories = data.transaction_categories || [];
        setCategories(transactionCategories);
      }
      
      if (paymentMethodsRes.ok) {
        const data = await paymentMethodsRes.json();
        setPaymentMethods(data.payment_methods || []);
      }

      if (dashboardRes.ok) {
        const data = await dashboardRes.json();
        setTotalIncome(data.financial_summary?.total_income || 0);
        setTotalExpense(data.financial_summary?.total_expense || 0);
        setRecentTransactions(data.recent_transactions || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Baru saja';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} menit lalu`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} jam lalu`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} hari lalu`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} minggu lalu`;
    return `${Math.floor(diffInSeconds / 2592000)} bulan lalu`;
  };

  const handleOpenTransactionModal = (type: 'income' | 'expense') => {
    setTransactionType(type);
    setExpenseType('simple');
    setTransactionForm({
      project_id: '',
      category_id: '',
      payment_method_id: '',
      amount: '',
      description: '',
      transaction_date: getJakartaDate(),
      receipt_number: '',
      notes: ''
    });
    setDetailItems([{
      item_name: '',
      quantity: 1,
      unit: 'Buah',
      unit_price: 0,
      subtotal: 0
    }]);
    setProjectSummary(null);
    setShowTransactionModal(true);
  };

  const fetchProjectSummary = async (projectId: string) => {
    if (!projectId || !token) {
      setProjectSummary(null);
      return;
    }
    
    try {
      setLoadingProjectSummary(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setProjectSummary({
          name: data.name || '',
          total_income: data.total_income || 0,
          total_expense: data.total_expense || 0,
        });
      } else {
        setProjectSummary(null);
      }
    } catch (error) {
      console.error('Error fetching project summary:', error);
      setProjectSummary(null);
    } finally {
      setLoadingProjectSummary(false);
    }
  };

  const handleProjectChange = (projectId: string) => {
    setTransactionForm({ ...transactionForm, project_id: projectId });
    fetchProjectSummary(projectId);
  };

  const handleAddDetailItem = () => {
    setDetailItems([...detailItems, {
      item_name: '',
      quantity: 1,
      unit: 'Buah',
      unit_price: 0,
      subtotal: 0
    }]);
  };

  const handleRemoveDetailItem = (index: number) => {
    if (detailItems.length > 1) {
      const newItems = detailItems.filter((_, i) => i !== index);
      setDetailItems(newItems);
      calculateTotalAmount(newItems);
    }
  };

  const handleDetailItemChange = (index: number, field: string, value: any) => {
    const newItems = [...detailItems];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };
    
    // Calculate subtotal
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].subtotal = newItems[index].quantity * newItems[index].unit_price;
    }
    
    setDetailItems(newItems);
    calculateTotalAmount(newItems);
  };

  const calculateTotalAmount = (items: typeof detailItems) => {
    const total = items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    setTransactionForm({ ...transactionForm, amount: formatNumberWithSeparator(total) });
  };

  const handleSaveTransaction = async () => {
    if (!transactionForm.project_id || !transactionForm.amount) {
      toast.error('Project dan Amount wajib diisi!');
      return;
    }

    // Validate detail items for detailed expense
    if (transactionType === 'expense' && expenseType === 'detailed') {
      const hasEmptyItems = detailItems.some(item => !item.item_name || item.quantity <= 0 || item.unit_price <= 0);
      if (hasEmptyItems) {
        toast.error('Semua item harus diisi dengan lengkap!');
        return;
      }
    }

    try {
      setSaving(true);
      
      // Prepare payload dengan field yang sesuai backend
      const payload = {
        type: transactionType,
        amount: parseFormattedNumber(transactionForm.amount),
        description: transactionForm.description || '',
        date: transactionForm.transaction_date, // Backend expects 'date' not 'transaction_date'
        category_id: transactionForm.category_id || null,
        project_id: parseInt(transactionForm.project_id),
        payment_method_id: transactionForm.payment_method_id || null,
        reference_number: transactionForm.receipt_number || null,
        notes: transactionForm.notes || null,
        items: transactionType === 'expense' && expenseType === 'detailed' ? JSON.stringify(detailItems) : undefined
      };

      console.log('=== FRONTEND PAYLOAD ===');
      console.log('Transaction Type:', transactionType);
      console.log('Expense Type:', expenseType);
      console.log('Detail Items:', detailItems);
      console.log('Items to send:', payload.items);
      console.log('Full Payload:', payload);

      const url = isEditMode && editingTransaction
        ? `${process.env.NEXT_PUBLIC_API_URL}/transactions/${editingTransaction.id}`
        : `${process.env.NEXT_PUBLIC_API_URL}/transactions`;

      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(isEditMode ? 'Transaksi berhasil diupdate!' : 'Transaksi berhasil disimpan!');
        setShowTransactionModal(false);
        resetTransactionForm();
        fetchDashboardData();
      } else {
        const error = await response.json();
        toast.error(`Error: ${error.error || 'Gagal menyimpan transaksi'}`);
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
      toast.error('Terjadi kesalahan saat menyimpan transaksi');
    } finally {
      setSaving(false);
    }
  };

  const handleEditTransaction = async (transaction: RecentTransaction) => {
    try {
      // Fetch full transaction details
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions/${transaction.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        console.log('🔍 Fetched transaction data for editing:', data);

        // Set edit mode
        setIsEditMode(true);

        console.log("🔍 Transaction data from parameter:", transaction);

        setEditingTransaction(transaction);

        console.log("🔍 Transaction type from API:", data.type);

        setTransactionType(data.type);
        
        // Always open expense in detailed mode; populate items if available
        if (data.type === 'expense') {
          setExpenseType('detailed');
          if (Array.isArray(data.items) && data.items.length > 0) {
            setDetailItems(data.items.map((item: any) => ({
              item_name: item.item_name || '',
              quantity: item.quantity || 1,
              unit: item.unit || 'Buah',
              unit_price: parseFloat(item.unit_price || 0),
              subtotal: parseFloat(item.total_price || 0)
            })));
          } else {
            setDetailItems([{
              item_name: '',
              quantity: 1,
              unit: 'Buah',
              unit_price: 0,
              subtotal: 0
            }]);
          }
        }
        
        // Convert transaction_date to YYYY-MM-DD format for date input
        let formattedDate = getJakartaDate();
        if (data.transaction_date) {
          try {
            // Convert to string first if it's not
            const dateStr = String(data.transaction_date);
            console.log('🔍 Original date from API:', dateStr);
            
            // If date is already in YYYY-MM-DD format, use it directly (no timezone conversion)
            if (dateStr.match(/^\d{4}-\d{2}-\d{2}($|T)/)) {
              formattedDate = dateStr.split('T')[0]; // Remove time part if exists
              console.log('✅ Using direct date (no conversion):', formattedDate);
            } else {
              // For other formats, parse with local timezone
              const date = new Date(dateStr);
              // Get local date parts to avoid timezone shift
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              formattedDate = `${year}-${month}-${day}`;
              console.log('⚙️ Converted date:', formattedDate);
            }
          } catch (e) {
            console.error('Error parsing date:', e);
          }
        }
        console.log('📅 Final formatted date:', formattedDate);
        
        // Fill form with transaction data
        setTransactionForm({
          project_id: data.project_id?.toString() || '',
          category_id: data.category_id?.toString() || '',
          payment_method_id: data.payment_method_id?.toString() || '',
          amount: formatNumberWithSeparator(Math.round(parseFloat(data.amount || 0))),
          description: data.description || '',
          transaction_date: formattedDate,
          receipt_number: data.reference_number || '',
          notes: data.notes || ''
        });

        // Fetch project summary if project is selected
        if (data.project_id) {
          fetchProjectSummary(data.project_id.toString());
        }

        // Open modal
        setShowTransactionModal(true);
      } else {
        toast.error('Gagal memuat detail transaksi');
      }
    } catch (error) {
      console.error('Error fetching transaction:', error);
      toast.error('Terjadi kesalahan saat memuat transaksi');
    }
  };

  const handleDeleteTransaction = async (transactionId: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) {
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions/${transactionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast.success('Transaksi berhasil dihapus!');
        fetchDashboardData();
      } else {
        const error = await response.json();
        toast.error(`Error: ${error.message || 'Gagal menghapus transaksi'}`);
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error('Terjadi kesalahan saat menghapus transaksi');
    }
  };

  const resetTransactionForm = () => {
    setIsEditMode(false);
    setEditingTransaction(null);
    setTransactionForm({
      project_id: '',
      category_id: '',
      payment_method_id: '',
      amount: '',
      description: '',
      transaction_date: getJakartaDate(),
      receipt_number: '',
      notes: ''
    });
    setDetailItems([{
      item_name: '',
      quantity: 1,
      unit: 'Buah',
      unit_price: 0,
      subtotal: 0
    }]);
  };

  if (!mounted || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Dashboard - AppsKing Finance</title>
        <meta name="description" content="Financial management dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center mr-3">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <h1 className="text-base font-semibold text-gray-900">AppsKing Finance</h1>
              </div>
              
              <div className="flex items-center space-x-4">
                <span className="text-xs text-gray-700">Welcome, {user.name}</span>
                <button
                  onClick={logout}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
          <div className="mb-4">
            <h2 className="text-base font-bold text-gray-900 mb-1">Dashboard</h2>
            <p className="text-xs text-gray-600">Welcome to your financial management dashboard</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center">
                <div className="p-1.5 bg-primary-100 rounded-lg">
                  <svg className="h-4 w-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-2m-2 0H7m5 0v-9a2 2 0 00-2-2H8a2 2 0 00-2 2v9m8 0V9a2 2 0 012-2h2a2 2 0 012 2v12a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-2.5">
                  <p className="text-xs font-medium text-gray-600">Total Projects</p>
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                    </div>
                  ) : (
                    <p className="text-base font-bold text-gray-900">{totalProjects}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center">
                <div className="p-1.5 bg-secondary-100 rounded-lg">
                  <svg className="h-4 w-4 text-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="ml-2.5">
                  <p className="text-xs font-medium text-gray-600">Total Income</p>
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                    </div>
                  ) : (
                    <p className="text-sm font-bold text-green-600">
                      {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalIncome)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center">
                <div className="p-1.5 bg-warning-100 rounded-lg">
                  <svg className="h-4 w-4 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 0h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="ml-2.5">
                  <p className="text-xs font-medium text-gray-600">Total Expenses</p>
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                    </div>
                  ) : (
                    <p className="text-sm font-bold text-red-600">
                      {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalExpense)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center">
                <div className="p-1.5 bg-success-100 rounded-lg">
                  <svg className="h-4 w-4 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-2.5">
                  <p className="text-xs font-medium text-gray-600">Net Profit</p>
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                    </div>
                  ) : (
                    <p className={`text-sm font-bold ${totalIncome - totalExpense >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalIncome - totalExpense)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-base font-semibold text-gray-900 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <button 
                  onClick={() => router.push('/projects/create')}
                  className="w-full text-left p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center">
                    <div className="p-1.5 bg-primary-100 rounded-lg mr-2.5">
                      <svg className="h-4 w-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Add New Project</p>
                      <p className="text-xs text-gray-500">Create a new project</p>
                    </div>
                  </div>
                </button>
                
                <button 
                  onClick={() => router.push('/projects')}
                  className="w-full text-left p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center">
                    <div className="p-1.5 bg-blue-100 rounded-lg mr-2.5">
                      <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-2m-2 0H7m5 0v-9a2 2 0 00-2-2H8a2 2 0 00-2 2v9m8 0V9a2 2 0 012-2h2a2 2 0 012 2v12a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">View All Projects</p>
                      <p className="text-xs text-gray-500">Manage your projects</p>
                    </div>
                  </div>
                </button>
                
                {user?.role === 'manager' && (
                  <button 
                    onClick={() => router.push('/categories')}
                    className="w-full text-left p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <div className="p-1.5 bg-purple-100 rounded-lg mr-2.5">
                        <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Kelola Kategori</p>
                        <p className="text-xs text-gray-500">Tambah, edit, atau hapus kategori</p>
                      </div>
                    </div>
                  </button>
                )}
                

                <button 
                  onClick={() => handleOpenTransactionModal('income')}
                  className="w-full text-left p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center">
                    <div className="p-1.5 bg-secondary-100 rounded-lg mr-2.5">
                      <svg className="h-4 w-4 text-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Record Transaction</p>
                      <p className="text-xs text-gray-500">Add income or expense</p>
                    </div>
                  </div>
                </button>

                {/* Daily Reports Card Button */}
                <button 
                  onClick={() => setShowDailyReportsModal(true)}
                  className="w-full text-left p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center">
                    <div className="p-1.5 bg-blue-100 rounded-lg mr-2.5">
                      <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8h18M3 12h18M3 16h18" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Daily Reports</p>
                      <p className="text-xs text-gray-500">Laporan harian keuangan</p>
                    </div>
                  </div>
                </button>


                <button 
                  onClick={() => router.push('/reports')}
                  className="w-full text-left p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center">
                    <div className="p-1.5 bg-warning-100 rounded-lg mr-2.5">
                      <svg className="h-4 w-4 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">View Reports</p>
                      <p className="text-xs text-gray-500">Financial analysis</p>
                    </div>
                  </div>
                </button>

                {/* Log Audit Button - Admin Only */}
                {(user?.role === 'admin' || user?.role === 'manager') && (
                  <button
                    onClick={() => router.push('/audit')}
                    className="w-full text-left p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <div className="p-1.5 bg-red-100 rounded-lg mr-2.5">
                        <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Log Audit</p>
                        <p className="text-xs text-gray-500">Track system activities</p>
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              {/* Render Daily Reports Modal if open */}
              {showDailyReportsModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-3 z-50">
                  <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
                    {/* Modal Header */}
                    <div className="px-3 py-2 sm:py-2.5 border-b border-gray-200 flex justify-between items-center">
                      <div>
                        <h3 className="text-sm sm:text-base font-semibold text-gray-900">
                          Detail Transaksi Harian
                        </h3>
                      </div>
                      <button
                        onClick={() => setShowDailyReportsModal(false)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    {/* Modal Body */}
                    <div className="flex-1 overflow-y-auto px-3 py-2 sm:py-3">
                      {loadingDaily ? (
                        <div className="flex justify-center items-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                      ) : allTransactions.length > 0 ? (
                        <div className="space-y-3">
                          {/* Group transactions by date */}
                          {Object.entries(
                            allTransactions.reduce((groups: Record<string, RecentTransaction[]>, transaction: RecentTransaction) => {
                              const date = transaction.transaction_date.split('T')[0];
                              if (!groups[date]) groups[date] = [];
                              groups[date].push(transaction);
                              return groups;
                            }, {} as Record<string, RecentTransaction[]>)
                          )
                          .sort((a, b) => b[0].localeCompare(a[0]))
                          .map(([date, transactions]) => {
                            const totalIncome = (transactions as RecentTransaction[]).filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount || 0), 0);
                            const totalExpense = (transactions as RecentTransaction[]).filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount || 0), 0);
                            return (
                              <div key={date} className="space-y-1.5 sm:space-y-2">
                                {/* Date Separator */}
                                <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2 rounded-lg border border-blue-200">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold text-gray-700">
                                      📅 {formatDateDisplay(date)}
                                    </p>
                                    <div className="flex items-center gap-3 text-xs font-medium">
                                      <span className="text-green-600">
                                        ↑ {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalIncome)}
                                      </span>
                                      <span className="text-red-600">
                                        ↓ {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalExpense)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                {/* Transactions for this date */}
                                {(transactions as RecentTransaction[]).map((transaction) => {
                                  const isIncome = transaction.type === 'income';
                                  const isExpanded = expandedTransactions.has(transaction.id);
                                  return (
                                    <div key={transaction.id} className="bg-gray-50 rounded-lg overflow-hidden">
                                      {/* Main Transaction Row */}
                                      <div 
                                        className="flex items-center p-2 sm:p-2.5 hover:bg-gray-100 transition-colors cursor-pointer"
                                        onClick={() => {
                                          const newExpanded = new Set(expandedTransactions);
                                          if (isExpanded) newExpanded.delete(transaction.id);
                                          else newExpanded.add(transaction.id);
                                          setExpandedTransactions(newExpanded);
                                        }}
                                      >
                                        <div className={`p-1.5 ${isIncome ? 'bg-green-100' : 'bg-red-100'} rounded-lg mr-2`}>
                                          {isIncome ? (
                                            <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                            </svg>
                                          ) : (
                                            <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 0h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                            </svg>
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                                            <p className="text-xs font-medium text-gray-900 truncate">
                                              {isIncome ? 'Pendapatan diterima' : 'Pengeluaran dicatat'}
                                            </p>
                                            <span className="text-xs text-gray-500">{formatDateDisplay(transaction.transaction_date?.split('T')[0] || '')}</span>
                                          </div>
                                          <p className="text-xs text-gray-500 truncate">
                                            {transaction.project_name && `${transaction.project_name} - `}
                                            {transaction.reference_number || transaction.category_name} - {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(transaction.amount)}
                                          </p>
                                        </div>
                                      </div>
                                      {/* Expanded Detail Section */}
                                      {isExpanded && (
                                        <div className="px-4 py-3 bg-white border-t border-gray-200 space-y-3">
                                          <div className="flex flex-wrap items-center gap-3 mb-2">
                                            <span className="text-xs text-gray-700 font-semibold">Tanggal: {formatDateDisplay(transaction.transaction_date?.split('T')[0] || '')}</span>
                                            <span className={`text-xs font-semibold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>Jumlah: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(transaction.amount)}</span>
                                          </div>
                                          <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                              <span className="font-medium text-gray-500">Deskripsi:</span>
                                              <p className="text-gray-900 mt-0.5">{transaction.description || '-'}</p>
                                            </div>
                                            {transaction.category_name && (
                                              <div>
                                                <span className="font-medium text-gray-500">Kategori:</span>
                                                <p className="text-gray-900 mt-0.5">{transaction.category_name}</p>
                                              </div>
                                            )}
                                            {transaction.reference_number && (
                                              <div>
                                                <span className="font-medium text-gray-500">No. Referensi:</span>
                                                <p className="text-gray-900 mt-0.5">{transaction.reference_number}</p>
                                              </div>
                                            )}
                                            {transaction.notes && (
                                              <div className="col-span-2">
                                                <span className="font-medium text-gray-500">Catatan:</span>
                                                <p className="text-gray-900 mt-0.5">{transaction.notes}</p>
                                              </div>
                                            )}
                                          </div>
                                          {/* Detail Barang/Item Section */}
                                          {Array.isArray(transaction.items) && transaction.items.length > 0 && (
                                            <div className="mt-2">
                                              <span className="block text-xs font-semibold text-gray-700 mb-1">Detail Barang/Item:</span>
                                              <div className="overflow-x-auto">
                                                <table className="min-w-full text-xs border border-gray-200 rounded-lg">
                                                  <thead>
                                                    <tr className="bg-gray-100">
                                                      <th className="px-2 py-1 border-b text-left">Nama Barang</th>
                                                      <th className="px-2 py-1 border-b text-left">Jumlah</th>
                                                      <th className="px-2 py-1 border-b text-left">Satuan</th>
                                                      <th className="px-2 py-1 border-b text-left">Harga Satuan</th>
                                                      <th className="px-2 py-1 border-b text-left">Subtotal</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {transaction.items.map((item: any, idx: number) => (
                                                      <tr key={idx}>
                                                        <td className="px-2 py-1 border-b">{item.item_name || '-'}</td>
                                                        <td className="px-2 py-1 border-b">{item.quantity || '-'}</td>
                                                        <td className="px-2 py-1 border-b">{item.unit || '-'}</td>
                                                        <td className="px-2 py-1 border-b">{item.unit_price ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.unit_price) : '-'}</td>
                                                        <td className="px-2 py-1 border-b">{item.subtotal || item.total_price ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.subtotal || item.total_price) : '-'}</td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-xs sm:text-sm text-gray-500">
                          Tidak ada transaksi ditemukan
                        </div>
                      )}
                    </div>
                    {/* Modal Footer */}
                    <div className="px-3 py-2 sm:py-2.5 border-t border-gray-200">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-1.5 mb-1.5 sm:mb-2">
                        <div className="text-xs text-gray-600">
                          Total: {allTransactions.length} transaksi
                        </div>
                        <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-3 text-xs">
                          <div className="text-green-600 font-medium">
                            Pemasukan: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(
                              allTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount || 0), 0)
                            )}
                          </div>
                          <div className="text-red-600 font-medium">
                            Pengeluaran: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(
                              allTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount || 0), 0)
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <h3 className="text-base font-semibold text-gray-900 mb-3">Recent Activity</h3>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Loading activities...</p>
                  </div>
                ) : recentTransactions.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="h-12 w-12 text-gray-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm text-gray-500">Belum ada aktivitas</p>
                  </div>
                ) : (
                  <>
                    {(showAllActivity 
                      ? recentTransactions.slice((activityPage - 1) * activityPerPage, activityPage * activityPerPage)
                      : recentTransactions.slice(0, 10)
                    ).map((transaction) => {
                    const isIncome = transaction.type === 'income';
                    const timeAgo = formatTimeAgo(transaction.created_at);
                    const transactionDate = transaction.transaction_date 
                      ? formatDateDisplay(transaction.transaction_date) 
                      : '';
                    
                    return (
                      <div key={transaction.id} className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className={`p-2 ${isIncome ? 'bg-green-100' : 'bg-red-100'} rounded-lg mr-3`}>
                          {isIncome ? (
                            <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 0h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {isIncome ? 'Pendapatan diterima' : 'Pengeluaran dicatat'}{transactionDate && ` (${transactionDate})`}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {transaction.project_name && `${transaction.project_name} - `}
                            {transaction.reference_number || transaction.category_name} - {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(transaction.amount)}
                          </p>
                          <span className="text-xs text-gray-400">{timeAgo}</span>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <button
                            onClick={() => handleEditTransaction(transaction)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit transaksi"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction(transaction.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus transaksi"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  </>
                )}
              </div>

              {/* Lihat Semua Button & Pagination */}
              {!loading && recentTransactions.length > 10 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  {!showAllActivity ? (
                    <button
                      onClick={() => {
                        setShowAllActivity(true);
                        setActivityPage(1);
                      }}
                      className="w-full px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                    >
                      Lihat Semua ({recentTransactions.length} transaksi)
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <button
                        onClick={() => {
                          setShowAllActivity(false);
                          setActivityPage(1);
                        }}
                        className="w-full px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Tampilkan Lebih Sedikit
                      </button>
                      
                      {/* Pagination Controls */}
                      {Math.ceil(recentTransactions.length / activityPerPage) > 1 && (
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                            disabled={activityPage === 1}
                            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            ← Sebelumnya
                          </button>
                          
                          <span className="text-sm text-gray-600">
                            Halaman {activityPage} dari {Math.ceil(recentTransactions.length / activityPerPage)}
                          </span>
                          
                          <button
                            onClick={() => setActivityPage(p => Math.min(Math.ceil(recentTransactions.length / activityPerPage), p + 1))}
                            disabled={activityPage === Math.ceil(recentTransactions.length / activityPerPage)}
                            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Selanjutnya →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Transaction Modal */}
        {showTransactionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[95vh] overflow-y-auto">
              <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-base font-semibold text-gray-900">
                  {isEditMode ? 'Edit Transaksi' : 'Catat Transaksi'}
                </h2>
                <button
                  onClick={() => {
                    setShowTransactionModal(false);
                    resetTransactionForm();
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-3 sm:px-5 py-3 sm:py-4 space-y-4">
                {/* Transaction Type Selection */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Jenis Transaksi *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setTransactionType('income')}
                      className={`p-2 border-2 rounded-lg text-center transition-colors ${
                        transactionType === 'income'
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-xs font-medium text-gray-900">Uang Masuk</div>
                      <div className="text-xs text-gray-500">Dari client</div>
                    </button>
                    <button
                      onClick={() => setTransactionType('expense')}
                      className={`p-2 border-2 rounded-lg text-center transition-colors ${
                        transactionType === 'expense'
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-xs font-medium text-gray-900">Uang Keluar</div>
                      <div className="text-xs text-gray-500">Pengeluaran</div>
                    </button>
                  </div>
                </div>

                {/* Expense Type Selection (only for expense) */}
                {transactionType === 'expense' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Tipe Pencatatan Pengeluaran
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setExpenseType('simple')}
                        className={`p-2 border-2 rounded-lg text-left transition-colors ${
                          expenseType === 'simple'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-xs text-gray-900">Sederhana <span className="text-gray-500">(Deskripsi & total saja)</span></div>
                      </button>
                      <button
                        onClick={() => setExpenseType('detailed')}
                        className={`p-2 border-2 rounded-lg text-left transition-colors ${
                          expenseType === 'detailed'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-xs text-gray-900">Detail Lengkap <span className="text-gray-500">(Salin data nota)</span></div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Project & Transaction Date in one row */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Project Selection */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Project *
                    </label>
                    <select
                      value={transactionForm.project_id}
                      onChange={(e) => handleProjectChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Pilih Project</option>
                      {projects.filter(project => project.status === 'active').map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name} {project.client_name ? `- ${project.client_name}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Transaction Date */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Tanggal Transaksi
                    </label>
                    <input
                      type="date"
                      value={transactionForm.transaction_date}
                      onChange={(e) => setTransactionForm({ ...transactionForm, transaction_date: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                {/* Project Summary */}
                {transactionForm.project_id && (
                  <>
                    {loadingProjectSummary && (
                      <div className="p-3 bg-gray-50 rounded-md">
                        <div className="text-sm text-gray-500">Memuat data project...</div>
                      </div>
                    )}
                    
                    {projectSummary && !loadingProjectSummary && (
                      <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                        <div className="text-xs font-semibold text-gray-800 mb-2">
                          📊 {projectSummary.name}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-white p-2 rounded-md shadow-sm">
                            <div className="text-xs text-gray-500 mb-0.5">Total Uang Masuk</div>
                            <div className="text-sm font-bold text-green-600">
                              Rp {projectSummary.total_income.toLocaleString('id-ID')}
                            </div>
                          </div>
                          <div className="bg-white p-2 rounded-md shadow-sm">
                            <div className="text-xs text-gray-500 mb-0.5">Total Uang Keluar</div>
                            <div className="text-sm font-bold text-red-600">
                              Rp {projectSummary.total_expense.toLocaleString('id-ID')}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-blue-200">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-medium text-gray-700">Saldo Project:</span>
                            <span className={`text-sm font-bold ${
                              (projectSummary.total_income - projectSummary.total_expense) >= 0 
                                ? 'text-green-600' 
                                : 'text-red-600'
                            }`}>
                              Rp {(projectSummary.total_income - projectSummary.total_expense).toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Keterangan Pembayaran & Nomor Referensi in one row (for income) */}
                {transactionType === 'income' && (
                  <div className="grid grid-cols-2 gap-2">
                    {/* Description */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Keterangan Pembayaran
                      </label>
                      <input
                        type="text"
                        value={transactionForm.description}
                        onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                        placeholder="Contoh: Pembayaran DP 50%"
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    {/* Reference Number */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Nomor Referensi (Opsional)
                      </label>
                      <input
                        type="text"
                        value={transactionForm.receipt_number}
                        onChange={(e) => setTransactionForm({ ...transactionForm, receipt_number: e.target.value })}
                        placeholder="Contoh: INV-001, REF-123"
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                )}

                {/* Category & Description in one row (for simple expense) */}
                {transactionType === 'expense' && expenseType === 'simple' && (
                  <div className="grid grid-cols-2 gap-2">
                    {/* Category */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Kategori
                      </label>
                      <select
                        value={transactionForm.category_id}
                        onChange={(e) => setTransactionForm({ ...transactionForm, category_id: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Pilih Kategori</option>
                        {categories
                          .filter(cat => cat.type === 'expense')
                          .map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))
                        }
                      </select>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Keterangan/Deskripsi
                      </label>
                      <input
                        type="text"
                        value={transactionForm.description}
                        onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                        placeholder="Contoh: Pembayaran Gaji"
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                )}

                {/* Nomor Referensi & Jumlah in one row (for income) */}
                {transactionType === 'income' && (
                  <div className="grid grid-cols-2 gap-2">
                    {/* Reference Number */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Nomor Referensi (Opsional)
                      </label>
                      <input
                        type="text"
                        value={transactionForm.receipt_number}
                        onChange={(e) => setTransactionForm({ ...transactionForm, receipt_number: e.target.value })}
                        placeholder="Contoh: INV-001, REF-123"
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Jumlah (Rp) *
                      </label>
                      <input
                        type="text"
                        value={transactionForm.amount}
                        onChange={(e) => setTransactionForm({ ...transactionForm, amount: formatNumberWithSeparator(e.target.value) })}
                        placeholder="0"
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                )}

                {/* Nomor Referensi & Jumlah in one row (for simple expense) */}
                {transactionType === 'expense' && expenseType === 'simple' && (
                  <div className="grid grid-cols-2 gap-2">
                    {/* Reference Number */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Nomor Referensi (Opsional)
                      </label>
                      <input
                        type="text"
                        value={transactionForm.receipt_number}
                        onChange={(e) => setTransactionForm({ ...transactionForm, receipt_number: e.target.value })}
                        placeholder="Contoh: INV-001, REF-123"
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Jumlah (Rp) *
                      </label>
                      <input
                        type="text"
                        value={transactionForm.amount}
                        onChange={(e) => setTransactionForm({ ...transactionForm, amount: formatNumberWithSeparator(e.target.value) })}
                        placeholder="0"
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                )}

                {/* Supplier & Receipt Number in one row (for detailed expense) */}
                {transactionType === 'expense' && expenseType === 'detailed' && (
                  <div className="grid grid-cols-2 gap-2">
                    {/* Supplier */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Kelompok
                      </label>
                      <input
                        type="text"
                        value={transactionForm.description}
                        onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                        placeholder="Pengeluaran"
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled
                      />
                    </div>

                    {/* Receipt Number */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Jenis Pengeluaran *
                      </label>
                      <select
                        value={transactionForm.receipt_number}
                        onChange={(e) => setTransactionForm({ ...transactionForm, receipt_number: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Pilih Jenis Pengeluarannya</option>
                        <option value="Bahan Material">Bahan Material</option>
                        <option value="Operasional">Operasional</option>
                        <option value="Konsumsi">Konsumsi</option>
                        <option value="Upah Tukang">Upah Tukang</option>
                        <option value="Gaji">Gaji</option>
                        <option value="Jasa">Jasa</option>
                        <option value="Elektrikal">Elektrikal</option>
                        <option value="Ojek Ibu">Ojek Ibu</option>
                        <option value="Kiting">Kiting</option>
                        <option value="Lainnya">Lainnya</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Detail Items Table (for detailed expense) */}
                {transactionType === 'expense' && expenseType === 'detailed' && (
                  <div className="border border-gray-300 rounded-lg px-2 py-2 sm:py-3 bg-gray-50">
                    <div className="flex justify-between items-center mb-2 sm:mb-3">
                      <label className="text-sm font-medium text-gray-700">
                        Detail Barang/Item *
                      </label>
                      <button
                        type="button"
                        onClick={handleAddDetailItem}
                        className="text-xs sm:text-sm text-primary-600 hover:text-primary-700 font-medium px-3 py-2"
                      >
                        + Tambah Item
                      </button>
                    </div>
                    
                    <div className="space-y-2 sm:space-y-3">
                      {detailItems.map((item, index) => (
                        <div key={index} className="bg-white px-2 py-2 sm:py-3 rounded-lg border border-gray-200">
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {/* Item Name */}
                            <div className="w-full sm:w-[28.67%]">
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Nama Barang
                              </label>
                              <input
                                type="text"
                                value={item.item_name}
                                onChange={(e) => handleDetailItemChange(index, 'item_name', e.target.value)}
                                placeholder="Nama barang"
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </div>

                            {/* Quantity */}
                            <div className="w-[25%] sm:w-[14%]">
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Jumlah
                              </label>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => handleDetailItemChange(index, 'quantity', parseFloat(e.target.value) || 1)}
                                min="0.01"
                                step="any"
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </div>                            {/* Unit */}
                            <div className="w-[33.33%] sm:w-[14%]">
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Satuan
                              </label>
                              <select
                                value={item.unit || 'Buah'}
                                onChange={(e) => handleDetailItemChange(index, 'unit', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                              >
                                <option value="Buah">Buah</option>
                                <option value="Box">Box</option>
                                <option value="Set">Set</option>
                                <option value="Kotak">Kotak</option>
                              </select>
                            </div>

                            {/* Unit Price */}
                            <div className="w-[33.33%] sm:w-[16.67%]">
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Harga (Rp)
                              </label>
                              <input
                                type="text"
                                value={formatNumberWithSeparator(item.unit_price)}
                                onChange={(e) => {
                                  const numericValue = parseFormattedNumber(e.target.value);
                                  handleDetailItemChange(index, 'unit_price', numericValue);
                                }}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </div>

                            {/* Subtotal */}
                            <div className="w-[calc(41.67%-0.375rem)] sm:w-[14.33%]">
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Subtotal
                              </label>
                              <div className="px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded-md">
                                {(item.subtotal || 0).toLocaleString('id-ID')}
                              </div>
                            </div>

                            {/* Remove Button */}
                            <div className="w-[8.33%] sm:w-[4.17%] flex items-end">
                              {detailItems.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDetailItem(index)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded min-h-[44px] min-w-[44px] flex items-center justify-center"
                                  title="Hapus item"
                                >
                                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div className="mt-2 pt-2 border-t border-gray-300">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-700">Total Keseluruhan:</span>
                        <span className="text-sm font-bold text-gray-900">
                          Rp {parseFormattedNumber(transactionForm.amount || '0').toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Catatan Tambahan
                  </label>
                  <textarea
                    value={transactionForm.notes}
                    onChange={(e) => setTransactionForm({ ...transactionForm, notes: e.target.value })}
                    rows={2}
                    placeholder="Catatan tambahan..."
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-3 sm:px-5 py-3 sm:py-4 border-t border-gray-200 flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setShowTransactionModal(false);
                    resetTransactionForm();
                  }}
                  className="px-4 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 min-h-[44px]"
                  disabled={saving}
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveTransaction}
                  disabled={saving}
                  className="px-4 py-2.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 min-h-[44px]"
                >
                  {saving ? (isEditMode ? 'Mengupdate...' : 'Menyimpan...') : (isEditMode ? 'Update Transaksi' : 'Simpan Transaksi')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
