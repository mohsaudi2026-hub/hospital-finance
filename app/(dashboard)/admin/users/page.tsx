'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserRole } from '@/lib/hooks/useUserRole'
import { ROLE_LABELS, SUPPORT_PHONE, type RoleName } from '@/lib/constants'
import { UserAvatar } from '@/components/ui/UserAvatar'
import * as XLSX from 'xlsx'

export function getDefaultPassword(roleName: string | null, email: string | null): string {
  if (email === 'super@admin.com') return 'Admin@123456'
  if (email === 'viewer@health.gov.eg') return 'Viewer@123456'
  if (roleName === 'hospital_admin') return 'Hospital@123456'
  if (roleName === 'hospital_data_entry') return 'Entry@123456'
  if (roleName === 'hospital_viewer') return 'Viewer@123456'
  return 'Hospital@123456'
}

interface UserItem {
  id: string
  email: string | null
  full_name: string | null
  national_id: string | null
  phone: string | null
  is_active: boolean
  must_change_password: boolean
  role_name: RoleName | null
  role_id: string | null
  facility_name: string | null
  facility_id: string | null
  facility_code: string | null
  created_at: string
}

interface Facility {
  id: string
  name: string
  code: string
  institutional_code?: string | null
}

interface Role {
  id: string
  name: RoleName
  description: string
}

export default function UsersManagementPage() {
  const supabase = createClient()
  const { isSuperAdmin, isHospitalAdmin, facilityId, facilityName, loading: roleLoading } = useUserRole()

  const [users, setUsers] = useState<UserItem[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState('all')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 12

  // Hover Popover State
  const [hoveredUser, setHoveredUser] = useState<UserItem | null>(null)
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  // Edit User Modal
  const [editModalUser, setEditModalUser] = useState<UserItem | null>(null)
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    nationalId: '',
    phone: '',
    roleId: '',
    facilityId: '',
    newPassword: '',
    isActive: true,
  })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editMsg, setEditMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Delete User State
  const [deleteModalUser, setDeleteModalUser] = useState<UserItem | null>(null)
  const [deletingUser, setDeletingUser] = useState(false)

  // Credential Delivery Card Modal State
  const [credentialModalUser, setCredentialModalUser] = useState<UserItem | null>(null)
  const [copiedDeliveryText, setCopiedDeliveryText] = useState(false)

  // Ministry Support Modal State (for Hospital Admins requesting user modifications)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [supportUserTarget, setSupportUserTarget] = useState<UserItem | null>(null)

  // Export Credentials to Excel Handler (شامل كلمات المرور الافتراضية والتعليمات)
  function handleExportCredentials() {
    if (filteredUsers.length === 0) return

    const rows = filteredUsers.map((u, idx) => {
      const defaultPwd = getDefaultPassword(u.role_name, u.email)
      return {
        'م': idx + 1,
        'اسم المنشأة الطبية': u.facility_name || 'ديوان عام الوزارة',
        'كود المنشأة': u.facility_code || '—',
        'اسم الموظف المسجل': u.full_name || '—',
        'الدور الوظيفي والصلاحية': u.role_name ? (ROLE_LABELS[u.role_name] || u.role_name) : 'بدون دور',
        'البريد الإلكتروني (اسم المستخدم)': u.email || '—',
        'كلمة المرور الافتراضية للتسليم': defaultPwd,
        'الرقم القومي (14 رقم)': u.national_id || '—',
        'رقم الهاتف المحمول': u.phone || '—',
        'حالة الحساب': u.is_active ? 'نشط ومفعل' : 'معطل',
        'تغيير كلمة المرور عند أول دخول': u.must_change_password ? 'إلزامي (نعم)' : 'تم التغيير',
        'رابط الدخول المباشر للمنظومة': 'https://hospital-finance.vercel.app/login',
      }
    })

    const wsUsers = XLSX.utils.json_to_sheet(rows)
    wsUsers['!cols'] = [
      { wch: 6 },
      { wch: 34 },
      { wch: 14 },
      { wch: 30 },
      { wch: 24 },
      { wch: 34 },
      { wch: 28 },
      { wch: 20 },
      { wch: 18 },
      { wch: 14 },
      { wch: 24 },
      { wch: 38 },
    ]

    // Sheet 2: دليل كلمات المرور الافتراضية والقواعد الأمنية
    const guideRows = [
      {
        'الدور الوظيفي': 'مدير المستشفى (Hospital Admin)',
        'كلمة المرور الافتراضية': 'Hospital@123456',
        'الصلاحيات': 'إدارة مستخدمي المستشفى، مراجعة التقارير، والاعتماد المالي',
      },
      {
        'الدور الوظيفي': 'مسؤول الإدخال المالي (Data Entry)',
        'كلمة المرور الافتراضية': 'Entry@123456',
        'الصلاحيات': 'تسجيل الإيرادات الـ 8، التجنيب، الشراء الموحد، وسداد العقود',
      },
      {
        'الدور الوظيفي': 'مراجع الحسابات (Hospital Viewer)',
        'كلمة المرور الافتراضية': 'Viewer@123456',
        'الصلاحيات': 'استعراض وطباعة كافة التقارير والسجلات المالية الخاصة بالمنشأة',
      },
      {
        'الدور الوظيفي': 'المكتب الفني للوزير (Ministry Viewer)',
        'كلمة المرور الافتراضية': 'Viewer@123456',
        'الصلاحيات': 'رؤية بانورامية ورقابة شاملة لكافة محافظات ومستشفيات الجمهورية',
      },
      {
        'الدور الوظيفي': 'مدير المنظومة (Super Admin)',
        'كلمة المرور الافتراضية': 'Admin@123456',
        'الصلاحيات': 'إدارة كافة المنشآت والمستخدمين واللوائح وفتح الإقفالات الاستثنائية',
      },
    ]
    const wsGuide = XLSX.utils.json_to_sheet(guideRows)
    wsGuide['!cols'] = [{ wch: 32 }, { wch: 26 }, { wch: 60 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsUsers, 'كشف حسابات وكلمات المرور')
    XLSX.utils.book_append_sheet(wb, wsGuide, 'دليل كلمات المرور الرسمية')

    const dateStr = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `كشف_حسابات_المستخدمين_وكلمات_المرور_وزارة_الصحة_${dateStr}.xlsx`)
  }

  // Add User Modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [newUserData, setNewUserData] = useState({
    fullName: '',
    nationalId: '',
    email: '',
    password: '',
    phone: '',
    roleId: '',
    facilityId: '',
    mustChangePassword: true,
  })
  const [creatingUser, setCreatingUser] = useState(false)
  const [addModalMsg, setAddModalMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function loadData() {
    setLoading(true)
    try {
      // 1. Roles & Facilities
      const { data: rolesData } = await supabase.from('roles').select('*')
      if (rolesData) {
        if (isSuperAdmin) {
          setRoles(rolesData as any)
        } else {
          // Hospital admins only assign hospital-level roles
          setRoles(
            rolesData.filter(
              (r: any) => r.name !== 'super_admin' && r.name !== 'ministry_viewer'
            ) as any
          )
        }
      }

      let facsQuery = supabase.from('facilities').select('id, name, code, institutional_code').order('name')
      if (!isSuperAdmin && facilityId) {
        facsQuery = facsQuery.eq('id', facilityId)
      }
      const { data: facsData } = await facsQuery
      if (facsData) setFacilities(facsData)

      // 2. Fetch users from Admin API with facility filter
      const url = (!isSuperAdmin && facilityId)
        ? `/api/admin/list-users?facilityId=${facilityId}`
        : '/api/admin/list-users'

      const res = await fetch(url)
      const data = await res.json()
      if (data.success && data.users) {
        setUsers(data.users)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!roleLoading) {
      loadData()
    }
  }, [roleLoading, isSuperAdmin, facilityId])

  // Add User Handler
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setCreatingUser(true)
    setAddModalMsg(null)

    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserData),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل إنشاء المستخدم')

      setAddModalMsg({ type: 'success', text: 'تم إنشاء المستخدم وربطه بالمنشأة بنجاح!' })
      setTimeout(() => {
        setShowAddModal(false)
        setNewUserData({
          fullName: '',
          nationalId: '',
          email: '',
          password: '',
          phone: '',
          roleId: '',
          facilityId: '',
          mustChangePassword: true,
        })
        setAddModalMsg(null)
        loadData()
      }, 1200)
    } catch (err: any) {
      setAddModalMsg({ type: 'error', text: err.message })
    } finally {
      setCreatingUser(false)
    }
  }

  // Open Edit Modal
  function openEditModal(user: UserItem) {
    setEditModalUser(user)
    setEditFormData({
      fullName: user.full_name || '',
      nationalId: user.national_id || '',
      phone: user.phone || '',
      roleId: user.role_id || '',
      facilityId: user.facility_id || '',
      newPassword: '',
      isActive: user.is_active,
    })
    setEditMsg(null)
  }

  // Save Edit Handler
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editModalUser) return
    setSavingEdit(true)
    setEditMsg(null)

    try {
      const res = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editModalUser.id,
          fullName: editFormData.fullName,
          nationalId: editFormData.nationalId || null,
          phone: editFormData.phone || null,
          roleId: editFormData.roleId || null,
          facilityId: editFormData.facilityId || null,
          newPassword: editFormData.newPassword || undefined,
          isActive: editFormData.isActive,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل تحديث المستخدم')

      setEditMsg({ type: 'success', text: 'تم حفظ كافة التعديلات بنجاح!' })
      loadData()
      setTimeout(() => setEditModalUser(null), 1200)
    } catch (err: any) {
      setEditMsg({ type: 'error', text: err.message })
    } finally {
      setSavingEdit(false)
    }
  }

  // Delete User Handler
  async function handleDeleteUser() {
    if (!deleteModalUser) return
    setDeletingUser(true)

    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: deleteModalUser.id }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل حذف المستخدم')

      setDeleteModalUser(null)
      loadData()
    } catch (err: any) {
      alert('خطأ في الحذف: ' + err.message)
    } finally {
      setDeletingUser(false)
    }
  }

  const filteredUsers = users.filter((u) => {
    // If not super admin, strictly filter to the hospital's own users
    if (!isSuperAdmin && facilityId && u.facility_id !== facilityId) {
      return false
    }

    const q = searchQuery.toLowerCase()
    const matchQuery =
      q === '' ||
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.facility_name && u.facility_name.toLowerCase().includes(q)) ||
      (u.national_id && u.national_id.includes(q))
    const matchRole = filterRole === 'all' || u.role_name === filterRole
    return matchQuery && matchRole
  })

  // Pagination calculation
  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text)]">
            {isSuperAdmin
              ? '👥 إدارة كافة المستخدمين وصلاحيات المنشآت (الديوان العام)'
              : `👥 إدارة مستخدمي ${facilityName || 'المنشأة'}`}
          </h2>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            {isSuperAdmin
              ? 'إضافة وتسكين وتعديل وحذف مستخدمي المستشفيات والتحقق من الامتثال الأمني والرقم القومي'
              : `إدارة وتعديل حسابات العاملين ومدخلي البيانات التابعين لـ ${facilityName || 'المنشأة'}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportCredentials}
            disabled={filteredUsers.length === 0}
            className="btn btn-outline text-xs flex items-center gap-2 bg-white hover:bg-emerald-50 hover:border-emerald-600 hover:text-emerald-800 shadow-xs transition-all font-bold border-emerald-500 text-emerald-900"
            title="تصدير كشف حسابات المستخدمين وكلمات المرور الافتراضية للتسليم"
          >
            <span>📥</span>
            <span>{isSuperAdmin ? 'استخراج كشف المستخدمين وكلمات المرور (Excel)' : 'تصدير بيانات الدخول (Excel)'}</span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
              {filteredUsers.length}
            </span>
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary text-xs flex items-center gap-2 shadow-sm font-bold"
            >
              <span>➕</span>
              <span>إضافة مستخدم جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card !p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="w-full sm:w-96">
          <input
            type="text"
            placeholder={
              isSuperAdmin
                ? 'بحث بالاسم، البريد، الرقم القومي، أو المستشفى...'
                : 'بحث بالاسم، البريد، أو الرقم القومي...'
            }
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setCurrentPage(1)
            }}
            className="form-input text-xs"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <span className="text-xs text-[var(--color-muted)] shrink-0">تصفية بالدور:</span>
          <select
            value={filterRole}
            onChange={(e) => {
              setFilterRole(e.target.value)
              setCurrentPage(1)
            }}
            className="form-input text-xs !py-1.5"
          >
            <option value="all">جميع الأدوار ({filteredUsers.length})</option>
            {roles.map((r) => (
              <option key={r.name} value={r.name}>
                {ROLE_LABELS[r.name] || r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden !p-0 shadow-sm border border-gray-200">
        <div className="table-wrapper">
          <table className="table w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs">
                <th className="py-3 px-4 text-right font-bold text-gray-700 w-[28%]">
                  الموظف والبريد الإلكتروني
                </th>
                <th className="py-3 px-4 text-right font-bold text-gray-700 w-[26%]">
                  المستشفى / المنشأة التابع لها
                </th>
                <th className="py-3 px-3 text-center font-bold text-gray-700 w-[14%]">
                  الدور والصلاحية
                </th>
                <th className="py-3 px-3 text-center font-bold text-gray-700 w-[14%]">
                  الرقم القومي
                </th>
                <th className="py-3 px-2 text-center font-bold text-gray-700 w-[6%]">
                  الحالة
                </th>
                {(isSuperAdmin || isHospitalAdmin) && (
                  <th className="py-3 px-4 text-center font-bold text-gray-700 w-[12%]">
                    إجراءات التحكم
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-[var(--color-muted)]">
                    <span className="spinner" /> جاري تحميل المستخدمين...
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-[var(--color-muted)]">
                    لا يوجد مستخدمون مطابقون للبحث.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-blue-50/50 transition-colors"
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setPopoverPos({ x: rect.right - 270, y: rect.bottom + window.scrollY + 6 })
                      setHoveredUser(u)
                    }}
                    onMouseLeave={() => setHoveredUser(null)}
                  >
                    {/* اسم الموظف والبريد */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          name={u.full_name}
                          role={u.role_name}
                          size="md"
                          isOnline={u.is_active}
                        />
                        <div className="overflow-hidden">
                          <p className="font-bold text-xs text-gray-900 truncate">
                            {u.full_name || 'بدون اسم'}
                          </p>
                          {u.email && (
                            <p className="text-[11px] text-[var(--color-primary)] font-mono truncate" dir="ltr" style={{ textAlign: 'right' }}>
                              {u.email}
                            </p>
                          )}
                          {u.phone && (
                            <p className="text-[10px] text-gray-500 font-mono">{u.phone}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* المستشفى والمنشأة */}
                    <td className="py-3 px-4">
                      {u.facility_name ? (
                        <div className="flex items-center gap-1.5 font-bold text-blue-950">
                          <span className="text-sm">🏥</span>
                          <span className="truncate">{u.facility_name}</span>
                          {u.facility_code && (
                            <span className="text-[10px] text-gray-500 font-mono shrink-0">
                              ({u.facility_code})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500 font-medium">
                          {u.role_name === 'super_admin' || u.role_name === 'ministry_viewer'
                            ? '🏛️ نطاق الوزارة بالكامل'
                            : '— غير محدد —'}
                        </span>
                      )}
                    </td>

                    {/* الدور والصلاحية */}
                    <td className="py-3 px-3 text-center">
                      {u.role_name ? (
                        <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          {ROLE_LABELS[u.role_name] || u.role_name}
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] text-gray-400 bg-gray-100">
                          بدون دور
                        </span>
                      )}
                    </td>

                    {/* الرقم القومي */}
                    <td className="py-3 px-3 text-center">
                      {u.national_id ? (
                        <span className="font-mono text-xs text-gray-800 font-semibold bg-gray-100 px-2 py-1 rounded border border-gray-200">
                          {u.national_id}
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                          ⚠️ لم يُسجل بعد
                        </span>
                      )}
                    </td>

                    {/* الحالة */}
                    <td className="py-3 px-2 text-center">
                      {u.is_active ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 border border-green-200">
                          نشط
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                          معطل
                        </span>
                      )}
                    </td>

                    {/* إجراءات التحكم */}
                    {(isSuperAdmin || isHospitalAdmin) && (
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setCredentialModalUser(u)
                              setCopiedDeliveryText(false)
                            }}
                            className="px-2 py-1 rounded-lg text-xs font-bold bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 transition-colors"
                            title="عرض ونسخ بطاقة بيانات الدخول لتسليمها للموظف"
                          >
                            🔑 بطاقة التسليم
                          </button>
                          <button
                            onClick={() => {
                              if (isSuperAdmin) {
                                openEditModal(u)
                              } else {
                                setSupportUserTarget(u)
                                setShowSupportModal(true)
                              }
                            }}
                            className="px-2 py-1 rounded-lg text-xs font-bold border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors"
                            title={isSuperAdmin ? 'تعديل البيانات والصلاحية' : 'طلب تعديل من الدعم الفني بالوزارة'}
                          >
                            {isSuperAdmin ? '✏️ تعديل' : '✏️ طلب تعديل'}
                          </button>
                          {isSuperAdmin && (
                            <button
                              onClick={() => setDeleteModalUser(u)}
                              className="px-2 py-1 rounded-lg text-xs font-bold border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                              title="حذف المستخدم"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
          <div>
            عرض <b>{Math.min((currentPage - 1) * pageSize + 1, filteredUsers.length)}</b> إلى{' '}
            <b>{Math.min(currentPage * pageSize, filteredUsers.length)}</b> من أصل{' '}
            <b>{filteredUsers.length}</b> مستخدم
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="btn btn-outline !min-h-[30px] !py-1 text-xs disabled:opacity-40"
            >
              السابق
            </button>
            <span className="font-bold text-gray-800 px-2">
              صفحة {currentPage} من {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className="btn btn-outline !min-h-[30px] !py-1 text-xs disabled:opacity-40"
            >
              التالي
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            Hover Popover Card (معلومات المستخدم عند توجيه الماوس)
        ══════════════════════════════════════════════════ */}
        {hoveredUser && (
          <div
            className="fixed z-50 pointer-events-none p-4 rounded-2xl bg-white shadow-2xl border border-blue-200 w-80 text-xs animate-in fade-in zoom-in-95 duration-150"
            style={{
              top: `${popoverPos.y}px`,
              right: `${popoverPos.x}px`,
            }}
          >
            <div className="flex items-center gap-2.5 pb-2.5 border-b border-gray-100">
              <UserAvatar
                name={hoveredUser.full_name}
                role={hoveredUser.role_name}
                size="md"
                isOnline={hoveredUser.is_active}
              />
              <div className="overflow-hidden">
                <p className="font-extrabold text-sm text-[var(--color-text)] truncate">
                  {hoveredUser.full_name || 'مستخدم بدون اسم'}
                </p>
                <p className="text-[11px] text-[var(--color-primary)] font-semibold">
                  {hoveredUser.role_name ? ROLE_LABELS[hoveredUser.role_name] : 'بدون صلاحية'}
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-semibold">البريد الإلكتروني:</span>
                <span className="font-mono text-gray-800 text-[10px]" dir="ltr">
                  {hoveredUser.email || 'غير متوفر'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-semibold">الرقم القومي:</span>
                <span className="font-mono font-bold text-gray-800">
                  {hoveredUser.national_id || 'لم يُسجل بعد'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-semibold">رقم الهاتف:</span>
                <span className="font-mono text-gray-800">
                  {hoveredUser.phone || 'غير مسجل'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-semibold">المنشأة:</span>
                <span className="font-bold text-blue-900 truncate max-w-[170px]">
                  {hoveredUser.facility_name || 'نطاق الوزارة'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-semibold">حالة الحساب:</span>
                <span className={hoveredUser.is_active ? 'text-green-700 font-bold' : 'text-red-600 font-bold'}>
                  {hoveredUser.is_active ? '● نشط' : '● معطل'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-semibold">تاريخ الانضمام:</span>
                <span className="font-mono text-gray-600">
                  {new Date(hoveredUser.created_at).toLocaleDateString('ar-EG')}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════
          Modal: إضافة مستخدم جديد وتسكينه على منشأة
      ══════════════════════════════════════════════════ */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="card max-w-lg w-full"
            style={{ boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3 mb-4">
              <h3 className="font-bold text-base text-[var(--color-text)] flex items-center gap-2">
                <span>➕</span>
                <span>إضافة مستخدم جديد للنظام</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            {addModalMsg && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs font-bold ${
                  addModalMsg.type === 'success' ? 'alert-success' : 'alert-error'
                }`}
              >
                {addModalMsg.text}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">
                    اسم الموظف الرباعي <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="د. أحمد محمد محمود"
                    value={newUserData.fullName}
                    onChange={(e) => setNewUserData({ ...newUserData, fullName: e.target.value })}
                    className="form-input text-xs"
                  />
                </div>

                <div>
                  <label className="form-label">الرقم القومي (14 رقماً)</label>
                  <input
                    type="text"
                    maxLength={14}
                    placeholder="2900101XXXXXXXX"
                    value={newUserData.nationalId}
                    onChange={(e) => setNewUserData({ ...newUserData, nationalId: e.target.value.replace(/\D/g, '') })}
                    className="form-input text-xs font-mono"
                    dir="ltr"
                    style={{ textAlign: 'right' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">
                    البريد الإلكتروني <span className="required">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="user@health.gov.eg"
                    value={newUserData.email}
                    onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                    className="form-input text-xs"
                    dir="ltr"
                    style={{ textAlign: 'right' }}
                  />
                </div>

                <div>
                  <label className="form-label">
                    كلمة المرور المبدئية <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Pass@123456"
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                    className="form-input text-xs font-mono"
                    dir="ltr"
                    style={{ textAlign: 'right' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">
                    الدور والصلاحية <span className="required">*</span>
                  </label>
                  <select
                    required
                    value={newUserData.roleId}
                    onChange={(e) => setNewUserData({ ...newUserData, roleId: e.target.value })}
                    className="form-input text-xs"
                  >
                    <option value="">— اختر الصلاحية —</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {ROLE_LABELS[r.name] || r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">المستشفى / المنشأة التابع لها</label>
                  {isSuperAdmin ? (
                    <select
                      value={newUserData.facilityId}
                      onChange={(e) => setNewUserData({ ...newUserData, facilityId: e.target.value })}
                      className="form-input text-xs"
                    >
                      <option value="">— بدون منشأة (لأدوار الوزارة) —</option>
                      {facilities.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.code})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      disabled
                      value={facilityName || 'منشأتك الحالية'}
                      className="form-input text-xs bg-gray-100 cursor-not-allowed font-bold text-gray-700"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">رقم الهاتف المحمول</label>
                  <input
                    type="tel"
                    placeholder="010XXXXXXXX"
                    value={newUserData.phone}
                    onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
                    className="form-input text-xs"
                    dir="ltr"
                    style={{ textAlign: 'right' }}
                  />
                </div>

                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newUserData.mustChangePassword}
                      onChange={(e) =>
                        setNewUserData({ ...newUserData, mustChangePassword: e.target.checked })
                      }
                      className="rounded border-gray-300 text-[var(--color-primary)]"
                    />
                    <span className="text-[11px] text-[var(--color-text)] font-semibold">
                      إلزام بتغيير كلمة المرور
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-[var(--color-border)]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-outline text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="btn btn-primary text-xs"
                >
                  {creatingUser ? 'جاري الإنشاء...' : 'حفظ وإنشاء الحساب 🚀'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          Modal: تعديل بيانات وصلاحيات المستخدم
      ══════════════════════════════════════════════════ */}
      {editModalUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={() => setEditModalUser(null)}
        >
          <div
            className="card max-w-lg w-full"
            style={{ boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3 mb-4">
              <h3 className="font-bold text-base text-[var(--color-text)]">
                ✏️ تعديل بيانات: {editModalUser.full_name}
              </h3>
              <button
                onClick={() => setEditModalUser(null)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            {editMsg && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs font-bold ${
                  editMsg.type === 'success' ? 'alert-success' : 'alert-error'
                }`}
              >
                {editMsg.text}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">الاسم الكامل</label>
                  <input
                    type="text"
                    required
                    value={editFormData.fullName}
                    onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                    className="form-input text-xs"
                  />
                </div>

                <div>
                  <label className="form-label">الرقم القومي (14 رقماً)</label>
                  <input
                    type="text"
                    maxLength={14}
                    value={editFormData.nationalId}
                    onChange={(e) => setEditFormData({ ...editFormData, nationalId: e.target.value.replace(/\D/g, '') })}
                    className="form-input text-xs font-mono"
                    dir="ltr"
                    style={{ textAlign: 'right' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">الدور والصلاحية</label>
                  <select
                    value={editFormData.roleId}
                    onChange={(e) => setEditFormData({ ...editFormData, roleId: e.target.value })}
                    className="form-input text-xs"
                  >
                    <option value="">— بدون دور —</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {ROLE_LABELS[r.name] || r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">المستشفى / المنشأة</label>
                  {isSuperAdmin ? (
                    <select
                      value={editFormData.facilityId}
                      onChange={(e) => setEditFormData({ ...editFormData, facilityId: e.target.value })}
                      className="form-input text-xs"
                    >
                      <option value="">— بدون منشأة (لصلاحيات الوزارة) —</option>
                      {facilities.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.code})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      disabled
                      value={facilityName || editModalUser?.facility_name || 'منشأتك الحالية'}
                      className="form-input text-xs bg-gray-100 cursor-not-allowed font-bold text-gray-700"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">رقم الهاتف</label>
                  <input
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="form-input text-xs"
                    dir="ltr"
                    style={{ textAlign: 'right' }}
                  />
                </div>

                <div>
                  <label className="form-label">تعيين كلمة مرور جديدة (اختياري)</label>
                  <input
                    type="text"
                    placeholder="اتركه فارغاً لعدم التغيير"
                    value={editFormData.newPassword}
                    onChange={(e) => setEditFormData({ ...editFormData, newPassword: e.target.value })}
                    className="form-input text-xs font-mono"
                    dir="ltr"
                    style={{ textAlign: 'right' }}
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormData.isActive}
                    onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.checked })}
                    className="rounded border-gray-300 text-[var(--color-primary)]"
                  />
                  <span className="text-xs font-bold text-[var(--color-text)]">
                    الحساب نشط ومفعل للدخول
                  </span>
                </label>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-[var(--color-border)]">
                <button
                  type="button"
                  onClick={() => setEditModalUser(null)}
                  className="btn btn-outline text-xs"
                >
                  إلغاء
                </button>
                <button type="submit" disabled={savingEdit} className="btn btn-primary text-xs">
                  {savingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات ✅'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          Modal: تأكيد حذف المستخدم
      ══════════════════════════════════════════════════ */}
      {deleteModalUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={() => setDeleteModalUser(null)}
        >
          <div
            className="card max-w-sm w-full text-center"
            style={{ boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-2xl mx-auto mb-3">
              🗑️
            </div>
            <h3 className="font-bold text-base text-[var(--color-text)] mb-1">
              تأكيد حذف المستخدم
            </h3>
            <p className="text-xs text-[var(--color-muted)] mb-4 leading-relaxed">
              هل أنت متأكد من حذف الحساب الخاص بـ:
              <br />
              <b className="text-[var(--color-text)] text-sm">{deleteModalUser.full_name}</b>
              <br />
              سيتم مسح صلاحياته وحسابه من المنظومة نهائياً.
            </p>

            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => setDeleteModalUser(null)}
                className="btn btn-outline text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={deletingUser}
                onClick={handleDeleteUser}
                className="btn text-xs bg-red-600 hover:bg-red-700 text-white"
              >
                {deletingUser ? 'جاري الحذف...' : 'نعم، حذف نهائي'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ══════════════════════════════════════════════════
          Modal: بطاقة بيانات الدخول والتسليم الرسمي للمستشفى
      ══════════════════════════════════════════════════ */}
      {credentialModalUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
          onClick={() => setCredentialModalUser(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-blue-200 p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">📋</span>
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900">
                    بطاقة تسليم بيانات الدخول
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    بيانات الاعتماد الرسمية المخصصة للموظف
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCredentialModalUser(null)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Credential Slip Content */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-gray-500 font-bold">المنشأة الطبية:</span>
                <span className="font-bold text-blue-950">{credentialModalUser.facility_name || 'ديوان عام الوزارة'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">اسم الموظف:</span>
                <span className="font-bold text-gray-800">{credentialModalUser.full_name || '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">الدور / الصلاحية:</span>
                <span className="font-bold text-[var(--color-primary)]">
                  {credentialModalUser.role_name ? (ROLE_LABELS[credentialModalUser.role_name] || credentialModalUser.role_name) : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-gray-200">
                <span className="text-gray-600 font-bold">البريد الإلكتروني:</span>
                <span className="font-mono text-gray-900 font-bold text-xs" dir="ltr">
                  {credentialModalUser.email}
                </span>
              </div>
              <div className="flex justify-between items-center bg-amber-50 p-2 rounded-lg border border-amber-200">
                <span className="text-amber-900 font-bold">كلمة المرور الافتراضية:</span>
                <span className="font-mono text-amber-950 font-black text-sm bg-white px-2 py-0.5 rounded border border-amber-300" dir="ltr">
                  {getDefaultPassword(credentialModalUser.role_name, credentialModalUser.email)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 text-[11px] text-gray-500">
                <span>رابط الدخول:</span>
                <span className="font-mono text-blue-600" dir="ltr">http://localhost:3000/login</span>
              </div>
            </div>

            {/* Quick Copy Delivery Message Button */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  const defaultPwd = getDefaultPassword(credentialModalUser.role_name, credentialModalUser.email)
                  const msg = `🏛️ جمهورية مصر العربية — وزارة الصحة والسكان\nمنظومة المتابعة المالية الموحدة للمستشفيات\n\nتحية طيبة وبعد،\nنرسل لسيادتكم بيانات الدخول الرسمية الخاصة بكم على المنظومة:\n\n🏥 المنشأة: ${credentialModalUser.facility_name || 'ديوان عام الوزارة'}\n👤 الاسم: ${credentialModalUser.full_name}\n🏷️ الدور: ${credentialModalUser.role_name ? ROLE_LABELS[credentialModalUser.role_name] : ''}\n✉️ البريد الإلكتروني: ${credentialModalUser.email}\n🔑 كلمة المرور الافتراضية: ${defaultPwd}\n🌐 رابط الدخول: http://localhost:3000/login\n\n⚠️ يرجى تغيير كلمة المرور فور أول تسجيل دخول للحفاظ على سرية وأمان الحساب.`
                  navigator.clipboard.writeText(msg)
                  setCopiedDeliveryText(true)
                  setTimeout(() => setCopiedDeliveryText(false), 2500)
                }}
                className="btn btn-primary w-full text-xs font-bold !min-h-[38px] flex items-center justify-center gap-2"
              >
                <span>{copiedDeliveryText ? '✓ تم النسخ بنجاح للحافظة' : '📋 نسخ رسالة التسليم الكاملة (واتساب / إيميل)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setCredentialModalUser(null)}
                className="btn btn-ghost w-full text-xs text-gray-600 hover:bg-gray-100 !min-h-[34px]"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          Modal: نافذة الدعم الفني بالوزارة لطلب تعديل الحسابات
      ══════════════════════════════════════════════════ */}
      {showSupportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setShowSupportModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-blue-200 p-6 sm:p-7 space-y-6 text-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[var(--color-primary)] border border-blue-200 flex items-center justify-center text-2xl shadow-xs shrink-0">
                  🏛️
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-gray-900 leading-snug">
                    خدمة الدعم الفني بالديوان العام
                  </h3>
                  <p className="text-[11px] font-bold text-amber-800 mt-0.5">
                    قطاع مكتب السيد الوزير — منظومة المتابعة المالية
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSupportModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold transition-all"
              >
                ✕
              </button>
            </div>

            {/* Respectful & Wise Message Content */}
            <div className="space-y-4 text-xs leading-relaxed text-gray-700">
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50/80 to-indigo-50/50 border border-blue-100">
                <p className="font-extrabold text-blue-950 text-sm mb-1 flex items-center gap-2">
                  <span>👋</span> أهلاً بحضرتك زميلنا العزيز
                  {supportUserTarget?.facility_name ? ` بمستشفى ${supportUserTarget.facility_name}` : ''}
                </p>
                <p className="text-gray-600 text-[11px] leading-relaxed">
                  حرصاً على سلامة الحسابات المالية وضمان أعلى معايير الحوكمة والرقابة المعتمدة بوزارة الصحة والسكان، يتم إنشاء وتعديل صلاحيات المستخدمين مركزياً بالتنسيق المباشر مع فريق الدعم الفني بالوزارة.
                </p>
              </div>

              {supportUserTarget && (
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
                  <p className="text-[11px] text-gray-500 font-bold">الحساب المطلوب تعديله أو مراجعته:</p>
                  <p className="font-extrabold text-gray-900 text-xs">
                    👤 {supportUserTarget.full_name} ({supportUserTarget.email || '—'})
                  </p>
                  <p className="text-[10px] text-gray-500 font-mono">
                    الدور الحالي: {supportUserTarget.role_name ? ROLE_LABELS[supportUserTarget.role_name] : '—'}
                  </p>
                </div>
              )}

              {/* Support Contact Box */}
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🤝</span>
                  <p className="font-extrabold text-amber-950 text-xs">
                    يسعدنا ويشرفنا دائماً تقديم المساعدة الفورية لك:
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <a
                    href={`tel:${SUPPORT_PHONE}`}
                    className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 font-bold text-xs shadow-xs transition-all"
                  >
                    <span>📞</span>
                    <span>اتصال: {SUPPORT_PHONE}</span>
                  </a>

                  <a
                    href={`https://wa.me/20${SUPPORT_PHONE.slice(1)}?text=${encodeURIComponent(
                      `السلام عليكم، نحتاج مساعدة الدعم الفني بوزارة الصحة بخصوص تعديل بيانات المستخدم: ${supportUserTarget?.full_name || ''} بمستشفى ${supportUserTarget?.facility_name || facilityName || ''}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs shadow-xs transition-all"
                  >
                    <span>💬</span>
                    <span>محادثة واتساب مباشرة</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowSupportModal(false)}
                className="btn btn-primary text-xs !px-6"
              >
                حسناً، شكراً لكم 👍
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
