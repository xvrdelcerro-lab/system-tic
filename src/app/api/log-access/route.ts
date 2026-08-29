import { NextResponse } from 'next/server';
import { logUserAccess } from '@/app/actions/log-access';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { uid, email, timezone } = body;

    if (!uid || !email || !timezone) {
      return NextResponse.json({ error: 'Missing required parameters (uid, email, timezone)' }, { status: 400 });
    }

    await logUserAccess({uid, email, timezone});

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('LOG ACCESS ERROR', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
