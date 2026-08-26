export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type FacilityType = 'hospital' | 'health_unit' | 'family_health_center' | 'specialized_center' | 'health_administration' | 'health_directorate'
export type RoleName = 'super_admin' | 'ministry_viewer' | 'hospital_admin' | 'hospital_data_entry' | 'hospital_viewer'
export type DeductionType = 'staff_dues' | 'medicine_supplies'
export type ContractType = 'security' | 'cleaning' | 'maintenance' | 'patient_food' | 'staff_food'
export type AuditAction = 'create' | 'update' | 'approve' | 'delete'

export type Database = {
  public: {
    Tables: {
      governorates: {
        Row: {
          id: string
          name: string
          code: string
          display_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          code: string
          display_order?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          code?: string
          display_order?: number
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      health_directorates: {
        Row: {
          id: string
          governorate_id: string
          name: string
          code: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          governorate_id: string
          name: string
          code: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          governorate_id?: string
          name?: string
          code?: string
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'health_directorates_governorate_id_fkey'
            columns: ['governorate_id']
            isOneToOne: false
            referencedRelation: 'governorates'
            referencedColumns: ['id']
          }
        ]
      }
      health_administrations: {
        Row: {
          id: string
          directorate_id: string
          name: string
          code: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          directorate_id: string
          name: string
          code: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          directorate_id?: string
          name?: string
          code?: string
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'health_administrations_directorate_id_fkey'
            columns: ['directorate_id']
            isOneToOne: false
            referencedRelation: 'health_directorates'
            referencedColumns: ['id']
          }
        ]
      }
      facilities: {
        Row: {
          id: string
          directorate_id: string
          administration_id?: string | null
          name: string
          code: string
          institutional_code: string | null
          facility_type: FacilityType
          is_model_hospital?: boolean
          affiliation?: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          directorate_id: string
          administration_id?: string | null
          name: string
          code: string
          institutional_code?: string | null
          facility_type: FacilityType
          is_model_hospital?: boolean
          affiliation?: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          directorate_id?: string
          administration_id?: string | null
          name?: string
          code?: string
          institutional_code?: string | null
          facility_type?: FacilityType
          is_model_hospital?: boolean
          affiliation?: string
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'facilities_directorate_id_fkey'
            columns: ['directorate_id']
            isOneToOne: false
            referencedRelation: 'health_directorates'
            referencedColumns: ['id']
          }
        ]
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          national_id: string | null
          phone: string | null
          is_active: boolean
          must_change_password: boolean
          created_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          national_id?: string | null
          phone?: string | null
          is_active?: boolean
          must_change_password?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          national_id?: string | null
          phone?: string | null
          is_active?: boolean
          must_change_password?: boolean
          created_at?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          id: string
          name: RoleName
          description: string | null
        }
        Insert: {
          id?: string
          name: RoleName
          description?: string | null
        }
        Update: {
          id?: string
          name?: RoleName
          description?: string | null
        }
        Relationships: []
      }
      user_facility_roles: {
        Row: {
          id: string
          user_id: string
          facility_id: string | null
          role_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          facility_id?: string | null
          role_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          facility_id?: string | null
          role_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_facility_roles_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_facility_roles_facility_id_fkey'
            columns: ['facility_id']
            isOneToOne: false
            referencedRelation: 'facilities'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_facility_roles_role_id_fkey'
            columns: ['role_id']
            isOneToOne: false
            referencedRelation: 'roles'
            referencedColumns: ['id']
          }
        ]
      }
      revenue_sources: {
        Row: {
          id: string
          label: string
          display_order: number
          is_active: boolean
        }
        Insert: {
          id?: string
          label: string
          display_order?: number
          is_active?: boolean
        }
        Update: {
          id?: string
          label?: string
          display_order?: number
          is_active?: boolean
        }
        Relationships: []
      }
      revenue_entries: {
        Row: {
          id: string
          ref_number: string | null
          facility_id: string
          revenue_source_id: string
          month: string
          amount: number
          notes: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          ref_number?: string | null
          facility_id: string
          revenue_source_id: string
          month: string
          amount: number
          notes?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          ref_number?: string | null
          facility_id?: string
          revenue_source_id?: string
          month?: string
          amount?: number
          notes?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      deductions: {
        Row: {
          id: string
          ref_number: string | null
          facility_id: string
          month: string
          deduction_type: DeductionType
          amount: number
          notes: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          ref_number?: string | null
          facility_id: string
          month: string
          deduction_type: DeductionType
          amount: number
          notes?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          ref_number?: string | null
          facility_id?: string
          month?: string
          deduction_type?: DeductionType
          amount?: number
          notes?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      procurement_orders: {
        Row: {
          id: string
          ref_number: string | null
          facility_id: string
          month: string
          order_date: string
          order_number: string
          value: number
          item_type: 'دواء' | 'مستلزمات'
          funding_source: 'خزانة' | 'صندوق'
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          ref_number?: string | null
          facility_id: string
          month: string
          order_date: string
          order_number: string
          value: number
          item_type: 'دواء' | 'مستلزمات'
          funding_source: 'خزانة' | 'صندوق'
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          ref_number?: string | null
          facility_id?: string
          month?: string
          order_date?: string
          order_number?: string
          value?: number
          item_type?: 'دواء' | 'مستلزمات'
          funding_source?: 'خزانة' | 'صندوق'
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          id: string
          facility_id: string
          contract_type: ContractType
          company_name: string
          start_date: string
          duration_months: number
          individual_value: number
          supervisor_value: number
          total_individuals: number
          total_supervisors: number
          total_contract_value: number
          is_active: boolean
          allow_hospital_edit: boolean
          unlocked_by: string | null
          unlocked_at: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          facility_id: string
          contract_type: ContractType
          company_name: string
          start_date: string
          duration_months: number
          individual_value: number
          supervisor_value?: number
          total_individuals: number
          total_supervisors?: number
          total_contract_value: number
          is_active?: boolean
          allow_hospital_edit?: boolean
          unlocked_by?: string | null
          unlocked_at?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          facility_id?: string
          contract_type?: ContractType
          company_name?: string
          start_date?: string
          duration_months?: number
          individual_value?: number
          supervisor_value?: number
          total_individuals?: number
          total_supervisors?: number
          total_contract_value?: number
          is_active?: boolean
          allow_hospital_edit?: boolean
          unlocked_by?: string | null
          unlocked_at?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      contract_payments: {
        Row: {
          id: string
          ref_number: string | null
          contract_id: string
          facility_id: string
          month: string
          amount_paid: number
          notes: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          ref_number?: string | null
          contract_id: string
          facility_id: string
          month: string
          amount_paid: number
          notes?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          ref_number?: string | null
          contract_id?: string
          facility_id?: string
          month?: string
          amount_paid?: number
          notes?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      distribution_percentages: {
        Row: {
          id: string
          label: string
          percentage: number
          display_order: number
          updated_at: string
        }
        Insert: {
          id?: string
          label: string
          percentage: number
          display_order?: number
          updated_at?: string
        }
        Update: {
          id?: string
          label?: string
          percentage?: number
          display_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      staff_distribution_percentages: {
        Row: {
          id: string
          label: string
          percentage: number
          display_order: number
          updated_at: string
        }
        Insert: {
          id?: string
          label: string
          percentage: number
          display_order?: number
          updated_at?: string
        }
        Update: {
          id?: string
          label?: string
          percentage?: number
          display_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          id: string
          title: string
          body: string
          is_active: boolean
          display_order: number
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          body: string
          is_active?: boolean
          display_order?: number
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          body?: string
          is_active?: boolean
          display_order?: number
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      monthly_closures: {
        Row: {
          id: string
          facility_id: string
          month: string
          closed_by: string
          closed_at: string
        }
        Insert: {
          id?: string
          facility_id: string
          month: string
          closed_by: string
          closed_at?: string
        }
        Update: {
          id?: string
          facility_id?: string
          month?: string
          closed_by?: string
          closed_at?: string
        }
        Relationships: []
      }
      monthly_deadlines: {
        Row: {
          month: string
          deadline_date: string
          is_locked: boolean
          lock_scope: string
          notes: string | null
          created_by: string | null
          updated_at: string
        }
        Insert: {
          month: string
          deadline_date: string
          is_locked?: boolean
          lock_scope?: string
          notes?: string | null
          created_by?: string | null
          updated_at?: string
        }
        Update: {
          month?: string
          deadline_date?: string
          is_locked?: boolean
          lock_scope?: string
          notes?: string | null
          created_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          id: string
          user_id: string | null
          facility_id: string | null
          action: AuditAction
          table_name: string
          record_id: string | null
          old_value: Json | null
          new_value: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          facility_id?: string | null
          action: AuditAction
          table_name: string
          record_id?: string | null
          old_value?: Json | null
          new_value?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          facility_id?: string | null
          action?: AuditAction
          table_name?: string
          record_id?: string | null
          old_value?: Json | null
          new_value?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      financial_adjustments: {
        Row: {
          id: string
          ref_number: string | null
          facility_id: string
          month: string
          record_type: 'revenue' | 'deduction' | 'procurement' | 'contract_payment'
          original_record_id: string | null
          original_ref_number: string | null
          adjustment_type: 'increase' | 'decrease' | 'correction'
          amount: number
          reason: string
          approved_by_admin: boolean
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          ref_number?: string | null
          facility_id: string
          month: string
          record_type: 'revenue' | 'deduction' | 'procurement' | 'contract_payment'
          original_record_id?: string | null
          original_ref_number?: string | null
          adjustment_type: 'increase' | 'decrease' | 'correction'
          amount: number
          reason: string
          approved_by_admin?: boolean
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          ref_number?: string | null
          facility_id?: string
          month?: string
          record_type?: 'revenue' | 'deduction' | 'procurement' | 'contract_payment'
          original_record_id?: string | null
          original_ref_number?: string | null
          adjustment_type?: 'increase' | 'decrease' | 'correction'
          amount?: number
          reason?: string
          approved_by_admin?: boolean
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      monthly_facility_summary: {
        Row: {
          facility_id: string
          facility_name: string
          facility_code: string
          institutional_code: string | null
          facility_type: FacilityType
          directorate_name: string
          governorate_name: string
          governorate_code: string
          month: string
          fiscal_year: number
          fiscal_quarter: number
          total_revenue: number
          total_deductions: number
          net_revenue: number
          total_procurement: number
          total_contract_payments: number
          total_expenses: number
          is_closed: boolean
        }
        Relationships: []
      }
      quarterly_summary: {
        Row: {
          facility_id: string
          facility_name: string
          facility_code: string
          directorate_name: string
          governorate_name: string
          fiscal_year: number
          fiscal_quarter: number
          total_revenue: number
          total_deductions: number
          net_revenue: number
          total_procurement: number
          total_contract_payments: number
          total_expenses: number
        }
        Relationships: []
      }
      annual_summary: {
        Row: {
          facility_id: string
          facility_name: string
          facility_code: string
          directorate_name: string
          governorate_name: string
          fiscal_year: number
          total_revenue: number
          total_deductions: number
          net_revenue: number
          total_procurement: number
          total_contract_payments: number
          total_expenses: number
        }
        Relationships: []
      }
    }
    Functions: {
      user_has_role_for_facility: {
        Args: { target_facility_id: string; allowed_roles: string[] }
        Returns: boolean
      }
      is_super_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      fiscal_year: {
        Args: { d: string }
        Returns: number
      }
      fiscal_quarter: {
        Args: { d: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
