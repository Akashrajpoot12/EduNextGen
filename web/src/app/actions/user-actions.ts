"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

// Initialize a Supabase client with the Service Role key
// This bypasses RLS, so use carefully!
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function createStudent(data: {
  school_id: string;
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  class_id: string;
  roll_number: string;
  admission_number: string;
  tenant_path: string;
}) {
  try {
    // 1. Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password || "student123", // Default password if none provided
      email_confirm: true,
      user_metadata: {
        first_name: data.first_name,
        last_name: data.last_name,
      }
    });

    if (authError) throw new Error(`Auth Error: ${authError.message}`);
    
    const userId = authUser.user.id;

    // 2. Insert into users table
    const { error: userError } = await supabaseAdmin.from('users').insert({
      id: userId,
      email: data.email,
      full_name: `${data.first_name} ${data.last_name}`,
      school_id: data.school_id
    });

    if (userError) throw new Error(`User Table Error: ${userError.message}`);

    // 3. Insert into user_roles
    const { error: roleError } = await supabaseAdmin.from('user_roles').insert({
      user_id: userId,
      school_id: data.school_id,
      role: 'student'
    });

    if (roleError) throw new Error(`Role Error: ${roleError.message}`);

    // 4. Insert into students table
    const { error: studentError } = await supabaseAdmin.from('students').insert({
      user_id: userId,
      school_id: data.school_id,
      class_id: data.class_id,
      roll_number: data.roll_number,
      admission_number: data.admission_number
    });

    if (studentError) throw new Error(`Student Table Error: ${studentError.message}`);

    // Revalidate the page to show new data
    revalidatePath(`/(platform)/${data.tenant_path}/admin/students`);
    
    return { success: true, userId };
  } catch (error: any) {
    console.error("Error creating student:", error);
    return { success: false, error: error.message };
  }
}

export async function createTeacher(data: {
  school_id: string;
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  tenant_path: string;
}) {
  try {
    // 1. Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password || "teacher123", // Default password
      email_confirm: true,
      user_metadata: {
        first_name: data.first_name,
        last_name: data.last_name,
      }
    });

    if (authError) throw new Error(`Auth Error: ${authError.message}`);
    
    const userId = authUser.user.id;

    // 2. Insert into users table
    const { error: userError } = await supabaseAdmin.from('users').insert({
      id: userId,
      email: data.email,
      full_name: `${data.first_name} ${data.last_name}`,
      school_id: data.school_id
    });

    if (userError) throw new Error(`User Table Error: ${userError.message}`);

    // 3. Insert into user_roles
    const { error: roleError } = await supabaseAdmin.from('user_roles').insert({
      user_id: userId,
      school_id: data.school_id,
      role: 'teacher'
    });

    if (roleError) throw new Error(`Role Error: ${roleError.message}`);

    // Revalidate the page to show new data
    revalidatePath(`/(platform)/${data.tenant_path}/admin/teachers`);
    
    return { success: true, userId };
  } catch (error: any) {
    console.error("Error creating teacher:", error);
    return { success: false, error: error.message };
  }
}
