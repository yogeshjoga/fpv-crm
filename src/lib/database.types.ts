export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cert_counters: {
        Row: { course_code: string; last_seq: number }
        Insert: { course_code: string; last_seq?: number }
        Update: { course_code?: string; last_seq?: number }
        Relationships: []
      }
      staff_details: {
        Row: {
          profile_id: string
          employee_code: string | null
          department: string
          designation: string
          joined_on: string | null
          notes: string
          updated_at: string
        }
        Insert: {
          profile_id: string
          employee_code?: string | null
          department?: string
          designation?: string
          joined_on?: string | null
          notes?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["staff_details"]["Insert"]>
        Relationships: []
      }
      calendar_events: {
        Row: {
          id: string
          title: string
          description: string
          type: Database["public"]["Enums"]["calendar_event_type"]
          starts_at: string
          ends_at: string | null
          all_day: boolean
          location: string
          course_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string
          type?: Database["public"]["Enums"]["calendar_event_type"]
          starts_at: string
          ends_at?: string | null
          all_day?: boolean
          location?: string
          course_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["calendar_events"]["Insert"]>
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          recipient_id: string
          title: string
          body: string
          kind: string
          link: string | null
          broadcast_id: string | null
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          recipient_id: string
          title: string
          body?: string
          kind?: string
          link?: string | null
          broadcast_id?: string | null
          read_at?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>
        Relationships: []
      }
      registrations: {
        Row: {
          id: string
          source: Database["public"]["Enums"]["registration_source"]
          form_id: string | null
          full_name: string
          email: string
          phone: string | null
          answers: Json
          requested_course_id: string | null
          status: Database["public"]["Enums"]["registration_status"]
          reviewed_by: string | null
          reviewed_at: string | null
          review_note: string | null
          created_profile_id: string | null
          created_at: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          payment_amount: number | null
          payment_ref: string | null
          payment_method: string | null
          paid_at: string | null
          paid_by: string | null
        }
        Insert: {
          id?: string
          source?: Database["public"]["Enums"]["registration_source"]
          form_id?: string | null
          full_name?: string
          email: string
          phone?: string | null
          answers?: Json
          requested_course_id?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          reviewed_by?: string | null
          reviewed_at?: string | null
          review_note?: string | null
          created_profile_id?: string | null
          created_at?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payment_amount?: number | null
          payment_ref?: string | null
          payment_method?: string | null
          paid_at?: string | null
          paid_by?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["registrations"]["Insert"]>
        Relationships: []
      }
      broadcasts: {
        Row: {
          id: string
          subject: string
          body: string
          audience_type: string
          audience_ref: Json
          recipient_count: number
          email_sent: number
          sent_by: string | null
          sent_at: string
        }
        Insert: {
          id?: string
          subject: string
          body?: string
          audience_type: string
          audience_ref?: Json
          recipient_count?: number
          email_sent?: number
          sent_by?: string | null
          sent_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["broadcasts"]["Insert"]>
        Relationships: []
      }
      certificates: {
        Row: {
          attempt_id: string | null
          cert_id_string: string
          course_id: string
          id: string
          issued_at: string
          pdf_path: string | null
          qr_url: string | null
          revoked: boolean
          revoked_reason: string | null
          score_pct: number
          student_id: string
        }
        Insert: {
          attempt_id?: string | null
          cert_id_string: string
          course_id: string
          id?: string
          issued_at?: string
          pdf_path?: string | null
          qr_url?: string | null
          revoked?: boolean
          revoked_reason?: string | null
          score_pct: number
          student_id: string
        }
        Update: Partial<Database["public"]["Tables"]["certificates"]["Insert"]>
        Relationships: []
      }
      courses: {
        Row: {
          cooldown_hours: number
          course_code: string
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string
          exam_question_count: number
          exam_time_limit_min: number
          id: string
          max_attempts: number
          pass_pct: number
          slug: string
          status: Database["public"]["Enums"]["course_status"]
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          cooldown_hours?: number
          course_code: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          exam_question_count?: number
          exam_time_limit_min?: number
          id?: string
          max_attempts?: number
          pass_pct?: number
          slug: string
          status?: Database["public"]["Enums"]["course_status"]
          summary?: string
          title: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["courses"]["Insert"]>
        Relationships: []
      }
      enrollment_form_fields: {
        Row: {
          field_type: Database["public"]["Enums"]["form_field_type"]
          form_id: string
          help_text: string
          id: string
          label: string
          options_json: Json
          position: number
          required: boolean
        }
        Insert: {
          field_type?: Database["public"]["Enums"]["form_field_type"]
          form_id: string
          help_text?: string
          id?: string
          label: string
          options_json?: Json
          position?: number
          required?: boolean
        }
        Update: Partial<Database["public"]["Tables"]["enrollment_form_fields"]["Insert"]>
        Relationships: []
      }
      enrollment_forms: {
        Row: {
          closes_at: string | null
          course_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_open: boolean
          is_public: boolean
          opens_at: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          course_id: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_open?: boolean
          is_public?: boolean
          opens_at?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["enrollment_forms"]["Insert"]>
        Relationships: []
      }
      enrollment_request_answers: {
        Row: {
          field_id: string
          file_path: string | null
          id: string
          request_id: string
          value_json: Json | null
          value_text: string | null
        }
        Insert: {
          field_id: string
          file_path?: string | null
          id?: string
          request_id: string
          value_json?: Json | null
          value_text?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["enrollment_request_answers"]["Insert"]>
        Relationships: []
      }
      enrollment_requests: {
        Row: {
          course_id: string
          form_id: string
          id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["enroll_request_status"]
          student_id: string
          submitted_at: string
        }
        Insert: {
          course_id: string
          form_id: string
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["enroll_request_status"]
          student_id: string
          submitted_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["enrollment_requests"]["Insert"]>
        Relationships: []
      }
      enrollments: {
        Row: {
          course_id: string
          enrolled_at: string
          enrolled_by: string | null
          id: string
          source_request_id: string | null
          status: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          enrolled_by?: string | null
          id?: string
          source_request_id?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
        }
        Update: Partial<Database["public"]["Tables"]["enrollments"]["Insert"]>
        Relationships: []
      }
      exam_attempt_answers: {
        Row: {
          attempt_id: string
          id: string
          is_correct: boolean
          question_id: string
          selected_option_ids_json: Json
        }
        Insert: {
          attempt_id: string
          id?: string
          is_correct?: boolean
          question_id: string
          selected_option_ids_json?: Json
        }
        Update: Partial<Database["public"]["Tables"]["exam_attempt_answers"]["Insert"]>
        Relationships: []
      }
      exam_attempts: {
        Row: {
          attempt_no: number
          cooldown_until: string | null
          course_id: string
          created_at: string
          enrollment_id: string
          expires_at: string
          id: string
          locked: boolean
          passed: boolean | null
          question_ids_json: Json
          score_pct: number | null
          started_at: string
          status: Database["public"]["Enums"]["attempt_status"]
          student_id: string
          submitted_at: string | null
        }
        Insert: {
          attempt_no: number
          cooldown_until?: string | null
          course_id: string
          created_at?: string
          enrollment_id: string
          expires_at: string
          id?: string
          locked?: boolean
          passed?: boolean | null
          question_ids_json?: Json
          score_pct?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          student_id: string
          submitted_at?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["exam_attempts"]["Insert"]>
        Relationships: []
      }
      lesson_resources: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          lesson_id: string
          mime: string | null
          size_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          lesson_id: string
          mime?: string | null
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["lesson_resources"]["Insert"]>
        Relationships: []
      }
      lessons: {
        Row: {
          content: string
          created_at: string
          id: string
          module_id: string
          position: number
          title: string
          video_url: string | null
          kind: Database["public"]["Enums"]["lesson_kind"]
          embed_url: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          module_id: string
          position?: number
          title: string
          video_url?: string | null
          kind?: Database["public"]["Enums"]["lesson_kind"]
          embed_url?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["lessons"]["Insert"]>
        Relationships: []
      }
      modules: {
        Row: {
          course_id: string
          created_at: string
          id: string
          position: number
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          position?: number
          title: string
        }
        Update: Partial<Database["public"]["Tables"]["modules"]["Insert"]>
        Relationships: []
      }
      org_settings: {
        Row: {
          cert_id_prefix: string
          default_cooldown_hours: number
          default_max_attempts: number
          default_pass_pct: number
          default_question_count: number
          default_time_limit_min: number
          google_form_secret: string
          id: boolean
          logo_url: string | null
          org_name: string
          signatory_image_url: string | null
          signatory_name: string
          signatory_title: string
          support_email: string
          updated_at: string
          verify_base_url: string
        }
        Insert: {
          cert_id_prefix?: string
          default_cooldown_hours?: number
          default_max_attempts?: number
          default_pass_pct?: number
          default_question_count?: number
          default_time_limit_min?: number
          google_form_secret?: string
          id?: boolean
          logo_url?: string | null
          org_name?: string
          signatory_image_url?: string | null
          signatory_name?: string
          support_email?: string
          updated_at?: string
          verify_base_url?: string
        }
        Update: Partial<Database["public"]["Tables"]["org_settings"]["Insert"]>
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          must_change_password: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          must_change_password?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>
        Relationships: []
      }
      question_options: {
        Row: {
          id: string
          is_correct: boolean
          label: string
          position: number
          question_id: string
        }
        Insert: {
          id?: string
          is_correct?: boolean
          label: string
          position?: number
          question_id: string
        }
        Update: Partial<Database["public"]["Tables"]["question_options"]["Insert"]>
        Relationships: []
      }
      questions: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          explanation: string
          id: string
          is_active: boolean
          prompt: string
          type: Database["public"]["Enums"]["question_type"]
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          explanation?: string
          id?: string
          is_active?: boolean
          prompt: string
          type?: Database["public"]["Enums"]["question_type"]
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["questions"]["Insert"]>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      current_user_role: { Args: Record<string, never>; Returns: Database["public"]["Enums"]["user_role"] }
      current_user_status: { Args: Record<string, never>; Returns: Database["public"]["Enums"]["user_status"] }
      is_active_user: { Args: Record<string, never>; Returns: boolean }
      is_staff: { Args: Record<string, never>; Returns: boolean }
      is_super_admin: { Args: Record<string, never>; Returns: boolean }
      verify_certificate: {
        Args: { p_cert_id: string }
        Returns: {
          course_title: string
          issued_at: string
          revoked: boolean
          score_pct: number
          student_name: string
          valid: boolean
        }[]
      }
    }
    Enums: {
      attempt_status: "in_progress" | "submitted" | "expired"
      calendar_event_type: "session" | "exam_window" | "deadline" | "holiday" | "other"
      course_status: "draft" | "published" | "archived"
      enroll_request_status: "pending" | "approved" | "rejected"
      enrollment_status: "active" | "completed" | "revoked"
      form_field_type:
        | "text" | "textarea" | "select" | "multiselect" | "number"
        | "email" | "phone" | "date" | "file" | "checkbox"
      lesson_kind: "article" | "video" | "embed" | "download"
      payment_status: "unpaid" | "paid" | "waived"
      question_type: "single" | "multi"
      registration_source: "registration_form" | "google_form" | "csv"
      registration_status: "pending" | "accepted" | "rejected"
      user_role: "super_admin" | "instructor" | "student"
      user_status: "pending" | "active" | "suspended"
    }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
