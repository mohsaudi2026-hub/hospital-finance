'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ROLES, type RoleName, ROLE_LABELS } from '@/lib/constants'

export interface UserRoleInfo {
  userId: string | null
  email: string | null
  fullName: string | null
  phone: string | null
  nationalId: string | null
  role: RoleName | null
  roleLabel: string
  facilityId: string | null
  facilityName: string | null
  facilityCode: string | null
  facilityInstitutionalCode: string | null
  directorateName: string | null
  governorateName: string | null
  isSuperAdmin: boolean
  isMinistryViewer: boolean
  isHospitalAdmin: boolean
  isHospitalDataEntry: boolean
  isHospitalViewer: boolean
  canEditFinancials: boolean
  canApproveMonth: boolean
  canManageUsers: boolean
  loading: boolean
}

export function useUserRole(): UserRoleInfo {
  const supabase = createClient()
  const [info, setInfo] = useState<UserRoleInfo>({
    userId: null,
    email: null,
    fullName: null,
    phone: null,
    nationalId: null,
    role: null,
    roleLabel: '',
    facilityId: null,
    facilityName: null,
    facilityCode: null,
    facilityInstitutionalCode: null,
    directorateName: null,
    governorateName: null,
    isSuperAdmin: false,
    isMinistryViewer: false,
    isHospitalAdmin: false,
    isHospitalDataEntry: false,
    isHospitalViewer: false,
    canEditFinancials: false,
    canApproveMonth: false,
    canManageUsers: false,
    loading: true,
  })

  useEffect(() => {
    async function loadRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setInfo(prev => ({ ...prev, loading: false }))
          return
        }

        // جلب بيانات الملف الشخصي والرقم القومي والهاتف
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, phone, national_id')
          .eq('id', user.id)
          .maybeSingle()

        // جلب الدور والمنشأة والهيكل الجغرافي
        const { data: ufr } = await supabase
          .from('user_facility_roles')
          .select(`
            facility_id,
            roles ( name ),
            facilities (
              name,
              code,
              institutional_code,
              health_directorates (
                name,
                governorates ( name )
              )
            )
          `)
          .eq('user_id', user.id)
          .maybeSingle()

        let roleName = (ufr?.roles as any)?.name as RoleName || null
        const fac = ufr?.facilities as any
        const dir = fac?.health_directorates as any
        const gov = dir?.governorates as any

        // إذا كان البريد هو super@admin.com، يعتبر دائماً super_admin
        if (user.email === 'super@admin.com') {
          roleName = ROLES.SUPER_ADMIN
        }

        const isSuperAdmin        = roleName === ROLES.SUPER_ADMIN || user.email === 'super@admin.com'
        const isMinistryViewer    = roleName === ROLES.MINISTRY_VIEWER
        const isHospitalAdmin     = roleName === ROLES.HOSPITAL_ADMIN
        const isHospitalDataEntry = roleName === ROLES.HOSPITAL_DATA_ENTRY
        const isHospitalViewer    = roleName === ROLES.HOSPITAL_VIEWER

        setInfo({
          userId: user.id,
          email: user.email || null,
          fullName: profile?.full_name || (user.user_metadata?.full_name as string) || (isSuperAdmin ? 'مدير عام المنظومة' : user.email?.split('@')[0] || 'مستخدم المنظومة'),
          phone: profile?.phone || null,
          nationalId: profile?.national_id || null,
          role: roleName,
          roleLabel: isSuperAdmin ? 'مدير عام المنظومة (Super Admin)' : (roleName ? (ROLE_LABELS[roleName] || roleName) : 'مستخدم'),
          facilityId: ufr?.facility_id || null,
          facilityName: fac?.name || null,
          facilityCode: fac?.code || null,
          facilityInstitutionalCode: fac?.institutional_code || null,
          directorateName: dir?.name || null,
          governorateName: gov?.name || null,
          isSuperAdmin,
          isMinistryViewer,
          isHospitalAdmin,
          isHospitalDataEntry,
          isHospitalViewer,
          canEditFinancials: isSuperAdmin || isHospitalAdmin || isHospitalDataEntry,
          canApproveMonth: isSuperAdmin || isHospitalAdmin,
          canManageUsers: isSuperAdmin || isHospitalAdmin,
          loading: false,
        })
      } catch (err) {
        console.error('Error fetching user role info:', err)
        setInfo(prev => ({ ...prev, loading: false }))
      }
    }

    loadRole()
  }, [])

  return info
}
