import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuthStore } from '../src/store/authStore';
import { toast } from 'react-hot-toast';

interface Category {
  id: number;
  name: string;
  description: string;
  color: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  type?: 'transaction' | 'project'; // Added to distinguish category types
}

export default function Categories() {
  const router = useRouter();
  const { user, token, checkAuth } = useAuthStore();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6'
  });

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchCategories();
  }, [user]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      
      let authToken = token;
      if (!authToken && typeof window !== 'undefined') {
        authToken = localStorage.getItem('token');
      }
      
      if (!authToken) {
        router.push('/login');
        return;
      }

      const response = await fetch('http://localhost:5001/api/categories', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Combine transaction and project categories into a single array
        const transactionCats = (data.transaction_categories || []).map((cat: any) => ({
          ...cat,
          type: 'transaction' as const
        }));
        const projectCats = (data.project_categories || []).map((cat: any) => ({
          ...cat,
          type: 'project' as const
        }));
        const allCategories = [...transactionCats, ...projectCats];
        setCategories(allCategories);
      } else {
        throw new Error('Failed to fetch categories');
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
      toast.error('Gagal memuat kategori');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Nama kategori wajib diisi');
      return;
    }

    try {
      setSaving(true);
      
      let authToken = token;
      if (!authToken && typeof window !== 'undefined') {
        authToken = localStorage.getItem('token');
      }

      const isEdit = editingCategory !== null;
      
      // Determine the correct endpoint based on category type
      let url: string;
      if (isEdit) {
        const categoryType = editingCategory.type === 'project' ? 'projects' : 'transactions';
        url = `http://localhost:5001/api/categories/${categoryType}/${editingCategory.id}`;
      } else {
        // For new categories, default to transactions (you may want to add a type selector)
        url = 'http://localhost:5001/api/categories/transactions';
      }
      
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success(isEdit ? 'Kategori berhasil diupdate!' : 'Kategori berhasil ditambahkan!');
        setFormData({ name: '', description: '', color: '#3B82F6' });
        setShowAddForm(false);
        setEditingCategory(null);
        fetchCategories();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save category');
      }
    } catch (err) {
      console.error('Error saving category:', err);
      toast.error('Gagal menyimpan kategori');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (category: Category) => {
    setFormData({
      name: category.name,
      description: category.description,
      color: category.color
    });
    setEditingCategory(category);
    setShowAddForm(true);
  };

  const handleDelete = async (category: Category) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus kategori "${category.name}"?`)) {
      return;
    }

    try {
      let authToken = token;
      if (!authToken && typeof window !== 'undefined') {
        authToken = localStorage.getItem('token');
      }

      // Determine the correct endpoint based on category type
      const categoryType = category.type === 'project' ? 'projects' : 'transactions';
      const url = `http://localhost:5001/api/categories/${categoryType}/${category.id}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast.success('Kategori berhasil dihapus!');
        fetchCategories();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete category');
      }
    } catch (err: any) {
      console.error('Error deleting category:', err);
      toast.error(err.message || 'Gagal menghapus kategori');
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', description: '', color: '#3B82F6' });
    setShowAddForm(false);
    setEditingCategory(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Head>
        <title>Kelola Kategori Project - AppsKing</title>
        <meta name="description" content="Kelola kategori project" />
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
                  <h1 className="text-base font-bold text-gray-900">Kelola Kategori</h1>
                  <p className="text-xs text-gray-600">Total: {categories.length} kategori</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={fetchCategories}
                  disabled={loading}
                  className="bg-gray-100 text-gray-700 px-3 py-1.5 text-sm rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center">
                    <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {loading ? 'Refreshing...' : 'Refresh'}
                  </div>
                </button>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-blue-600 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <div className="flex items-center">
                    <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Tambah Kategori
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
          
          {/* Add/Edit Form */}
          {showAddForm && (
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <h3 className="text-base font-medium text-gray-900 mb-3">
                {editingCategory ? 'Edit Kategori' : 'Tambah Kategori Baru'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Nama Kategori *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Masukkan nama kategori"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Warna
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        name="color"
                        value={formData.color}
                        onChange={handleInputChange}
                        className="h-8 w-12 border border-gray-300 rounded-md cursor-pointer"
                      />
                      <input
                        type="text"
                        name="color"
                        value={formData.color}
                        onChange={handleInputChange}
                        className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="#3B82F6"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Deskripsi
                    </label>
                    <input
                      type="text"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Deskripsi kategori"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-blue-600 text-white px-3 py-1.5 text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Menyimpan...' : (editingCategory ? 'Update' : 'Simpan')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Categories List */}
          {loading ? (
            <div className="text-center py-12">
              <div className="loading-spinner mx-auto mb-4"></div>
              <p className="text-gray-600">Memuat kategori...</p>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-3 py-4 sm:p-4">
                <div className="grid grid-cols-1 gap-3">
                  {categories.map((category) => (
                    <div key={category.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div
                            className="h-6 w-6 rounded-lg flex items-center justify-center mr-3"
                            style={{ backgroundColor: category.color + '20' }}
                          >
                            <div
                              className="h-3 w-3 rounded"
                              style={{ backgroundColor: category.color }}
                            ></div>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">{category.name}</h3>
                            <p className="text-xs text-gray-500">{category.description}</p>
                            <p className="text-xs text-gray-400">
                              Dibuat: {formatDate(category.created_at)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-1.5">
                          <span
                            className="px-1.5 py-0.5 text-xs font-medium rounded-full"
                            style={{ 
                              backgroundColor: category.color + '20',
                              color: category.color
                            }}
                          >
                            {category.color}
                          </span>
                          
                          <button
                            onClick={() => handleEdit(category)}
                            className="text-blue-600 hover:text-blue-800 p-1.5 rounded"
                            title="Edit kategori"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          
                          <button
                            onClick={() => handleDelete(category)}
                            className="text-red-600 hover:text-red-800 p-1.5 rounded"
                            title="Hapus kategori"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {categories.length === 0 && (
                  <div className="text-center py-12">
                    <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <h3 className="mt-2 text-xs font-medium text-gray-900">Tidak ada kategori</h3>
                    <p className="mt-1 text-xs text-gray-500">Mulai dengan menambahkan kategori pertama.</p>
                    <div className="mt-4">
                      <button
                        onClick={() => setShowAddForm(true)}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      >
                        <svg className="-ml-1 mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Tambah Kategori
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}