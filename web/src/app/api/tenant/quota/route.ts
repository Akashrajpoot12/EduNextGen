import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch the school's precise billing status and assigned quota limit
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('subscription_status, student_quota')
      .eq('id', tenantId)
      .single();

    if (schoolError || !school) throw new Error('Tenant not found');

    // 1. Check Billing Status Hard Block
    if (school.subscription_status === 'past_due' || school.subscription_status === 'canceled') {
      return NextResponse.json({ 
        allowed: false, 
        reason: 'Subscription payment failed. Please update billing to resume operations.' 
      }, { status: 403 });
    }

    // 2. Check Student Volume Quota (Prevents uploading 10,000 students on a 500 limit plan)
    const { count, error: countError } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', tenantId);

    if (countError) throw countError;

    const currentCount = count || 0;
    const isAtQuota = currentCount >= school.student_quota;

    return NextResponse.json({
      allowed: !isAtQuota,
      currentUsage: currentCount,
      quotaLimit: school.student_quota,
      reason: isAtQuota ? 'Student quota exceeded. Please upgrade your SaaS tier.' : null
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
