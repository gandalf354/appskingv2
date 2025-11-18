import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuthStore } from '../src/store/authStore';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '../src/utils/numberFormat';
import { formatDateDisplay } from '../src/utils/dateUtils';




interface CashflowData {
  total_income: number;
  total_expense: number;
  net_cashflow: number;
  transaction_count: number;
}

interface ProjectCashflow {
  project_id: number;
  project_name: string;
  client_name?: string;
  budget: number;
  total_income: number;
  total_expense: number;
  net_cashflow: number;
  transaction_count: number;
}

interface TransactionDetail {
  id: number;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category_name?: string;
  category_id?: number;
  payment_method_name?: string;
  payment_method_id?: number;
  transaction_date: string;
  reference_number?: string;
  receipt_number?: string;
  notes?: string;
  items?: string;
  project_name?: string;
}
export default function Reports() {
  // State untuk ekspansi project
  const [expandedProjectId, setExpandedProjectId] = useState<number | null>(null);
  // State untuk loading dan data summary kategori per project
  const [loadingCategorySummary, setLoadingCategorySummary] = useState(false);
  const [categorySummary, setCategorySummary] = useState<{
    income: any[];
    expense: any[];
  } | null>(null);

  // Fungsi untuk mengambil summary kategori per project
  const fetchCategorySummary = async (projectId: number) => {
    setLoadingCategorySummary(true);
    try {
      // Fetch summary per project sesuai backend baru
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/cashflow/project-category-summary?project_id=${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        // Data backend: { expense: [...], income: [...] }
        setCategorySummary({ income: data.income || [], expense: data.expense || [] });
      } else {
        setCategorySummary({ income: [], expense: [] });
      }
    } catch (e) {
      setCategorySummary({ income: [], expense: [] });
    }
    setLoadingCategorySummary(false);
  };
  const router = useRouter();
  const { user, token, checkAuth } = useAuthStore();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [overallCashflow, setOverallCashflow] = useState<CashflowData | null>(null);
  const [projectCashflows, setProjectCashflows] = useState<ProjectCashflow[]>([]);
  const [dateFilter, setDateFilter] = useState({
    start_date: '',
    end_date: ''
  });
  // ...existing code...
  
  // Transaction Detail Modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectCashflow | null>(null);
  const [transactionDetails, setTransactionDetails] = useState<TransactionDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [expandedTransactions, setExpandedTransactions] = useState<Set<number>>(new Set());

  // Transaction Edit Modal (duplicated from Dashboard)
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
  const [expenseType, setExpenseType] = useState<'simple' | 'detailed'>('simple');
  const [projects, setProjects] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [projectSummary, setProjectSummary] = useState<{
    name: string;
    total_income: number;
    total_expense: number;
  } | null>(null);
  const [loadingProjectSummary, setLoadingProjectSummary] = useState(false);
  const [transactionForm, setTransactionForm] = useState({
    project_id: '',
    amount: '',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
    category_id: '',
    payment_method_id: '',
    receipt_number: '',
    notes: ''
  });
  const [detailItems, setDetailItems] = useState<any[]>([{
    item_name: '',
    quantity: 1,
    unit: 'Buah',
    unit_price: 0,
    subtotal: 0
  }]);

  useEffect(() => {
    setMounted(true);
    checkAuth();
  }, []);

  useEffect(() => {
    if (mounted && !user) {
      router.push('/login');
    }
  }, [user, router, mounted]);

  useEffect(() => {
    if (token && user) {
      fetchReports();
      fetchProjects();
      fetchCategories();
      fetchPaymentMethods();
    }
  }, [token, user]);

  const fetchReports = async () => {
    if (!token) return;

    try {
      setLoading(true);

      // Fetch overall cashflow
      const overallResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/reports/cashflow/overall?${new URLSearchParams(dateFilter)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (overallResponse.ok) {
        const data = await overallResponse.json();
        setOverallCashflow(data);
      }

      // Fetch project cashflows
      const projectResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/reports/cashflow/projects?${new URLSearchParams(dateFilter)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (projectResponse.ok) {
        const data = await projectResponse.json();
        setProjectCashflows(data);
      }

    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Gagal memuat laporan');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    setDateFilter({ ...dateFilter, [field]: value });
  };

  const applyFilter = () => {
    fetchReports();
  };

  const resetFilter = () => {
    setDateFilter({ start_date: '', end_date: '' });
    setTimeout(() => fetchReports(), 100);
  };

  const fetchTransactionDetails = async (project: ProjectCashflow) => {
    if (!token) return;

    try {
      setLoadingDetails(true);
      setSelectedProject(project);
      setShowDetailModal(true);

      const params = new URLSearchParams({
        project_id: project.project_id.toString(),
        limit: '1000', // Get all transactions for this project
        ...dateFilter
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/transactions?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Backend returns { transactions: [...], pagination: {...} }
        const transactions = data.transactions || [];
        
        console.log('=== TRANSACTION DETAILS DEBUG ===');
        console.log('Total transactions:', transactions.length);
        console.log('All transactions:', transactions);
        
        const expenses = transactions.filter((t: any) => t.type === 'expense');
        console.log('Expense transactions:', expenses);
        console.log('Expense amounts:', expenses.map((t: any) => ({ id: t.id, amount: t.amount, type: typeof t.amount })));
        
        const totalExpense = expenses.reduce((sum: number, t: any) => {
          const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount;
          console.log(`Adding expense ${t.id}: ${amount} (${typeof t.amount})`);
          return sum + amount;
        }, 0);
        console.log('Total expense calculated:', totalExpense);
        
        setTransactionDetails(transactions);
      } else {
        toast.error('Gagal memuat detail transaksi');
      }

    } catch (error) {
      console.error('Error fetching transaction details:', error);
      toast.error('Gagal memuat detail transaksi');
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedProject(null);
    setTransactionDetails([]);
  };

  // Fetch helper functions (duplicated from Dashboard)
  const fetchProjects = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects?limit=1000`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(data.transaction_categories || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payment-methods`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data.payment_methods || []);
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    }
  };

  const getJakartaDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatNumberWithSeparator = (value: number | string): string => {
    const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
    return numValue.toLocaleString('id-ID');
  };

  const parseFormattedNumber = (value: string): number => {
    const cleanValue = value.replace(/\./g, '').replace(/,/g, '.');
    return parseFloat(cleanValue) || 0;
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
      const qty = field === 'quantity' ? parseFloat(value) || 0 : newItems[index].quantity;
      const price = field === 'unit_price' ? parseFloat(value) || 0 : newItems[index].unit_price;
      newItems[index].subtotal = qty * price;
    }
    
    setDetailItems(newItems);
    calculateTotalAmount(newItems);
  };

  const calculateTotalAmount = (items: any[]) => {
    const total = items.reduce((sum, item) => {
      const subtotal = typeof item.subtotal === 'string' ? parseFloat(item.subtotal) || 0 : item.subtotal || 0;
      return sum + subtotal;
    }, 0);
    setTransactionForm({
      ...transactionForm,
      amount: formatNumberWithSeparator(total)
    });
  };

  const resetTransactionForm = () => {
    setIsEditMode(false);
    setEditingTransaction(null);
    setTransactionType('expense');
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
  };

  const handleEditTransaction = async (transactionId: number) => {
    try {
      // Close detail modal first
      closeDetailModal();
      
      // Fetch full transaction details
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions/${transactionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        // Set edit mode
        setIsEditMode(true);
        setEditingTransaction({ id: transactionId, type: data.type });
        setTransactionType(data.type);
        
        // Set expense type based on whether transaction has items or not
        if (data.type === 'expense') {
          if (data.items && data.items.length > 0) {
            setExpenseType('detailed');
            setDetailItems(data.items.map((item: any) => ({
              item_name: item.item_name || '',
              quantity: item.quantity || 1,
              unit: item.unit || 'Buah',
              unit_price: parseFloat(item.unit_price || 0),
              subtotal: parseFloat(item.total_price || 0)
            })));
          } else {
            setExpenseType('simple');
          }
        }
        
        // Convert transaction_date to YYYY-MM-DD format for date input
        let formattedDate = getJakartaDate();
        if (data.transaction_date) {
          try {
            const dateStr = String(data.transaction_date);
            if (dateStr.match(/^\d{4}-\d{2}-\d{2}($|T)/)) {
              formattedDate = dateStr.split('T')[0];
            }
          } catch (e) {
            console.error('Error parsing date:', e);
          }
        }
        
        // Set form values
        setTransactionForm({
          project_id: data.project_id?.toString() || '',
          amount: formatNumberWithSeparator(data.amount || 0),
          description: data.description || '',
          transaction_date: formattedDate,
          category_id: data.category_id?.toString() || '',
          payment_method_id: data.payment_method_id?.toString() || '',
          receipt_number: data.reference_number || '',
          notes: data.notes || ''
        });
        
        // Fetch project summary if project is selected
        if (data.project_id) {
          fetchProjectSummary(data.project_id.toString());
        }
        
        // Show transaction modal
        setShowTransactionModal(true);
      } else {
        toast.error('Gagal memuat data transaksi');
      }
    } catch (error) {
      console.error('Error loading transaction:', error);
      toast.error('Gagal memuat data transaksi');
    }
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
      
      const payload = {
        type: transactionType,
        amount: parseFormattedNumber(transactionForm.amount),
        description: transactionForm.description || '',
        date: transactionForm.transaction_date,
        category_id: transactionForm.category_id || null,
        project_id: parseInt(transactionForm.project_id),
        payment_method_id: transactionForm.payment_method_id || null,
        reference_number: transactionForm.receipt_number || null,
        notes: transactionForm.notes || null,
        items: transactionType === 'expense' && expenseType === 'detailed' ? JSON.stringify(detailItems) : undefined
      };

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
        fetchReports();
      } else {
        const error = await response.json();
        toast.error(`Error: ${error.error || 'Gagal menyimpan transaksi'}`);
      }
    } catch (error) {
      console.error('Save transaction error:', error);
      toast.error('Gagal menyimpan transaksi');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTransaction = async (transactionId: number) => {
    if (!token) return;

    const confirmed = confirm('Apakah Anda yakin ingin menghapus transaksi ini?');
    if (!confirmed) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions/${transactionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        toast.success('Transaksi berhasil dihapus!');
        // Refresh transaction details
        if (selectedProject) {
          fetchTransactionDetails(selectedProject);
        }
        // Refresh cashflow data
        fetchReports();
      } else {
        const error = await response.json();
        toast.error(`Error: ${error.error || 'Gagal menghapus transaksi'}`);
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error('Terjadi kesalahan saat menghapus transaksi');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat laporan...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Laporan Cashflow - AppsKing Finance</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="text-gray-600 hover:text-gray-900 text-sm"
                >
                  ← Kembali
                </button>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-gray-900">📊 Laporan Cashflow</h1>
                  <p className="text-xs text-gray-500">Analisis keuangan keseluruhan dan per project</p>
                </div>
              </div>
              <div className="text-xs sm:text-sm text-gray-600">
                {user?.name}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
          {/* Date Filter */}
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Filter Periode</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Tanggal Mulai
                </label>
                <input
                  type="date"
                  value={dateFilter.start_date}
                  onChange={(e) => handleFilterChange('start_date', e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Tanggal Akhir
                </label>
                <input
                  type="date"
                  value={dateFilter.end_date}
                  onChange={(e) => handleFilterChange('end_date', e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="sm:col-span-2 flex items-end space-x-2">
                <button
                  onClick={applyFilter}
                  className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Terapkan
                </button>
                <button
                  onClick={resetFilter}
                  className="flex-1 px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Overall Cashflow */}
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4">
            <h2 className="text-base font-semibold text-gray-900 mb-3">📈 Cashflow Keseluruhan</h2>
            {overallCashflow ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <div className="text-xs text-gray-600 mb-1">Total Uang Masuk</div>
                  <div className="text-lg sm:text-xl font-bold text-green-600">
                    {formatCurrency(overallCashflow.total_income)}
                  </div>
                </div>
                <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                  <div className="text-xs text-gray-600 mb-1">Total Uang Keluar</div>
                  <div className="text-lg sm:text-xl font-bold text-red-600">
                    {formatCurrency(overallCashflow.total_expense)}
                  </div>
                </div>
                <div className={`p-3 rounded-lg border ${
                  overallCashflow.net_cashflow >= 0 
                    ? 'bg-blue-50 border-blue-200' 
                    : 'bg-orange-50 border-orange-200'
                }`}>
                  <div className="text-xs text-gray-600 mb-1">Net Cashflow</div>
                  <div className={`text-lg sm:text-xl font-bold ${
                    overallCashflow.net_cashflow >= 0 
                      ? 'text-blue-600' 
                      : 'text-orange-600'
                  }`}>
                    {formatCurrency(overallCashflow.net_cashflow)}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-600 mb-1">Total Transaksi</div>
                  <div className="text-lg sm:text-xl font-bold text-gray-900">
                    {overallCashflow.transaction_count}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-gray-500">
                Belum ada data transaksi
              </div>
            )}
          </div>

          {/* Project Cashflows */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">🎯 Cashflow Per Project</h2>
            </div>
            {projectCashflows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Project
                      </th>
                      <th className="px-3 sm:px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Budget
                      </th>
                      <th className="px-3 sm:px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Uang Masuk
                      </th>
                      <th className="px-3 sm:px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Uang Keluar
                      </th>
                      <th className="px-3 sm:px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Net Cashflow
                      </th>
                      <th className="px-3 sm:px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Transaksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {projectCashflows.map((project) => (
                      <>
                        <tr key={project.project_id} className="hover:bg-gray-50 cursor-pointer" onClick={() => {
                          if (expandedProjectId === project.project_id) {
                            setExpandedProjectId(null);
                          } else {
                            setExpandedProjectId(project.project_id);
                            fetchCategorySummary(project.project_id);
                          }
                        }}>
                          <td className="px-3 sm:px-4 py-2.5 sm:py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs sm:text-sm font-medium text-gray-900">{project.project_name}</span>
                              {expandedProjectId === project.project_id && (
                                <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                              )}
                            </div>
                            {project.client_name && (
                              <div className="text-xs text-gray-500">{project.client_name}</div>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-right text-xs sm:text-sm font-semibold text-gray-900">{formatCurrency(project.budget)}</td>
                          <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-right text-xs sm:text-sm font-semibold text-green-600">{formatCurrency(project.total_income)}</td>
                          <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-right text-xs sm:text-sm font-semibold text-red-600">{formatCurrency(project.total_expense)}</td>
                          <td className={`px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-right text-xs sm:text-sm font-bold ${project.net_cashflow >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{formatCurrency(project.net_cashflow)}</td>
                          <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-center">
                            <button
                              onClick={e => { e.stopPropagation(); fetchTransactionDetails(project); }}
                              className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            >
                              {project.transaction_count}
                            </button>
                          </td>
                        </tr>
                        {expandedProjectId === project.project_id && (
                          <tr>
                            <td colSpan={6} className="bg-blue-50 border-b border-blue-200 px-4 py-3">
                              {loadingCategorySummary ? (
                                <div className="text-center text-xs text-blue-600">Memuat summary kategori...</div>
                              ) : categorySummary ? (
                                <>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <h4 className="text-xs font-semibold text-green-700 mb-2">Pemasukan per Kategori</h4>
                                      <ul className="space-y-1">
                                        {categorySummary.income.length === 0 && <li className="text-xs text-gray-400">Tidak ada pemasukan</li>}
                                        {categorySummary.income.length > 0 && categorySummary.income.map((cat: any, idx: number) => (
                                          <li key={cat.category_name + idx} className="flex justify-between text-xs items-center">
                                            <span>{cat.category_name || '-'}</span>
                                            <span className="font-semibold text-green-700">{formatCurrency(cat.total_amount)}</span>
                                            <span className="text-xs text-gray-500 cursor-pointer underline hover:text-green-900" onClick={async () => {
                                              setLoadingDetails(true);
                                              setShowDetailModal(true);
                                              setSelectedProject(project);
                                              try {
                                                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/income-details?project_id=${project.project_id}&category_name=${encodeURIComponent(cat.category_name)}`,
                                                  {
                                                    headers: {
                                                      'Authorization': `Bearer ${token}`
                                                    }
                                                  }
                                                );
                                                if (res.ok) {
                                                  const data = await res.json();
                                                  setTransactionDetails(data.transactions || []);
                                                } else {
                                                  setTransactionDetails([]);
                                                }
                                              } catch {
                                                setTransactionDetails([]);
                                              }
                                              setLoadingDetails(false);
                                            }}>{cat.jumlah}x</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                    <div>
                                      <h4 className="text-xs font-semibold text-red-700 mb-2">Pengeluaran per Reference Number</h4>
                                      <ul className="space-y-1">
                                        {(!categorySummary.expense || categorySummary.expense.length === 0) && (
                                          <li className="text-xs text-gray-400">Tidak ada pengeluaran</li>
                                        )}
                                        {categorySummary.expense && categorySummary.expense.length > 0 && (
                                          <>
                                            <li className="flex font-bold text-xs text-gray-700 border-b border-gray-200 pb-1">
                                              <span className="w-1/3">Reference Number</span>
                                              <span className="w-1/3 text-right">Total Amount</span>
                                              <span className="w-1/3 text-right">Jumlah</span>
                                            </li>
                                            {categorySummary.expense.map((row: any, idx: number) => (
                                              <li key={row.reference_number || idx} className="flex text-xs items-center border-b border-gray-100 py-1">
                                                <span className="w-1/3 font-semibold text-gray-900">{row.reference_number || '-'}</span>
                                                <span className="w-1/3 text-right text-red-700">{formatCurrency(row.total_amount)}</span>
                                                <span className="w-1/3 text-right cursor-pointer underline hover:text-red-900" onClick={async () => {
                                                  setLoadingDetails(true);
                                                  setShowDetailModal(true);
                                                  setSelectedProject(project);
                                                  try {
                                                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/expense-details?project_id=${project.project_id}&reference_number=${encodeURIComponent(row.reference_number)}`,
                                                      {
                                                        headers: {
                                                          'Authorization': `Bearer ${token}`
                                                        }
                                                      }
                                                    );
                                                    if (res.ok) {
                                                      const data = await res.json();
                                                      setTransactionDetails(data.transactions || []);
                                                    } else {
                                                      setTransactionDetails([]);
                                                    }
                                                  } catch {
                                                    setTransactionDetails([]);
                                                  }
                                                  setLoadingDetails(false);
                                                }}>{row.jumlah}x</span>
                                              </li>
                                            ))}
                                          </>
                                        )}
                                      </ul>
                                    </div>
                                  </div>
                                  <div className="mt-4 text-xs text-gray-700 font-semibold text-right">
                                    Total Transaksi: {project.transaction_count}
                                  </div>
                                </>
                              ) : null}
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-gray-500">
                Belum ada data project dengan transaksi
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-3 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-3 py-2 sm:py-2.5 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">
                  Detail Transaksi
                </h3>
                {selectedProject && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selectedProject.project_name}
                    {selectedProject.client_name && ` - ${selectedProject.client_name}`}
                  </p>
                )}
              </div>
              <button
                onClick={closeDetailModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-3 py-2 sm:py-3">
              {loadingDetails ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : transactionDetails.length > 0 ? (
                <div className="space-y-3">
                  {/* Group transactions by date */}
                  {Object.entries(
                    transactionDetails.reduce((groups: Record<string, TransactionDetail[]>, transaction) => {
                      const date = transaction.transaction_date.split('T')[0]; // Get YYYY-MM-DD
                      if (!groups[date]) {
                        groups[date] = [];
                      }
                      groups[date].push(transaction);
                      return groups;
                    }, {})
                  )
                  .sort(([dateA], [dateB]) => dateB.localeCompare(dateA)) // Sort dates descending
                  .map(([date, transactions]) => {
                    // Calculate totals for this date
                    const totalIncome = transactions
                      .filter(t => t.type === 'income')
                      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
                    const totalExpense = transactions
                      .filter(t => t.type === 'expense')
                      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
                    
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
                      {transactions.map((transaction) => {
                        const isIncome = transaction.type === 'income';
                        const isExpanded = expandedTransactions.has(transaction.id);
                        return (
                          <div key={transaction.id} className="bg-gray-50 rounded-lg overflow-hidden">
                            {/* Main Transaction Row */}
                            <div 
                              className="flex items-center p-2 sm:p-2.5 hover:bg-gray-100 transition-colors cursor-pointer"
                              onClick={() => {
                                const newExpanded = new Set(expandedTransactions);
                                if (isExpanded) {
                                  newExpanded.delete(transaction.id);
                                } else {
                                  newExpanded.add(transaction.id);
                                }
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
                              <div className="flex items-center gap-1 ml-1.5 sm:ml-2">
                              {/* Chevron Icon */}
                              <button
                                className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                                title={isExpanded ? "Tutup detail" : "Lihat detail"}
                              >
                                <svg 
                                  className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                                  fill="none" 
                                  viewBox="0 0 24 24" 
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditTransaction(transaction.id);
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors min-h-[32px] min-w-[32px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center"
                                title="Edit transaksi"
                              >
                                <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTransaction(transaction.id);
                                }}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors min-h-[32px] min-w-[32px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center"
                                title="Hapus transaksi"
                              >
                                <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          
                          {/* Expanded Detail Section */}
                          {isExpanded && (
                            <div className="px-4 py-3 bg-white border-t border-gray-200 space-y-3">
                              {/* Show transaction date and amount at the top of expanded section */}
                              <div className="flex flex-wrap items-center gap-3 mb-2">
                                <span className="text-xs text-gray-700 font-semibold">Tanggal: {formatDateDisplay(transaction.transaction_date?.split('T')[0] || '')}</span>
                                <span className={`text-xs font-semibold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>Jumlah: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(transaction.amount)}</span>
                              </div>
                              {/* Check if this is "Detail Lengkap" expense with items */}
                              {transaction.items ? (
                                <>
                                  {/* Basic Info Row */}
                                  <div className="grid grid-cols-2 gap-2 text-xs pb-2 border-b border-gray-200">
                                    <div>
                                      <span className="font-medium text-gray-500">Deskripsi:</span>
                                      <p className="text-gray-900 mt-0.5">{transaction.description || '-'}</p>
                                    </div>
                                    {transaction.payment_method_name && (
                                      <div>
                                        <span className="font-medium text-gray-500">Metode Pembayaran:</span>
                                        <p className="text-gray-900 mt-0.5">{transaction.payment_method_name}</p>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Items Table */}
                                  <div>
                                    <h4 className="text-xs font-semibold text-gray-700 mb-2">📋 Detail Barang/Item:</h4>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs border border-gray-200 rounded">
                                        <thead className="bg-gray-50">
                                          <tr>
                                            <th className="px-2 py-1.5 text-left border-b border-gray-200 font-semibold text-gray-700">Nama Item</th>
                                            <th className="px-2 py-1.5 text-center border-b border-gray-200 font-semibold text-gray-700">Qty</th>
                                            <th className="px-2 py-1.5 text-right border-b border-gray-200 font-semibold text-gray-700">Harga Satuan</th>
                                            <th className="px-2 py-1.5 text-right border-b border-gray-200 font-semibold text-gray-700">Subtotal</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(() => {
                                            const lines = transaction.items.split('\n').filter(line => line.trim());
                                            
                                            return lines.map((line, idx) => {
                                              // Parse format: "Nama Item - Qty: X.XX - Harga: Rp X.XXX.XXX - Subtotal: Rp X.XXX.XXX"
                                              // Updated regex to handle decimal quantities (e.g., 1.00, 2.50)
                                              const match = line.match(/^(.+?)\s*-\s*Qty:\s*([\d,.]+)\s*-\s*Harga:\s*Rp\s*([\d,.]+)\s*-\s*Subtotal:\s*Rp\s*([\d,.]+)/);
                                              if (match) {
                                                const [, itemName, qty, price, subtotal] = match;
                                                // Format price & subtotal with 3-digit separator
                                                const priceFormatted = Number(price.replace(/\./g, '').replace(/,/g, '.')).toLocaleString('id-ID');
                                                const subtotalFormatted = Number(subtotal.replace(/\./g, '').replace(/,/g, '.')).toLocaleString('id-ID');
                                                return (
                                                  <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                                                    <td className="px-2 py-1.5">{itemName}</td>
                                                    <td className="px-2 py-1.5 text-center">{qty}</td>
                                                    <td className="px-2 py-1.5 text-right">Rp {priceFormatted}</td>
                                                    <td className="px-2 py-1.5 text-right font-medium">Rp {subtotalFormatted}</td>
                                                  </tr>
                                                );
                                              }
                                              return null;
                                            });
                                          })()}
                                        </tbody>
                                        <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                                          <tr>
                                            <td colSpan={3} className="px-2 py-1.5 text-right font-semibold text-gray-700">Total:</td>
                                            <td className="px-2 py-1.5 text-right font-bold text-gray-900">
                                              {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(transaction.amount)}
                                            </td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                                  </div>
                                  
                                  {/* Additional Info */}
                                  {(transaction.reference_number || transaction.receipt_number || transaction.notes) && (
                                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-200">
                                      {transaction.reference_number && (
                                        <div>
                                          <span className="font-medium text-gray-500">No. Referensi:</span>
                                          <p className="text-gray-900 mt-0.5">{transaction.reference_number}</p>
                                        </div>
                                      )}
                                      {transaction.receipt_number && (
                                        <div>
                                          <span className="font-medium text-gray-500">No. Kwitansi:</span>
                                          <p className="text-gray-900 mt-0.5">{transaction.receipt_number}</p>
                                        </div>
                                      )}
                                      {transaction.notes && (
                                        <div className="col-span-2">
                                          <span className="font-medium text-gray-500">Catatan:</span>
                                          <p className="text-gray-900 mt-0.5">{transaction.notes}</p>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </>
                              ) : (
                                // Simple transaction without items
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
                                  {transaction.payment_method_name && (
                                    <div>
                                      <span className="font-medium text-gray-500">Metode Pembayaran:</span>
                                      <p className="text-gray-900 mt-0.5">{transaction.payment_method_name}</p>
                                    </div>
                                  )}
                                  {transaction.reference_number && (
                                    <div>
                                      <span className="font-medium text-gray-500">No. Referensi:</span>
                                      <p className="text-gray-900 mt-0.5">{transaction.reference_number}</p>
                                    </div>
                                  )}
                                  {transaction.receipt_number && (
                                    <div>
                                      <span className="font-medium text-gray-500">No. Kwitansi:</span>
                                      <p className="text-gray-900 mt-0.5">{transaction.receipt_number}</p>
                                    </div>
                                  )}
                                  {transaction.notes && (
                                    <div className="col-span-2">
                                      <span className="font-medium text-gray-500">Catatan:</span>
                                      <p className="text-gray-900 mt-0.5">{transaction.notes}</p>
                                    </div>
                                  )}
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
                  Total: {transactionDetails.length} transaksi
                </div>
                <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-3 text-xs">
                  <div className="text-green-600 font-medium">
                    Pemasukan: {formatCurrency(
                      transactionDetails
                        .filter(t => t.type === 'income')
                        .reduce((sum, t) => {
                          const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount;
                          return sum + amount;
                        }, 0)
                    )}
                  </div>
                  <div className="text-red-600 font-medium">
                    Pengeluaran: {formatCurrency(
                      transactionDetails
                        .filter(t => t.type === 'expense')
                        .reduce((sum, t) => {
                          const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount;
                          return sum + amount;
                        }, 0)
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Modal (duplicated from Dashboard) */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-base font-semibold text-gray-900">
                Edit Transaksi
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

            <div className="p-4 space-y-4">
              {/* Transaction Type - Disabled in edit mode */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Jenis Transaksi *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className={`p-2 border-2 rounded-lg text-center ${
                    transactionType === 'income' ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-100'
                  }`}>
                    <div className="text-xs font-medium text-gray-900">Uang Masuk</div>
                    <div className="text-xs text-gray-500">Dari client</div>
                  </div>
                  <div className={`p-2 border-2 rounded-lg text-center ${
                    transactionType === 'expense' ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-gray-100'
                  }`}>
                    <div className="text-xs font-medium text-gray-900">Uang Keluar</div>
                    <div className="text-xs text-gray-500">Pengeluaran</div>
                  </div>
                </div>
              </div>

              {/* Expense Type - Enabled in edit mode */}
              {transactionType === 'expense' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Tipe Pencatatan Pengeluaran
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setExpenseType('simple')}
                      disabled={isEditMode}
                      className={`p-2 border-2 rounded-lg text-left transition-colors ${
                        expenseType === 'simple'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="text-xs text-gray-900">Sederhana <span className="text-gray-500">(Deskripsi & total saja)</span></div>
                    </button>
                    <button
                      onClick={() => setExpenseType('detailed')}
                      disabled={isEditMode}
                      className={`p-2 border-2 rounded-lg text-left transition-colors ${
                        expenseType === 'detailed'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="text-xs text-gray-900">Detail Lengkap <span className="text-gray-500">(Salin data nota)</span></div>
                    </button>
                  </div>
                </div>
              )}

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
                
                {/* Project Summary */}
                {projectSummary && !loadingProjectSummary && (
                  <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
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
              </div>

              {/* Date and Category/Description Row */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Tanggal Transaksi
                  </label>
                  <input
                    type="date"
                    value={transactionForm.transaction_date}
                    onChange={(e) => setTransactionForm({ ...transactionForm, transaction_date: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {transactionType === 'expense' && expenseType === 'simple' && (
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
                      <option value="15">Gaji</option>
                      <option value="16">Lainnya</option>
                    </select>
                  </div>
                )}

                {transactionType === 'income' && (
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
                )}

                {transactionType === 'expense' && expenseType === 'detailed' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Nomor Referensi
                    </label>
                    <input
                      type="text"
                      value={transactionForm.receipt_number}
                      onChange={(e) => setTransactionForm({ ...transactionForm, receipt_number: e.target.value })}
                      placeholder="Contoh: INV-2024-001"
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                )}
              </div>

              {/* Simple Expense: Description and Amount */}
              {transactionType === 'expense' && expenseType === 'simple' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Keterangan Pengeluaran
                    </label>
                    <input
                      type="text"
                      value={transactionForm.description}
                      onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                      placeholder="Contoh: Gaji Minggu Pertama"
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Jumlah Uang Keluar *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">Rp</span>
                      <input
                        type="text"
                        value={transactionForm.amount}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\./g, '');
                          if (/^\d*$/.test(value)) {
                            setTransactionForm({ ...transactionForm, amount: formatNumberWithSeparator(value) });
                          }
                        }}
                        placeholder="0"
                        className="w-full pl-10 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Income: Amount */}
              {transactionType === 'income' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Jumlah Uang Masuk *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">Rp</span>
                    <input
                      type="text"
                      value={transactionForm.amount}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\./g, '');
                        if (/^\d*$/.test(value)) {
                          setTransactionForm({ ...transactionForm, amount: formatNumberWithSeparator(value) });
                        }
                      }}
                      placeholder="0"
                      className="w-full pl-10 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              )}

              {/* Detailed Expense: Item List */}
              {transactionType === 'expense' && expenseType === 'detailed' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Detail Barang/Item
                  </label>
                  <div className="space-y-2">
                    {detailItems.map((item, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div className="col-span-2">
                            <input
                              type="text"
                              value={item.item_name}
                              onChange={(e) => handleDetailItemChange(index, 'item_name', e.target.value)}
                              placeholder="Nama Item"
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                            />
                          </div>
                          <div>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleDetailItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                              placeholder="Jumlah"
                              min="0.01"
                              step="any"
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                            />
                          </div>
                          <div>
                            <input
                              type="text"
                              value={item.unit}
                              onChange={(e) => handleDetailItemChange(index, 'unit', e.target.value)}
                              placeholder="Satuan"
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                            />
                          </div>
                          <div>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">Rp</span>
                              <input
                                type="text"
                                value={formatNumberWithSeparator(item.unit_price)}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\./g, '');
                                  if (/^\d*$/.test(value)) {
                                    handleDetailItemChange(index, 'unit_price', parseFloat(value) || 0);
                                  }
                                }}
                                placeholder="Harga Satuan"
                                className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                              />
                            </div>
                          </div>
                          <div>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">Rp</span>
                              <input
                                type="text"
                                value={formatNumberWithSeparator(item.subtotal || 0)}
                                readOnly
                                className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded-md bg-gray-100 text-gray-600"
                              />
                            </div>
                          </div>
                        </div>
                        {detailItems.length > 1 && (
                          <button
                            onClick={() => handleRemoveDetailItem(index)}
                            className="text-xs text-red-600 hover:text-red-700"
                          >
                            Hapus Item
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={handleAddDetailItem}
                      className="w-full py-2 text-xs text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50"
                    >
                      + Tambah Item
                    </button>
                  </div>

                  {/* Total Keseluruhan */}
                  <div className="mt-3 p-3 bg-gradient-to-r from-red-50 to-pink-50 rounded-lg border border-red-200">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-gray-800">Total Keseluruhan:</span>
                      <span className="text-base font-bold text-red-600">
                        Rp {parseFormattedNumber(transactionForm.amount).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Catatan (Opsional)
                </label>
                <input
                  type="text"
                  value={transactionForm.notes}
                  onChange={(e) => setTransactionForm({ ...transactionForm, notes: e.target.value })}
                  placeholder="Catatan tambahan"
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowTransactionModal(false);
                  resetTransactionForm();
                }}
                className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={saving}
              >
                Batal
              </button>
              <button
                onClick={handleSaveTransaction}
                disabled={saving}
                className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? 'Mengupdate...' : 'Update Transaksi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
