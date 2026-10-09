export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assessment_marks: {
        Row: {
          component: string
          course_id: string
          created_at: string
          entered_by: string | null
          id: string
          marks: number
          student_id: string
          updated_at: string
        }
        Insert: {
          component: string
          course_id: string
          created_at?: string
          entered_by?: string | null
          id?: string
          marks: number
          student_id: string
          updated_at?: string
        }
        Update: {
          component?: string
          course_id?: string
          created_at?: string
          entered_by?: string | null
          id?: string
          marks?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_marks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_marks_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          actor_role: string | null
          at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          row_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor?: string | null
          actor_role?: string | null
          at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          row_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor?: string | null
          actor_role?: string | null
          at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          row_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      broadcasts: {
        Row: {
          audience_ref: Json
          audience_type: string
          body: string
          email_sent: number
          id: string
          recipient_count: number
          sent_at: string
          sent_by: string | null
          subject: string
        }
        Insert: {
          audience_ref?: Json
          audience_type: string
          body?: string
          email_sent?: number
          id?: string
          recipient_count?: number
          sent_at?: string
          sent_by?: string | null
          subject: string
        }
        Update: {
          audience_ref?: Json
          audience_type?: string
          body?: string
          email_sent?: number
          id?: string
          recipient_count?: number
          sent_at?: string
          sent_by?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcasts_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          course_id: string | null
          created_at: string
          created_by: string | null
          description: string
          ends_at: string | null
          id: string
          location: string
          starts_at: string
          title: string
          type: Database["public"]["Enums"]["calendar_event_type"]
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string | null
          id?: string
          location?: string
          starts_at: string
          title: string
          type?: Database["public"]["Enums"]["calendar_event_type"]
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string | null
          id?: string
          location?: string
          starts_at?: string
          title?: string
          type?: Database["public"]["Enums"]["calendar_event_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      careers_application_notes: {
        Row: {
          application_id: string
          notes: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          application_id: string
          notes?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          application_id?: string
          notes?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "careers_application_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "careers_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "careers_application_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      careers_application_rounds: {
        Row: {
          application_id: string
          feedback: string
          id: string
          interviewer: string
          meet_link: string
          round_id: string
          scheduled_at: string | null
          score: number | null
          status: string
          updated_at: string
        }
        Insert: {
          application_id: string
          feedback?: string
          id?: string
          interviewer?: string
          meet_link?: string
          round_id: string
          scheduled_at?: string | null
          score?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          feedback?: string
          id?: string
          interviewer?: string
          meet_link?: string
          round_id?: string
          scheduled_at?: string | null
          score?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "careers_application_rounds_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "careers_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "careers_application_rounds_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "careers_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      careers_applications: {
        Row: {
          accepted_terms_at: string
          answers: Json
          created_at: string
          current_round_id: string | null
          id: string
          job_id: string
          offer_note: string
          resume_path: string | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          accepted_terms_at: string
          answers?: Json
          created_at?: string
          current_round_id?: string | null
          id?: string
          job_id: string
          offer_note?: string
          resume_path?: string | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          accepted_terms_at?: string
          answers?: Json
          created_at?: string
          current_round_id?: string | null
          id?: string
          job_id?: string
          offer_note?: string
          resume_path?: string | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "careers_applications_current_round_id_fkey"
            columns: ["current_round_id"]
            isOneToOne: false
            referencedRelation: "careers_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "careers_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "careers_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "careers_applications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      careers_events: {
        Row: {
          actor: string | null
          application_id: string
          created_at: string
          id: number
          kind: string
          note: string
          visible_to_student: boolean
        }
        Insert: {
          actor?: string | null
          application_id: string
          created_at?: string
          id?: never
          kind: string
          note?: string
          visible_to_student?: boolean
        }
        Update: {
          actor?: string | null
          application_id?: string
          created_at?: string
          id?: never
          kind?: string
          note?: string
          visible_to_student?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "careers_events_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "careers_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "careers_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      careers_jobs: {
        Row: {
          apply_ends_at: string | null
          apply_starts_at: string | null
          ask_resume: boolean
          created_at: string
          created_by: string | null
          department: string
          form_fields: Json
          id: string
          jd: string
          kind: string
          location: string
          openings: number
          pay: string
          slug: string
          status: string
          summary: string
          terms: string
          title: string
          updated_at: string
          work_mode: string
        }
        Insert: {
          apply_ends_at?: string | null
          apply_starts_at?: string | null
          ask_resume?: boolean
          created_at?: string
          created_by?: string | null
          department?: string
          form_fields?: Json
          id?: string
          jd?: string
          kind?: string
          location?: string
          openings?: number
          pay?: string
          slug: string
          status?: string
          summary?: string
          terms?: string
          title: string
          updated_at?: string
          work_mode?: string
        }
        Update: {
          apply_ends_at?: string | null
          apply_starts_at?: string | null
          ask_resume?: boolean
          created_at?: string
          created_by?: string | null
          department?: string
          form_fields?: Json
          id?: string
          jd?: string
          kind?: string
          location?: string
          openings?: number
          pay?: string
          slug?: string
          status?: string
          summary?: string
          terms?: string
          title?: string
          updated_at?: string
          work_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "careers_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      careers_offers: {
        Row: {
          application_id: string | null
          candidate_email: string
          candidate_name: string
          compensation_mode: string
          compensation_note: string
          created_at: string
          created_by: string | null
          department: string
          employment_type: string
          end_date: string | null
          id: string
          issued_on: string
          jd: string
          level: string
          location: string
          notice_days: number | null
          offer_no: string | null
          pay_amount: number | null
          pay_period: string
          post_training_amount: number | null
          post_training_from: string | null
          probation_months: number | null
          reporting_to: string
          responded_at: string | null
          role_template_id: string | null
          role_title: string
          signatory_designation: string
          signatory_name: string
          start_date: string | null
          status: string
          terms: string
          training_fee: number | null
          training_months: number | null
          updated_at: string
          valid_until: string | null
          work_mode: string
          working_hours: string
        }
        Insert: {
          application_id?: string | null
          candidate_email?: string
          candidate_name: string
          compensation_mode?: string
          compensation_note?: string
          created_at?: string
          created_by?: string | null
          department?: string
          employment_type?: string
          end_date?: string | null
          id?: string
          issued_on?: string
          jd?: string
          level?: string
          location?: string
          notice_days?: number | null
          offer_no?: string | null
          pay_amount?: number | null
          pay_period?: string
          post_training_amount?: number | null
          post_training_from?: string | null
          probation_months?: number | null
          reporting_to?: string
          responded_at?: string | null
          role_template_id?: string | null
          role_title: string
          signatory_designation?: string
          signatory_name?: string
          start_date?: string | null
          status?: string
          terms?: string
          training_fee?: number | null
          training_months?: number | null
          updated_at?: string
          valid_until?: string | null
          work_mode?: string
          working_hours?: string
        }
        Update: {
          application_id?: string | null
          candidate_email?: string
          candidate_name?: string
          compensation_mode?: string
          compensation_note?: string
          created_at?: string
          created_by?: string | null
          department?: string
          employment_type?: string
          end_date?: string | null
          id?: string
          issued_on?: string
          jd?: string
          level?: string
          location?: string
          notice_days?: number | null
          offer_no?: string | null
          pay_amount?: number | null
          pay_period?: string
          post_training_amount?: number | null
          post_training_from?: string | null
          probation_months?: number | null
          reporting_to?: string
          responded_at?: string | null
          role_template_id?: string | null
          role_title?: string
          signatory_designation?: string
          signatory_name?: string
          start_date?: string | null
          status?: string
          terms?: string
          training_fee?: number | null
          training_months?: number | null
          updated_at?: string
          valid_until?: string | null
          work_mode?: string
          working_hours?: string
        }
        Relationships: [
          {
            foreignKeyName: "careers_offers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "careers_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "careers_offers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "careers_offers_role_template_id_fkey"
            columns: ["role_template_id"]
            isOneToOne: false
            referencedRelation: "careers_role_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      careers_role_templates: {
        Row: {
          created_at: string
          department: string
          id: string
          is_active: boolean
          jd: string
          level_notes: Json
          slug: string
          sort_order: number
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string
          id?: string
          is_active?: boolean
          jd?: string
          level_notes?: Json
          slug: string
          sort_order?: number
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string
          id?: string
          is_active?: boolean
          jd?: string
          level_notes?: Json
          slug?: string
          sort_order?: number
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      careers_rounds: {
        Row: {
          description: string
          exam_course_id: string | null
          id: string
          job_id: string
          kind: string
          name: string
          pass_score: number | null
          position: number
        }
        Insert: {
          description?: string
          exam_course_id?: string | null
          id?: string
          job_id: string
          kind?: string
          name: string
          pass_score?: number | null
          position?: number
        }
        Update: {
          description?: string
          exam_course_id?: string | null
          id?: string
          job_id?: string
          kind?: string
          name?: string
          pass_score?: number | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "careers_rounds_exam_course_id_fkey"
            columns: ["exam_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "careers_rounds_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "careers_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cert_counters: {
        Row: {
          course_code: string
          last_seq: number
        }
        Insert: {
          course_code: string
          last_seq?: number
        }
        Update: {
          course_code?: string
          last_seq?: number
        }
        Relationships: []
      }
      certificates: {
        Row: {
          attempt_id: string | null
          cert_id_string: string
          cert_type: string | null
          course_id: string
          id: string
          issued_at: string
          pdf_path: string | null
          qr_url: string | null
          report: Json | null
          revoked: boolean
          revoked_reason: string | null
          score_pct: number
          student_id: string
          student_name: string | null
        }
        Insert: {
          attempt_id?: string | null
          cert_id_string: string
          cert_type?: string | null
          course_id: string
          id?: string
          issued_at?: string
          pdf_path?: string | null
          qr_url?: string | null
          report?: Json | null
          revoked?: boolean
          revoked_reason?: string | null
          score_pct: number
          student_id: string
          student_name?: string | null
        }
        Update: {
          attempt_id?: string | null
          cert_id_string?: string
          cert_type?: string | null
          course_id?: string
          id?: string
          issued_at?: string
          pdf_path?: string | null
          qr_url?: string | null
          report?: Json | null
          revoked?: boolean
          revoked_reason?: string | null
          score_pct?: number
          student_id?: string
          student_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_group_coordinators: {
        Row: {
          added_at: string
          added_by: string | null
          coordinator_id: string
          group_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          coordinator_id: string
          group_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          coordinator_id?: string
          group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_group_coordinators_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_group_coordinators_coordinator_id_fkey"
            columns: ["coordinator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_group_coordinators_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "course_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      course_group_courses: {
        Row: {
          added_at: string
          course_id: string
          group_id: string
        }
        Insert: {
          added_at?: string
          course_id: string
          group_id: string
        }
        Update: {
          added_at?: string
          course_id?: string
          group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_group_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_group_courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "course_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      course_group_members: {
        Row: {
          added_at: string
          added_by: string | null
          group_id: string
          student_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          group_id: string
          student_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          group_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_group_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "course_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_group_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_groups: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          allow_backtrack: boolean
          cert_type: string
          certificate_mode: string
          cooldown_hours: number
          course_code: string
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string
          exam_access: string
          exam_closes_at: string | null
          exam_name: string | null
          exam_opens_at: string | null
          exam_question_count: number
          exam_time_limit_min: number
          grading_mode: string
          id: string
          marks_online: number
          marks_piloting: number
          marks_simulation: number
          marks_viva: number
          max_attempts: number
          merit_min_marks: number
          mix_easy: number | null
          mix_hard: number | null
          mix_medium: number | null
          pass_marks_online: number
          pass_marks_piloting: number
          pass_marks_simulation: number
          pass_marks_viva: number
          pass_pct: number
          scoring_mode: string
          show_review: boolean
          slug: string
          status: Database["public"]["Enums"]["course_status"]
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          allow_backtrack?: boolean
          cert_type?: string
          certificate_mode?: string
          cooldown_hours?: number
          course_code: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          exam_access?: string
          exam_closes_at?: string | null
          exam_name?: string | null
          exam_opens_at?: string | null
          exam_question_count?: number
          exam_time_limit_min?: number
          grading_mode?: string
          id?: string
          marks_online?: number
          marks_piloting?: number
          marks_simulation?: number
          marks_viva?: number
          max_attempts?: number
          merit_min_marks?: number
          mix_easy?: number | null
          mix_hard?: number | null
          mix_medium?: number | null
          pass_marks_online?: number
          pass_marks_piloting?: number
          pass_marks_simulation?: number
          pass_marks_viva?: number
          pass_pct?: number
          scoring_mode?: string
          show_review?: boolean
          slug: string
          status?: Database["public"]["Enums"]["course_status"]
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          allow_backtrack?: boolean
          cert_type?: string
          certificate_mode?: string
          cooldown_hours?: number
          course_code?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          exam_access?: string
          exam_closes_at?: string | null
          exam_name?: string | null
          exam_opens_at?: string | null
          exam_question_count?: number
          exam_time_limit_min?: number
          grading_mode?: string
          id?: string
          marks_online?: number
          marks_piloting?: number
          marks_simulation?: number
          marks_viva?: number
          max_attempts?: number
          merit_min_marks?: number
          mix_easy?: number | null
          mix_hard?: number | null
          mix_medium?: number | null
          pass_marks_online?: number
          pass_marks_piloting?: number
          pass_marks_simulation?: number
          pass_marks_viva?: number
          pass_pct?: number
          scoring_mode?: string
          show_review?: boolean
          slug?: string
          status?: Database["public"]["Enums"]["course_status"]
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Update: {
          field_type?: Database["public"]["Enums"]["form_field_type"]
          form_id?: string
          help_text?: string
          id?: string
          label?: string
          options_json?: Json
          position?: number
          required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "enrollment_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_forms: {
        Row: {
          closes_at: string | null
          course_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          id_card_valid_from: string | null
          id_card_valid_until: string | null
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
          id_card_valid_from?: string | null
          id_card_valid_until?: string | null
          is_open?: boolean
          is_public?: boolean
          opens_at?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          course_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          id_card_valid_from?: string | null
          id_card_valid_until?: string | null
          is_open?: boolean
          is_public?: boolean
          opens_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_forms_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_forms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Update: {
          field_id?: string
          file_path?: string | null
          id?: string
          request_id?: string
          value_json?: Json | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_request_answers_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "enrollment_form_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_request_answers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "enrollment_requests"
            referencedColumns: ["id"]
          },
        ]
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
        Update: {
          course_id?: string
          form_id?: string
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["enroll_request_status"]
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_requests_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_requests_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "enrollment_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          course_id: string
          enrolled_at: string
          enrolled_by: string | null
          extra_attempts: number
          id: string
          source_request_id: string | null
          status: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          enrolled_by?: string | null
          extra_attempts?: number
          id?: string
          source_request_id?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
        }
        Update: {
          course_id?: string
          enrolled_at?: string
          enrolled_by?: string | null
          extra_attempts?: number
          id?: string
          source_request_id?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_enrolled_by_fkey"
            columns: ["enrolled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_source_request_id_fkey"
            columns: ["source_request_id"]
            isOneToOne: false
            referencedRelation: "enrollment_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Update: {
          attempt_id?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_option_ids_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempt_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempt_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_attempts: {
        Row: {
          attempt_no: number
          cooldown_until: string | null
          course_id: string
          created_at: string
          enrollment_id: string
          expires_at: string
          grade_label: string | null
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
          grade_label?: string | null
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
        Update: {
          attempt_no?: number
          cooldown_until?: string | null
          course_id?: string
          created_at?: string
          enrollment_id?: string
          expires_at?: string
          grade_label?: string | null
          id?: string
          locked?: boolean
          passed?: boolean | null
          question_ids_json?: Json
          score_pct?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          student_id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_pool_sources: {
        Row: {
          course_id: string
          source_course_id: string
        }
        Insert: {
          course_id: string
          source_course_id: string
        }
        Update: {
          course_id?: string
          source_course_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_pool_sources_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_pool_sources_source_course_id_fkey"
            columns: ["source_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_resets: {
        Row: {
          course_id: string
          created_at: string
          done_by: string | null
          id: string
          parts: string[]
          result: Json
          student_id: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          done_by?: string | null
          id?: string
          parts: string[]
          result: Json
          student_id?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          done_by?: string | null
          id?: string
          parts?: string[]
          result?: Json
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_resets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_resets_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_resets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      id_card_counters: {
        Row: {
          key: string
          last_seq: number
        }
        Insert: {
          key: string
          last_seq?: number
        }
        Update: {
          key?: string
          last_seq?: number
        }
        Relationships: []
      }
      id_card_presets: {
        Row: {
          card_type: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          valid_from: string | null
          valid_until: string | null
          workshop_location: string | null
          workshop_name: string | null
        }
        Insert: {
          card_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          valid_from?: string | null
          valid_until?: string | null
          workshop_location?: string | null
          workshop_name?: string | null
        }
        Update: {
          card_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          valid_from?: string | null
          valid_until?: string | null
          workshop_location?: string | null
          workshop_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "id_card_presets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      id_cards: {
        Row: {
          card_number: string
          card_type: string
          course_id: string | null
          created_at: string
          fee_paid: string | null
          id: string
          issued_at: string
          issued_by: string | null
          last_emailed_at: string | null
          pdf_path: string
          student_id: string
          valid_from: string | null
          valid_until: string | null
          workshop_location: string | null
          workshop_name: string | null
        }
        Insert: {
          card_number: string
          card_type?: string
          course_id?: string | null
          created_at?: string
          fee_paid?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          last_emailed_at?: string | null
          pdf_path: string
          student_id: string
          valid_from?: string | null
          valid_until?: string | null
          workshop_location?: string | null
          workshop_name?: string | null
        }
        Update: {
          card_number?: string
          card_type?: string
          course_id?: string | null
          created_at?: string
          fee_paid?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          last_emailed_at?: string | null
          pdf_path?: string
          student_id?: string
          valid_from?: string | null
          valid_until?: string | null
          workshop_location?: string | null
          workshop_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "id_cards_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "id_cards_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "id_cards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_module_access: {
        Row: {
          access_level: string
          module_key: string
          updated_at: string
        }
        Insert: {
          access_level?: string
          module_key: string
          updated_at?: string
        }
        Update: {
          access_level?: string
          module_key?: string
          updated_at?: string
        }
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
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          lesson_id?: string
          mime?: string | null
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_resources_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_resources_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content: string
          created_at: string
          embed_url: string | null
          id: string
          kind: Database["public"]["Enums"]["lesson_kind"]
          module_id: string
          position: number
          title: string
          video_url: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          embed_url?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["lesson_kind"]
          module_id: string
          position?: number
          title: string
          video_url?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          embed_url?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["lesson_kind"]
          module_id?: string
          position?: number
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      mail_config: {
        Row: {
          id: boolean
          mail_from: string | null
          mail_reply_to: string | null
          resend_api_key: string | null
          smtp_host: string | null
          smtp_pass: string | null
          smtp_port: number
          smtp_tls: boolean
          smtp_user: string | null
          updated_at: string
        }
        Insert: {
          id?: boolean
          mail_from?: string | null
          mail_reply_to?: string | null
          resend_api_key?: string | null
          smtp_host?: string | null
          smtp_pass?: string | null
          smtp_port?: number
          smtp_tls?: boolean
          smtp_user?: string | null
          updated_at?: string
        }
        Update: {
          id?: boolean
          mail_from?: string | null
          mail_reply_to?: string | null
          resend_api_key?: string | null
          smtp_host?: string | null
          smtp_pass?: string | null
          smtp_port?: number
          smtp_tls?: boolean
          smtp_user?: string | null
          updated_at?: string
        }
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
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          broadcast_id: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          recipient_id: string
          title: string
        }
        Insert: {
          body?: string
          broadcast_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          recipient_id: string
          title: string
        }
        Update: {
          body?: string
          broadcast_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          recipient_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_broadcast_fk"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_secrets: {
        Row: {
          google_form_secret: string
          id: boolean
          updated_at: string
        }
        Insert: {
          google_form_secret?: string
          id?: boolean
          updated_at?: string
        }
        Update: {
          google_form_secret?: string
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      org_settings: {
        Row: {
          cert_background_url: string | null
          cert_id_prefix: string
          company_seal_url: string | null
          default_cooldown_hours: number
          default_max_attempts: number
          default_pass_pct: number
          default_question_count: number
          default_time_limit_min: number
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
          cert_background_url?: string | null
          cert_id_prefix?: string
          company_seal_url?: string | null
          default_cooldown_hours?: number
          default_max_attempts?: number
          default_pass_pct?: number
          default_question_count?: number
          default_time_limit_min?: number
          id?: boolean
          logo_url?: string | null
          org_name?: string
          signatory_image_url?: string | null
          signatory_name?: string
          signatory_title?: string
          support_email?: string
          updated_at?: string
          verify_base_url?: string
        }
        Update: {
          cert_background_url?: string | null
          cert_id_prefix?: string
          company_seal_url?: string | null
          default_cooldown_hours?: number
          default_max_attempts?: number
          default_pass_pct?: number
          default_question_count?: number
          default_time_limit_min?: number
          id?: boolean
          logo_url?: string | null
          org_name?: string
          signatory_image_url?: string | null
          signatory_name?: string
          signatory_title?: string
          support_email?: string
          updated_at?: string
          verify_base_url?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          archived_at: string | null
          archived_by: string | null
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
          archived_at?: string | null
          archived_by?: string | null
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
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          must_change_password?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      public_rate_limits: {
        Row: {
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          hits?: number
          key: string
          window_start?: string
        }
        Update: {
          hits?: number
          key?: string
          window_start?: string
        }
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
        Update: {
          id?: string
          is_correct?: boolean
          label?: string
          position?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          difficulty: string
          explanation: string
          id: string
          is_active: boolean
          points: number
          prompt: string
          type: Database["public"]["Enums"]["question_type"]
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          difficulty?: string
          explanation?: string
          id?: string
          is_active?: boolean
          points?: number
          prompt: string
          type?: Database["public"]["Enums"]["question_type"]
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          difficulty?: string
          explanation?: string
          id?: string
          is_active?: boolean
          points?: number
          prompt?: string
          type?: Database["public"]["Enums"]["question_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          answers: Json
          created_at: string
          created_profile_id: string | null
          email: string
          form_id: string | null
          full_name: string
          id: string
          paid_at: string | null
          paid_by: string | null
          payment_amount: number | null
          payment_method: string | null
          payment_ref: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string | null
          requested_course_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: Database["public"]["Enums"]["registration_source"]
          status: Database["public"]["Enums"]["registration_status"]
        }
        Insert: {
          answers?: Json
          created_at?: string
          created_profile_id?: string | null
          email: string
          form_id?: string | null
          full_name?: string
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          payment_amount?: number | null
          payment_method?: string | null
          payment_ref?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string | null
          requested_course_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: Database["public"]["Enums"]["registration_source"]
          status?: Database["public"]["Enums"]["registration_status"]
        }
        Update: {
          answers?: Json
          created_at?: string
          created_profile_id?: string | null
          email?: string
          form_id?: string | null
          full_name?: string
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          payment_amount?: number | null
          payment_method?: string | null
          payment_ref?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string | null
          requested_course_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: Database["public"]["Enums"]["registration_source"]
          status?: Database["public"]["Enums"]["registration_status"]
        }
        Relationships: [
          {
            foreignKeyName: "registrations_created_profile_id_fkey"
            columns: ["created_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "enrollment_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_requested_course_id_fkey"
            columns: ["requested_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          created_at: string
          description: string
          external_url: string | null
          file_name: string
          file_path: string | null
          group_id: string | null
          id: string
          mime: string
          size_bytes: number | null
          title: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string
          external_url?: string | null
          file_name: string
          file_path?: string | null
          group_id?: string | null
          id?: string
          mime?: string
          size_bytes?: number | null
          title: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          external_url?: string | null
          file_name?: string
          file_path?: string | null
          group_id?: string | null
          id?: string
          mime?: string
          size_bytes?: number | null
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "course_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_edit_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          reason: string
          review_id: string
          status: string
          student_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          reason: string
          review_id: string
          status?: string
          student_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          reason?: string
          review_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_edit_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_edit_requests_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_edit_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_website_consent: {
        Row: {
          allowed: boolean
          decided_at: string
          review_id: string
        }
        Insert: {
          allowed: boolean
          decided_at?: string
          review_id: string
        }
        Update: {
          allowed?: boolean
          decided_at?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_website_consent_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string
          course_id: string | null
          created_at: string
          group_id: string | null
          id: string
          rating: number
          student_id: string
          updated_at: string
        }
        Insert: {
          comment?: string
          course_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          rating: number
          student_id: string
          updated_at?: string
        }
        Update: {
          comment?: string
          course_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          rating?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "course_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_module_access: {
        Row: {
          access_level: string
          module_key: string
          role: string
          updated_at: string
        }
        Insert: {
          access_level: string
          module_key: string
          role: string
          updated_at?: string
        }
        Update: {
          access_level?: string
          module_key?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      showcase_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcase_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "showcase_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_likes: {
        Row: {
          created_at: string
          post_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcase_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "showcase_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_likes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_posts: {
        Row: {
          caption: string
          course_id: string | null
          created_at: string
          id: string
          media_path: string
          media_type: string
          student_id: string
        }
        Insert: {
          caption?: string
          course_id?: string | null
          created_at?: string
          id?: string
          media_path: string
          media_type?: string
          student_id: string
        }
        Update: {
          caption?: string
          course_id?: string | null
          created_at?: string
          id?: string
          media_path?: string
          media_type?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcase_posts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_posts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_blog_posts: {
        Row: {
          author: string
          category: string
          content_md: string
          cover_path: string | null
          created_at: string
          created_by: string | null
          excerpt: string
          id: string
          is_published: boolean
          published_at: string | null
          read_minutes: number
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author?: string
          category?: string
          content_md?: string
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string
          id?: string
          is_published?: boolean
          published_at?: string | null
          read_minutes?: number
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author?: string
          category?: string
          content_md?: string
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string
          id?: string
          is_published?: boolean
          published_at?: string | null
          read_minutes?: number
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_featured_reviews: {
        Row: {
          consent: string
          display_name: string
          featured_at: string
          featured_by: string | null
          review_id: string
          subtitle: string
        }
        Insert: {
          consent?: string
          display_name: string
          featured_at?: string
          featured_by?: string | null
          review_id: string
          subtitle?: string
        }
        Update: {
          consent?: string
          display_name?: string
          featured_at?: string
          featured_by?: string | null
          review_id?: string
          subtitle?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_featured_reviews_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      site_gallery_albums: {
        Row: {
          category_id: string
          created_at: string
          created_by: string | null
          description: string
          event_date: string | null
          id: string
          is_published: boolean
          slug: string
          title: string
        }
        Insert: {
          category_id: string
          created_at?: string
          created_by?: string | null
          description?: string
          event_date?: string | null
          id?: string
          is_published?: boolean
          slug: string
          title: string
        }
        Update: {
          category_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          event_date?: string | null
          id?: string
          is_published?: boolean
          slug?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_gallery_albums_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "site_gallery_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      site_gallery_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      site_gallery_images: {
        Row: {
          album_id: string
          caption: string
          created_at: string
          created_by: string | null
          full_path: string
          height: number
          id: string
          is_published: boolean
          thumb_path: string
          width: number
        }
        Insert: {
          album_id: string
          caption?: string
          created_at?: string
          created_by?: string | null
          full_path: string
          height: number
          id?: string
          is_published?: boolean
          thumb_path: string
          width: number
        }
        Update: {
          album_id?: string
          caption?: string
          created_at?: string
          created_by?: string | null
          full_path?: string
          height?: number
          id?: string
          is_published?: boolean
          thumb_path?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "site_gallery_images_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "site_gallery_albums"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_activity_time: {
        Row: {
          day: string
          seconds: number
          staff_id: string
          updated_at: string
        }
        Insert: {
          day?: string
          seconds?: number
          staff_id: string
          updated_at?: string
        }
        Update: {
          day?: string
          seconds?: number
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_activity_time_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_details: {
        Row: {
          department: string
          designation: string
          employee_code: string | null
          joined_on: string | null
          notes: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          department?: string
          designation?: string
          employee_code?: string | null
          joined_on?: string | null
          notes?: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          department?: string
          designation?: string
          employee_code?: string | null
          joined_on?: string | null
          notes?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_details_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_time: {
        Row: {
          course_id: string
          day: string
          seconds: number
          student_id: string
          updated_at: string
        }
        Insert: {
          course_id: string
          day?: string
          seconds?: number
          student_id: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          day?: string
          seconds?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_time_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_time_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "support_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      support_threads: {
        Row: {
          created_at: string
          id: string
          status: string
          student_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          student_id: string
          subject: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          student_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_threads_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verify_attempts: {
        Row: {
          at: string
          caller: string
          id: number
        }
        Insert: {
          at?: string
          caller: string
          id?: never
        }
        Update: {
          at?: string
          caller?: string
          id?: never
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_course: { Args: { p_course: string }; Returns: boolean }
      careers_ist: { Args: { p_at: string }; Returns: string }
      careers_my_rounds: {
        Args: never
        Returns: {
          application_id: string
          description: string
          exam_slug: string
          interviewer: string
          kind: string
          meet_link: string
          name: string
          round_id: string
          round_position: number
          scheduled_at: string
          status: string
        }[]
      }
      careers_respond_offer: {
        Args: { p_accept: boolean; p_offer: string }
        Returns: undefined
      }
      careers_start_round: {
        Args: {
          p_application_id: string
          p_round_id: string
          p_scheduled_at?: string
        }
        Returns: Json
      }
      careers_sync_test_scores: { Args: { p_job_id: string }; Returns: number }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      current_user_status: {
        Args: never
        Returns: Database["public"]["Enums"]["user_status"]
      }
      enrollment_form_course: {
        Args: { p_form_id: string }
        Returns: {
          slug: string
          title: string
        }[]
      }
      exam_lock_until: { Args: never; Returns: string }
      grant_exam_attempts: {
        Args: {
          p_course_id: string
          p_extra?: number
          p_skip_wait?: boolean
          p_student_id: string
        }
        Returns: Json
      }
      has_module_access: {
        Args: { p_key: string; p_level: string }
        Returns: boolean
      }
      set_review_website_consent: {
        Args: { p_allow: boolean; p_review: string }
        Returns: undefined
      }
      increment_staff_activity: {
        Args: { p_seconds: number }
        Returns: undefined
      }
      increment_study_time: {
        Args: { p_course_id: string; p_seconds: number }
        Returns: undefined
      }
      is_active_user: { Args: never; Returns: boolean }
      is_enrolled: { Args: { course: string }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      mfa_ok: { Args: never; Returns: boolean }
      my_exam_review: { Args: { p_attempt_id: string }; Returns: Json }
      next_cert_number: { Args: { p_course_code: string }; Returns: number }
      next_id_card_number: { Args: never; Returns: number }
      rate_limit_hit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      reset_exam_data: {
        Args: {
          p_course_id: string
          p_dry_run?: boolean
          p_online?: boolean
          p_piloting?: boolean
          p_revoke_certs?: boolean
          p_simulation?: boolean
          p_student_id?: string
          p_viva?: boolean
        }
        Returns: Json
      }
      safe_avatar_url: { Args: { p_url: string }; Returns: boolean }
      user_has_mfa: { Args: { p_uid: string }; Returns: boolean }
      verify_certificate: {
        Args: { p_cert_id: string }
        Returns: {
          cert_background_url: string
          cert_id_string: string
          cert_type: string
          company_seal_url: string
          course_title: string
          issued_at: string
          org_name: string
          report: Json
          report_max: number
          report_total: number
          revoked: boolean
          score_pct: number
          signatory_image_url: string
          student_name: string
          valid: boolean
          verify_base_url: string
        }[]
      }
    }
    Enums: {
      attempt_status: "in_progress" | "submitted" | "expired"
      calendar_event_type:
        | "session"
        | "exam_window"
        | "deadline"
        | "holiday"
        | "other"
      course_status: "draft" | "published" | "archived"
      enroll_request_status: "pending" | "approved" | "rejected"
      enrollment_status: "active" | "completed" | "revoked"
      form_field_type:
        | "text"
        | "textarea"
        | "select"
        | "multiselect"
        | "number"
        | "email"
        | "phone"
        | "date"
        | "file"
        | "checkbox"
      lesson_kind: "article" | "video" | "embed" | "download"
      payment_status: "unpaid" | "paid" | "waived"
      question_type: "single" | "multi"
      registration_source: "registration_form" | "google_form" | "csv"
      registration_status: "pending" | "accepted" | "rejected"
      user_role:
        | "super_admin"
        | "instructor"
        | "student"
        | "coordinator"
        | "admin"
      user_status: "pending" | "active" | "suspended"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      attempt_status: ["in_progress", "submitted", "expired"],
      calendar_event_type: [
        "session",
        "exam_window",
        "deadline",
        "holiday",
        "other",
      ],
      course_status: ["draft", "published", "archived"],
      enroll_request_status: ["pending", "approved", "rejected"],
      enrollment_status: ["active", "completed", "revoked"],
      form_field_type: [
        "text",
        "textarea",
        "select",
        "multiselect",
        "number",
        "email",
        "phone",
        "date",
        "file",
        "checkbox",
      ],
      lesson_kind: ["article", "video", "embed", "download"],
      payment_status: ["unpaid", "paid", "waived"],
      question_type: ["single", "multi"],
      registration_source: ["registration_form", "google_form", "csv"],
      registration_status: ["pending", "accepted", "rejected"],
      user_role: [
        "super_admin",
        "instructor",
        "student",
        "coordinator",
        "admin",
      ],
      user_status: ["pending", "active", "suspended"],
    },
  },
} as const
