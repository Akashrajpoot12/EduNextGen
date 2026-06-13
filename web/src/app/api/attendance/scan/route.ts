import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { face_vector, school_id } = await req.json();

    if (!face_vector || !school_id) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const supabase = await createClient();

    // Call the pgvector matching RPC function in Supabase
    // This executes a blazing fast vector similarity search
    const { data: matches, error } = await supabase.rpc('match_student_face', {
      query_embedding: face_vector,
      match_threshold: 0.85, // 85% confidence threshold requirement
      match_count: 1,        // Retrieve the closest match
      p_school_id: school_id
    });

    if (error) throw error;

    if (!matches || matches.length === 0) {
      return NextResponse.json({ success: false, message: 'No biometric match found in the database.' }, { status: 404 });
    }

    const student = matches[0];

    // Record the attendance dynamically for this matched student
    const { error: insertError } = await supabase
      .from('daily_attendance')
      .insert({
        school_id: school_id,
        student_id: student.id,
        date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        status: 'present',
      });

    if (insertError) {
        // If unique constraint violation occurs (already marked present today), return success gracefully
        if (insertError.code === '23505') {
             return NextResponse.json({ success: true, message: 'Student already marked present today.', student });
        }
        throw insertError;
    }

    return NextResponse.json({ success: true, student });

  } catch (err: any) {
    console.error('Biometric Scan Processing Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
