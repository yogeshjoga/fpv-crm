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
        Update: {
          attempt_id?: string | null
          cert_id_string?: string
          course_id?: string
          id?: string
          issued_at?: string
          pdf_path?: string | null
          qr_url?: string | null
          revoked?: boolean
          revoked_reason?: string | null
          score_pct?: number
          student_id?: string
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
          cert_type: string
          cooldown_hours: number
          course_code: string
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string
          exam_question_count: number
          exam_time_limit_min: number
          grading_mode: string
          id: string
          max_attempts: number
          mix_easy: number | null
          mix_hard: number | null
          mix_medium: number | null
          pass_pct: number
          slug: string
          status: Database["public"]["Enums"]["course_status"]
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          cert_type?: string
          cooldown_hours?: number
          course_code: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          exam_question_count?: number
          exam_time_limit_min?: number
          grading_mode?: string
          id?: string
          max_attempts?: number
          mix_easy?: number | null
          mix_hard?: number | null
          mix_medium?: number | null
          pass_pct?: number
          slug: string
          status?: Database["public"]["Enums"]["course_status"]
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          cert_type?: string
          cooldown_hours?: number
          course_code?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          exam_question_count?: number
          exam_time_limit_min?: number
          grading_mode?: string
          id?: string
          max_attempts?: number
          mix_easy?: number | null
          mix_hard?: number | null
          mix_medium?: number | null
          pass_pct?: number
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
        Update: {
          course_id?: string
          enrolled_at?: string
          enrolled_by?: string | null
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
          cert_background_url?: string | null
          cert_id_prefix?: string
          company_seal_url?: string | null
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
          google_form_secret?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      current_user_status: {
        Args: never
        Returns: Database["public"]["Enums"]["user_status"]
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
      next_cert_number: { Args: { p_course_code: string }; Returns: number }
      next_id_card_number: { Args: never; Returns: number }
      verify_certificate: {
        Args: { p_cert_id: string }
        Returns: {
          cert_background_url: string
          cert_id_string: string
          cert_type: string
          course_title: string
          issued_at: string
          org_name: string
          revoked: boolean
          score_pct: number
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
