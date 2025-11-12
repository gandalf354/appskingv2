import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuthStore } from '../../src/store/authStore';
import { toast } from 'react-hot-toast';
import { getJakartaDate } from '../../src/utils/dateUtils';
import { formatNumberWithSeparator, parseFormattedNumber } from '../../src/utils/numberFormat';

interface ProjectCategory {
  id: number;
  name: string;
  color: string;
}

export default function CreateProject() {
  const router = useRouter();
  const { user, token, checkAuth } = useAuthStore();
  
  const [authChecked, setAuthChecked] = useState(false);
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [formData, setFormData] = useState({
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

  useEffect(() => {
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
    
    if (user && token) {
      fetchCategories();
    }
  }, [authChecked, user, token, router]);

  const fetchCategories = async () => {
    try {
      let authToken = token;
      if (!authToken && typeof window !== 'undefined') {
        authToken = localStorage.getItem('token');
      }
      
      if (!authToken) return;
      
      const response = await fetch('http://localhost:5001/api/categories', {
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
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.budget) {
      toast.error('Nama project dan budget wajib diisi');
      return;
    }

    try {
      setLoading(true);
      
      const createData = {
        ...formData,
        budget: parseFormattedNumber(formData.budget),
        category_id: formData.category_id ? parseInt(formData.category_id) : null
      };

      let authToken = token;
      if (!authToken && typeof window !== 'undefined') {
        authToken = localStorage.getItem('token');
      }

      const response = await fetch('http://localhost:5001/api/projects', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createData)
      });

      if (response.ok) {
        toast.success('Project berhasil dibuat!');
        router.push('/projects');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create project');
      }
    } catch (err) {
      console.error('Error creating project:', err);
      toast.error('Gagal membuat project');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Show loading while checking authentication
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
          <p className="mt-4 text-gray-600">Memeriksa otentikasi...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Mengarahkan ke halaman login...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Tambah Project Baru - AppsKing Finance</title>
        <meta name="description" content="Tambah project baru" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
            <div className="flex justify-between items-center py-3">
              <div className="flex items-center">
                <button
                  onClick={() => router.push('/projects')}
                  className="mr-2 p-1 rounded-md text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-base font-bold text-gray-900">Tambah Project Baru</h1>
                  <p className="text-xs text-gray-500">Buat project baru untuk klien</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Basic Information */}
            <div className="bg-white shadow rounded-lg p-4">
              <h3 className="text-base font-medium text-gray-900 mb-3">Informasi Dasar</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Nama Project *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Kategori
                  </label>
                  <select
                    name="category_id"
                    value={formData.category_id}
                    onChange={handleInputChange}
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

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Deskripsi
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={2}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            {/* Budget & Timeline */}
            <div className="bg-white shadow rounded-lg p-4">
              <h3 className="text-base font-medium text-gray-900 mb-3">Budget & Timeline</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Budget *
                  </label>
                  <input
                    type="text"
                    name="budget"
                    value={formatNumberWithSeparator(formData.budget)}
                    onChange={(e) => {
                      const formatted = formatNumberWithSeparator(e.target.value);
                      setFormData({ ...formData, budget: formatted });
                    }}
                    required
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleInputChange}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Tanggal Selesai
                  </label>
                  <input
                    type="date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleInputChange}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            {/* Client Information */}
            <div className="bg-white shadow rounded-lg p-4">
              <h3 className="text-base font-medium text-gray-900 mb-3">Informasi Klien & Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Nama Klien
                  </label>
                  <input
                    type="text"
                    name="client_name"
                    value={formData.client_name}
                    onChange={handleInputChange}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Telepon Klien
                  </label>
                  <input
                    type="tel"
                    name="client_phone"
                    value={formData.client_phone}
                    onChange={handleInputChange}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Status Project
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="planning">Perencanaan</option>
                    <option value="active">Aktif</option>
                    <option value="on_hold">Ditunda</option>
                    <option value="completed">Selesai</option>
                    <option value="cancelled">Dibatalkan</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => router.push('/projects')}
                  className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white px-3 py-1.5 text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Menyimpan...' : 'Simpan Project'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}