import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuthStore } from '../../src/store/authStore';
import { toast } from 'react-hot-toast';
import { formatNumberWithSeparator, parseFormattedNumber } from '../../src/utils/numberFormat';

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
  created_at: string;
  updated_at: string;
}

interface ProjectCategory {
  id: number;
  name: string;
  color: string;
}

export default function EditProject() {
  const router = useRouter();
  const { id } = router.query;
  const { user, token, checkAuth } = useAuthStore();
  
  const [project, setProject] = useState<Project | null>(null);
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
    status: 'active' as const
  });

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (id) {
      fetchProject();
      fetchCategories();
    }
  }, [user, id]);

  const fetchProject = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProject(data);
        
        // Populate form
        setFormData({
          name: data.name || '',
          description: data.description || '',
          category_id: data.category_id?.toString() || '',
          budget: data.budget?.toString() || '',
          start_date: data.start_date ? data.start_date.split('T')[0] : '',
          end_date: data.end_date ? data.end_date.split('T')[0] : '',
          client_name: data.client_name || '',
          client_email: data.client_email || '',
          client_phone: data.client_phone || '',
          status: data.status || 'active'
        });
      } else {
        throw new Error('Failed to fetch project');
      }
    } catch (err) {
      setError('Failed to load project');
      console.error('Error fetching project:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories/projects`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data || []);
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
      setSaving(true);
      
      const updateData = {
        ...formData,
        budget: parseFormattedNumber(formData.budget),
        category_id: formData.category_id ? parseInt(formData.category_id) : null
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        toast.success('Project berhasil diupdate!');
        router.push('/projects');
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

  const handleDelete = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus project ini? Tindakan ini tidak dapat dibatalkan.')) {
      return;
    }

    try {
      setDeleting(true);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast.success('Project berhasil dihapus!');
        router.push('/projects');
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat data project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Project tidak ditemukan'}</p>
          <button
            onClick={() => router.push('/projects')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Kembali ke Daftar Project
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Edit Project - {project.name}</title>
        <meta name="description" content="Edit project details" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center">
                <button
                  onClick={() => router.push('/projects')}
                  className="mr-4 p-2 rounded-md text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Edit Project</h1>
                  <p className="text-sm text-gray-600">{project.name}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(project.status)}`}>
                  {project.status === 'active' ? 'Aktif' : 
                   project.status === 'completed' ? 'Selesai' :
                   project.status === 'planning' ? 'Perencanaan' :
                   project.status === 'on_hold' ? 'Ditunda' : 'Dibatalkan'}
                </span>
                <span className="text-lg font-bold text-gray-900">
                  {formatCurrency(project.budget)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-6">Informasi Dasar</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kategori
                  </label>
                  <select
                    name="category_id"
                    value={formData.category_id}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Pilih Kategori</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="planning">Perencanaan</option>
                    <option value="active">Aktif</option>
                    <option value="on_hold">Ditunda</option>
                    <option value="completed">Selesai</option>
                    <option value="cancelled">Dibatalkan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tanggal Selesai
                  </label>
                  <input
                    type="date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deskripsi
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Deskripsi project..."
                />
              </div>
            </div>

            {/* Client Information */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-6">Informasi Klien</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nama Klien
                  </label>
                  <input
                    type="text"
                    name="client_name"
                    value={formData.client_name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Klien
                  </label>
                  <input
                    type="email"
                    name="client_email"
                    value={formData.client_email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telepon Klien
                  </label>
                  <input
                    type="tel"
                    name="client_phone"
                    value={formData.client_phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? 'Menghapus...' : 'Hapus'}
                </button>
                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() => router.push('/projects')}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving || deleting}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
