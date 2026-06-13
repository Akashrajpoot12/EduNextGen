import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
// import Stripe from 'stripe'; // Ensure Stripe SDK is installed in production

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature') as string;
    
    // In a production environment:
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });
    // const event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
    
    // For MVP scaffolding, we mock the event extraction
    const event = JSON.parse(body);

    const supabase = await createClient();

    if (event.type === 'invoice.payment_succeeded') {
      const customerId = event.data.object.customer;
      
      // Update school status to active and unlock the platform
      await supabase
        .from('schools')
        .update({ subscription_status: 'active' })
        .eq('stripe_customer_id', customerId);
        
    } else if (event.type === 'invoice.payment_failed') {
      const customerId = event.data.object.customer;
      
      // Downgrade school status to past_due, instantly enforcing RLS restrictions and blocking access
      await supabase
        .from('schools')
        .update({ subscription_status: 'past_due' })
        .eq('stripe_customer_id', customerId);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Stripe Webhook Error:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 400 });
  }
}
