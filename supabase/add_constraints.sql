-- Run in Supabase SQL Editor (short & simple)
ALTER TABLE public.students
  ADD CONSTRAINT students_enrollment_number_key UNIQUE (enrollment_number);
