import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuthStore } from '../src/store/authStore';
import { toast } from 'react-hot-toast';
import { formatDateToJakarta } from '../src/utils/dateUtils';
import { formatNumberWithSeparator, parseFormattedNumber } from '../src/utils/numberFormat';

interface Project {
  id: number;
  name: string;
  description?: string;
  category_id?: number;
  category_name?: string;
  category_color?: string;
  budget: number;
  start_date?: string;
  end_date?: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  status: 'planning' | 'active' | 'completed' | 'on_hold' | 'cancelled';
  milestone_count?: number;
  completed_milestones?: number;
  total_income?: number;
  total_expense?: number;
  created_at: string;
}

interface ProjectCategory {
  id: number;
  name: string;
  color: string;
}

export default function Projects() {
  const router = useRouter();
  const { user, token, checkAuth } = useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter states
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProjects, setTotalProjects] = useState(0);

  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    budget: '',
    start_date: '',
    end_date: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    status: 'planning'
  });

  // Delete confirmation states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // Run an initial auth check and mark when done to avoid redirect race
    const init = async () => {
      await checkAuth();
      setAuthChecked(true);
    };
    init();
  }, [checkAuth]);

  useEffect(() => {
    // Only redirect to login after we've completed the initial auth check
    if (authChecked && !user) {
      router.push('/login');
      return;
    }
    
    console.log('User:', user, 'Token:', token ? 'exists' : 'missing');
    
    if (token) {
      fetchProjects();
      fetchCategories();
    }
    
    // Auto refresh setiap 30 detik
    const interval = setInterval(() => {
      if (token) {
        fetchProjects();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [user, token, currentPage, selectedStatus, selectedCategory]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Get token from localStorage if not in store
      let authToken = token;
      if (!authToken && typeof window !== 'undefined') {
        authToken = localStorage.getItem('token');
        console.log('Got token from localStorage:', authToken ? 'exists' : 'missing');
      }
      
      if (!authToken) {
        setError('Tidak ada token akses. Silakan login ulang.');
        router.push('/login');
        return;
      }
      
      console.log('Fetching projects with token:', authToken ? 'Token exists' : 'No token');
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10'
      });
      
      if (selectedStatus) params.append('status', selectedStatus);
      if (selectedCategory) params.append('category_id', selectedCategory);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects?${params}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Received data:', data);
        
        // Log budget values for debugging
        if (data.projects && data.projects.length > 0) {
          data.projects.forEach((p: Project) => {
            console.log(`Project: ${p.name}, Budget: ${p.budget}, Type: ${typeof p.budget}`);
          });
        }
        
        // Sort projects: active status first, then by created_at descending
        const sortedProjects = (data.projects || []).sort((a: Project, b: Project) => {
          // Priority 1: Active status comes first
          if (a.status === 'active' && b.status !== 'active') return -1;
          if (a.status !== 'active' && b.status === 'active') return 1;
          
          // Priority 2: Sort by created_at descending (newest first)
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA;
        });
        
        setProjects(sortedProjects);
        setTotalPages(data.pagination?.pages || 1);
        setTotalProjects(data.total || data.pagination?.total || 0);
      } else {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        
        if (response.status === 429) {
          setError('Terlalu banyak permintaan. Silakan coba lagi dalam beberapa saat.');
        } else if (response.status === 401) {
          setError('Sesi telah berakhir. Silakan login ulang.');
          router.push('/login');
        } else {
          setError(`Gagal memuat data: ${response.status} ${errorText}`);
        }
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      if (!error) {
        setError('Gagal memuat projects. Periksa koneksi internet Anda.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      // Get token from localStorage if not in store
      let authToken = token;
      if (!authToken && typeof window !== 'undefined') {
        authToken = localStorage.getItem('token');
      }
      
      if (!authToken) return;
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Extract project_categories from the response
        const projectCategories = data.project_categories || [];
        setCategories(projectCategories);
        console.log('Categories loaded:', projectCategories);
      } else {
        console.error('Failed to fetch categories:', response.status);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'on_hold': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'planning': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Aktif';
      case 'completed': return 'Selesai';
      case 'on_hold': return 'Ditunda';
      case 'cancelled': return 'Dibatalkan';
      case 'planning': return 'Perencanaan';
      default: return status;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Edit modal functions
  const handleEditProject = (project: Project) => {
    console.log('Editing project - Original budget:', project.budget);
    console.log('Budget type:', typeof project.budget);
    
    // Ensure budget is a clean number string without decimals
    const budgetValue = typeof project.budget === 'string' 
      ? parseFloat(project.budget).toString()
      : Math.floor(project.budget).toString();
    
    console.log('Budget value for form:', budgetValue);
    
    setEditingProject(project);
    setEditFormData({
      name: project.name,
      description: project.description || '',
      category_id: project.category_id?.toString() || '',
      budget: budgetValue,
      start_date: project.start_date ? formatDateToJakarta(project.start_date) : '',
      end_date: project.end_date ? formatDateToJakarta(project.end_date) : '',
      client_name: project.client_name || '',
      client_email: project.client_email || '',
      client_phone: project.client_phone || '',
      status: project.status
    });
    setShowEditModal(true);
  };

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingProject || !editFormData.name || !editFormData.budget) {
      toast.error('Nama project dan budget wajib diisi');
      return;
    }

    try {
      setSaving(true);
      
      const updateData = {
        ...editFormData,
        budget: parseFormattedNumber(editFormData.budget),
        category_id: editFormData.category_id ? parseInt(editFormData.category_id) : null
      };

      let authToken = token;
      if (!authToken && typeof window !== 'undefined') {
        authToken = localStorage.getItem('token');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        toast.success('Project berhasil diupdate!');
        setShowEditModal(false);
        setEditingProject(null);
        fetchProjects(); // Refresh the list
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update project');
      }
    } catch (err) {
      console.error('Error updating project:', err);
      toast.error('Gagal mengupdate project');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!editingProject) return;

    try {
      setDeleting(true);
      
      let authToken = token;
      if (!authToken && typeof window !== 'undefined') {
        authToken = localStorage.getItem('token');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${editingProject.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        }
      });

      if (response.ok) {
        toast.success('Project berhasil dihapus!');
        setShowDeleteConfirm(false);
        setShowEditModal(false);
        setEditingProject(null);
        fetchProjects(); // Refresh the list
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete project');
      }
    } catch (err) {
      console.error('Error deleting project:', err);
      toast.error('Gagal menghapus project');
    } finally {
      setDeleting(false);
    }
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingProject(null);
    setEditFormData({
      name: '',
      description: '',
      category_id: '',
      budget: '',
      start_date: '',
      end_date: '',
      client_name: '',
      client_email: '',
      client_phone: '',
      status: 'planning'
    });
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (project.client_name && project.client_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Head>
        <title>Daftar Project - AppsKing Finance</title>
        <meta name="description" content="Daftar semua project" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
            <div className="flex justify-between items-center py-3">
              <div className="flex items-center">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="mr-2 p-1 rounded-md text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-base font-bold text-gray-900">Daftar Project</h1>
                  <p className="text-xs text-gray-600">
                    Total: {projects.length} {projects.length === 1 ? 'project' : 'projects'}
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={fetchProjects}
                  className="bg-gray-100 text-gray-700 px-3 py-1.5 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={loading}
                >
                  <div className="flex items-center">
                    <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {loading ? 'Refreshing...' : 'Refresh'}
                  </div>
                </button>
                <button 
                  onClick={() => router.push('/projects/create')}
                  className="bg-primary-600 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <div className="flex items-center">
                    <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Tambah Project
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {/* Total Active Projects */}
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center">
                <div className="p-1.5 bg-primary-100 rounded-lg">
                  <svg className="h-4 w-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-2m-2 0H7m5 0v-9a2 2 0 00-2-2H8a2 2 0 00-2 2v9m8 0V9a2 2 0 012-2h2a2 2 0 012 2v12a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-2.5">
                  <p className="text-xs font-medium text-gray-600">Total Projects</p>
                  <p className="text-base font-bold text-gray-900">{projects.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Search */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Cari Project
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nama project atau klien..."
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Semua Status</option>
                  <option value="planning">Perencanaan</option>
                  <option value="active">Aktif</option>
                  <option value="completed">Selesai</option>
                  <option value="on_hold">Ditunda</option>
                  <option value="cancelled">Dibatalkan</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Kategori
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Semua Kategori</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reset Filter */}
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSelectedStatus('');
                    setSelectedCategory('');
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Reset Filter
                </button>
              </div>
            </div>
          </div>

          {/* Projects List */}
          {loading ? (
            <div className="text-center py-12">
              <div className="loading-spinner mx-auto mb-4"></div>
              <p className="text-gray-600">Memuat data project...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600">{error}</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-2m-2 0H7m5 0v-9a2 2 0 00-2-2H8a2 2 0 00-2 2v9m8 0V9a2 2 0 012-2h2a2 2 0 012 2v12a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Tidak ada project</h3>
              <p className="mt-1 text-sm text-gray-500">Mulai dengan membuat project baru.</p>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {filteredProjects.map((project) => (
                  <li key={project.id}>
                    <div 
                      className="px-3 py-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleEditProject(project)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            {project.category_color && (
                              <div
                                className="h-8 w-8 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: project.category_color + '20' }}
                              >
                                <div
                                  className="h-3 w-3 rounded"
                                  style={{ backgroundColor: project.category_color }}
                                ></div>
                              </div>
                            )}
                          </div>
                          <div className="ml-3">
                            <div className="flex items-center">
                              <p className="text-xs font-medium text-gray-900 truncate">
                                {project.name}
                              </p>
                              <span className={`ml-2 inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(project.status)}`}>
                                {getStatusText(project.status)}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500">
                              {project.client_name && `${project.client_name} • `}
                              {project.category_name}
                            </p>
                            {project.description && (
                              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-md">
                                {project.description}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-1.5">
                              Dibuat: {formatDate(project.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-medium text-gray-900">
                            Budget: {formatCurrency(project.budget)}
                          </p>
                          
                          {/* Financial Information */}
                          <div className="mt-1.5 space-y-0.5">
                            <div className="flex justify-end items-center text-xs">
                              <span className="text-gray-500 mr-1.5">Uang Masuk:</span>
                              <span className="font-semibold text-green-600">
                                {formatCurrency(project.total_income || 0)}
                              </span>
                            </div>
                            <div className="flex justify-end items-center text-xs">
                              <span className="text-gray-500 mr-1.5">Uang Keluar:</span>
                              <span className="font-semibold text-red-600">
                                {formatCurrency(project.total_expense || 0)}
                              </span>
                            </div>
                            <div className="flex justify-end items-center text-xs pt-0.5 border-t border-gray-200">
                              <span className="text-gray-500 mr-1.5">Sisa Tagihan:</span>
                              <span className={`font-bold ${
                                (project.budget - (project.total_income || 0)) >= 0 
                                  ? 'text-blue-600' 
                                  : 'text-purple-600'
                              }`}>
                                {formatCurrency(project.budget - (project.total_income || 0))}
                              </span>
                            </div>
                          </div>
                          
                          {project.milestone_count && (
                            <p className="text-xs text-gray-500 mt-1.5">
                              {project.completed_milestones || 0}/{project.milestone_count} milestone
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-3 py-2 flex items-center justify-between border-t border-gray-200 sm:px-4 mt-4 rounded-lg shadow">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className={`relative inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md ${
                    currentPage === 1
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-700 bg-white hover:bg-gray-50'
                  }`}
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className={`ml-2 relative inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md ${
                    currentPage === totalPages
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-700 bg-white hover:bg-gray-50'
                  }`}
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs text-gray-700">
                    Menampilkan halaman <span className="font-medium">{currentPage}</span> dari{' '}
                    <span className="font-medium">{totalPages}</span> total{' '}
                    <span className="font-medium">{totalProjects}</span> {totalProjects === 1 ? 'project' : 'projects'}
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className={`relative inline-flex items-center px-1.5 py-1.5 rounded-l-md border border-gray-300 text-xs font-medium ${
                        currentPage === 1
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-gray-500 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`relative inline-flex items-center px-3 py-1.5 border text-xs font-medium ${
                          page === currentPage
                            ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className={`relative inline-flex items-center px-1.5 py-1.5 rounded-r-md border border-gray-300 text-xs font-medium ${
                        currentPage === totalPages
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-gray-500 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
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

      {/* Edit Project Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-4 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-medium text-gray-900">
                  Edit Project: {editingProject?.name}
                </h3>
                <button
                  onClick={handleCloseEditModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleUpdateProject}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Project Name */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Nama Project *
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      value={editFormData.name}
                      onChange={handleEditFormChange}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  {/* Description */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Deskripsi
                    </label>
                    <textarea
                      name="description"
                      rows={2}
                      value={editFormData.description}
                      onChange={handleEditFormChange}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Kategori
                    </label>
                    <select
                      name="category_id"
                      value={editFormData.category_id}
                      onChange={handleEditFormChange}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Pilih Kategori</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Budget */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Budget *
                    </label>
                    <input
                      type="text"
                      name="budget"
                      required
                      value={formatNumberWithSeparator(editFormData.budget)}
                      onChange={(e) => {
                        // Remove all separators to get clean number
                        const cleanNumber = e.target.value.replace(/\D/g, '');
                        setEditFormData({ ...editFormData, budget: cleanNumber });
                      }}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  {/* Start Date */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Tanggal Mulai
                    </label>
                    <input
                      type="date"
                      name="start_date"
                      value={editFormData.start_date}
                      onChange={handleEditFormChange}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  {/* End Date */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Tanggal Selesai
                    </label>
                    <input
                      type="date"
                      name="end_date"
                      value={editFormData.end_date}
                      onChange={handleEditFormChange}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  {/* Client Name */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Nama Klien
                    </label>
                    <input
                      type="text"
                      name="client_name"
                      value={editFormData.client_name}
                      onChange={handleEditFormChange}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  {/* Client Email */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Email Klien
                    </label>
                    <input
                      type="email"
                      name="client_email"
                      value={editFormData.client_email}
                      onChange={handleEditFormChange}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  {/* Client Phone */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Telepon Klien
                    </label>
                    <input
                      type="tel"
                      name="client_phone"
                      value={editFormData.client_phone}
                      onChange={handleEditFormChange}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Status
                    </label>
                    <select
                      name="status"
                      value={editFormData.status}
                      onChange={handleEditFormChange}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="planning">Perencanaan</option>
                      <option value="active">Aktif</option>
                      <option value="completed">Selesai</option>
                      <option value="on_hold">Ditunda</option>
                      <option value="cancelled">Dibatalkan</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-4">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Hapus
                  </button>
                  
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={handleCloseEditModal}
                      className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                    >
                      {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && editingProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4">
              <div className="flex items-center mb-3">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="ml-2.5">
                  <h3 className="text-base font-medium text-gray-900">
                    Konfirmasi Hapus Project
                  </h3>
                </div>
              </div>
              
              <p className="text-xs text-gray-500 mb-4">
                Apakah Anda yakin ingin menghapus project <strong>"{editingProject.name}"</strong>? 
                Tindakan ini tidak dapat dibatalkan.
              </p>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={deleting}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDeleteProject}
                  disabled={deleting}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? 'Menghapus...' : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
