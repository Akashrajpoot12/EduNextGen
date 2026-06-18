export interface Database {
  public: {
    Tables: {
      schools: {
        Row: {
          id: string;
          name: string;
          subdomain: string;
          invoice_prefix: string | null;
          tax_config: any | null;
          stripe_customer_id: string | null;
          subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
          student_quota: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          subdomain: string;
          invoice_prefix?: string | null;
          tax_config?: any | null;
          stripe_customer_id?: string | null;
          subscription_status?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
          student_quota?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          subdomain?: string;
          invoice_prefix?: string | null;
          tax_config?: any | null;
          stripe_customer_id?: string | null;
          subscription_status?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
          student_quota?: number;
          created_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          face_vector: number[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name: string;
          face_vector?: number[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          face_vector?: number[] | null;
          created_at?: string;
        };
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          school_id: string | null;
          role: 'super_admin' | 'school_admin' | 'teacher' | 'parent' | 'staff' | 'student';
        };
        Insert: {
          id?: string;
          user_id: string;
          school_id?: string | null;
          role: 'super_admin' | 'school_admin' | 'teacher' | 'parent' | 'staff' | 'student';
        };
        Update: {
          id?: string;
          user_id?: string;
          school_id?: string | null;
          role?: 'super_admin' | 'school_admin' | 'teacher' | 'parent' | 'staff' | 'student';
        };
      };
      academic_years: {
        Row: {
          id: string;
          school_id: string;
          name: string;
          start_date: string;
          end_date: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          name: string;
          start_date: string;
          end_date: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          name?: string;
          start_date?: string;
          end_date?: string;
          is_active?: boolean;
          created_at?: string;
        };
      };
      classes: {
        Row: {
          id: string;
          school_id: string;
          academic_year_id: string;
          grade_level: string;
          section: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          academic_year_id: string;
          grade_level: string;
          section: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          academic_year_id?: string;
          grade_level?: string;
          section?: string;
          created_at?: string;
        };
      };
      students: {
        Row: {
          id: string;
          school_id: string;
          class_id: string | null;
          parent_id: string | null;
          first_name: string;
          last_name: string;
          enrollment_number: string | null;
          face_vector: number[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          class_id?: string | null;
          parent_id?: string | null;
          first_name: string;
          last_name: string;
          enrollment_number?: string | null;
          face_vector?: number[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          class_id?: string | null;
          parent_id?: string | null;
          first_name?: string;
          last_name?: string;
          enrollment_number?: string | null;
          face_vector?: number[] | null;
          created_at?: string;
        };
      };
      daily_attendance: {
        Row: {
          id: string;
          school_id: string;
          student_id: string;
          date: string;
          status: 'present' | 'absent' | 'late' | 'half_day';
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          student_id: string;
          date: string;
          status: 'present' | 'absent' | 'late' | 'half_day';
          recorded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          student_id?: string;
          date?: string;
          status?: 'present' | 'absent' | 'late' | 'half_day';
          recorded_by?: string | null;
          created_at?: string;
        };
      };
      homework: {
        Row: {
          id: string;
          school_id: string;
          class_id: string;
          teacher_id: string | null;
          title: string;
          description: string | null;
          due_date: string;
          attachment_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          class_id: string;
          teacher_id?: string | null;
          title: string;
          description?: string | null;
          due_date: string;
          attachment_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          class_id?: string;
          teacher_id?: string | null;
          title?: string;
          description?: string | null;
          due_date?: string;
          attachment_url?: string | null;
          created_at?: string;
        };
      };
      homework_submissions: {
        Row: {
          id: string;
          school_id: string;
          homework_id: string;
          student_id: string;
          submission_text: string | null;
          attachment_url: string | null;
          status: 'pending' | 'submitted' | 'graded' | 'late';
          grade: string | null;
          teacher_remarks: string | null;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          homework_id: string;
          student_id: string;
          submission_text?: string | null;
          attachment_url?: string | null;
          status?: 'pending' | 'submitted' | 'graded' | 'late';
          grade?: string | null;
          teacher_remarks?: string | null;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          homework_id?: string;
          student_id?: string;
          submission_text?: string | null;
          attachment_url?: string | null;
          status?: 'pending' | 'submitted' | 'graded' | 'late';
          grade?: string | null;
          teacher_remarks?: string | null;
          submitted_at?: string;
        };
      };
      exams: {
        Row: {
          id: string;
          school_id: string;
          academic_year_id: string;
          name: string;
          start_date: string;
          end_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          academic_year_id: string;
          name: string;
          start_date: string;
          end_date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          academic_year_id?: string;
          name?: string;
          start_date?: string;
          end_date?: string;
          created_at?: string;
        };
      };
      exam_marks: {
        Row: {
          id: string;
          school_id: string;
          exam_id: string;
          student_id: string;
          subject: string;
          marks_obtained: number;
          max_marks: number;
          remarks: string | null;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          exam_id: string;
          student_id: string;
          subject: string;
          marks_obtained: number;
          max_marks: number;
          remarks?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          exam_id?: string;
          student_id?: string;
          subject?: string;
          marks_obtained?: number;
          max_marks?: number;
          remarks?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
      };
      timetables: {
        Row: {
          id: string;
          school_id: string;
          class_id: string;
          day_of_week: number;
          period_number: number;
          subject: string;
          teacher_id: string | null;
          start_time: string;
          end_time: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          class_id: string;
          day_of_week: number;
          period_number: number;
          subject: string;
          teacher_id?: string | null;
          start_time: string;
          end_time: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          class_id?: string;
          day_of_week?: number;
          period_number?: number;
          subject?: string;
          teacher_id?: string | null;
          start_time?: string;
          end_time?: string;
          created_at?: string;
        };
      };
      announcements: {
        Row: {
          id: string;
          school_id: string;
          title: string;
          content: string;
          target_audience: 'all' | 'teachers' | 'students' | 'parents' | 'staff';
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          title: string;
          content: string;
          target_audience?: 'all' | 'teachers' | 'students' | 'parents' | 'staff';
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          title?: string;
          content?: string;
          target_audience?: 'all' | 'teachers' | 'students' | 'parents' | 'staff';
          created_by?: string | null;
          created_at?: string;
        };
      };
      leave_applications: {
        Row: {
          id: string;
          school_id: string;
          user_id: string;
          leave_type: 'sick' | 'casual' | 'maternity' | 'other';
          start_date: string;
          end_date: string;
          reason: string | null;
          status: 'pending' | 'approved' | 'rejected';
          reviewed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          user_id: string;
          leave_type: 'sick' | 'casual' | 'maternity' | 'other';
          start_date: string;
          end_date: string;
          reason?: string | null;
          status?: 'pending' | 'approved' | 'rejected';
          reviewed_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          user_id?: string;
          leave_type?: 'sick' | 'casual' | 'maternity' | 'other';
          start_date?: string;
          end_date?: string;
          reason?: string | null;
          status?: 'pending' | 'approved' | 'rejected';
          reviewed_by?: string | null;
          created_at?: string;
        };
      };
      fee_payments: {
        Row: {
          id: string;
          school_id: string;
          student_id: string;
          amount: number;
          due_date: string;
          status: 'pending' | 'paid' | 'overdue';
          payment_date: string | null;
        };
        Insert: {
          id?: string;
          school_id: string;
          student_id: string;
          amount: number;
          due_date: string;
          status?: 'pending' | 'paid' | 'overdue';
          payment_date?: string | null;
        };
        Update: {
          id?: string;
          school_id?: string;
          student_id?: string;
          amount?: number;
          due_date?: string;
          status?: 'pending' | 'paid' | 'overdue';
          payment_date?: string | null;
        };
      };
      registration_requests: {
        Row: {
          id: string;
          school_name: string;
          subdomain: string;
          admin_name: string;
          admin_email: string;
          status: 'pending' | 'approved' | 'rejected';
          created_at: string;
        };
        Insert: {
          id?: string;
          school_name: string;
          subdomain: string;
          admin_name: string;
          admin_email: string;
          status?: 'pending' | 'approved' | 'rejected';
          created_at?: string;
        };
        Update: {
          id?: string;
          school_name?: string;
          subdomain?: string;
          admin_name?: string;
          admin_email?: string;
          status?: 'pending' | 'approved' | 'rejected';
          created_at?: string;
        };
      };
    };
  };
}
