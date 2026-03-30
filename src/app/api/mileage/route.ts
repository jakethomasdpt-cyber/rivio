import { createAuthServerClient, createServerSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// IRS standard mileage rate for 2024/2025
const IRS_RATE_PER_MILE = 0.70;

async function getUser() {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServerSupabaseClient();

    // Optional year filter (defaults to current year)
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || new Date().getFullYear().toString();
    const startOfYear = `${year}-01-01`;
    const endOfYear = `${year}-12-31`;

    const { data: trips, error } = await supabase
      .from('mileage_trips')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startOfYear)
      .lte('date', endOfYear)
      .order('date', { ascending: false });

    if (error) {
      console.error('Fetch mileage trips error:', error);
      return NextResponse.json({ error: 'Failed to fetch mileage trips' }, { status: 500 });
    }

    const tripList = trips || [];
    const total_miles = tripList.reduce((sum, t) => sum + Number(t.miles), 0);
    const total_deduction = tripList.reduce((sum, t) => sum + Number(t.irs_deduction), 0);
    const trips_count = tripList.length;

    return NextResponse.json({
      trips: tripList,
      summary: {
        total_miles: Math.round(total_miles * 100) / 100,
        total_deduction: Math.round(total_deduction * 100) / 100,
        trips_count,
        year: Number(year),
      },
    });
  } catch (err) {
    console.error('GET /api/mileage error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      start_lat,
      start_lng,
      end_lat,
      end_lng,
      start_address,
      end_address,
      date,
      miles: rawMiles,
      purpose,
    } = body;

    // Validate required fields
    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 });
    }
    if (rawMiles === undefined || rawMiles === null) {
      return NextResponse.json({ error: 'miles is required' }, { status: 400 });
    }

    const miles = Number(rawMiles);
    if (!Number.isFinite(miles) || miles < 0 || miles > 10000) {
      return NextResponse.json(
        { error: 'miles must be a positive number (max 10,000)' },
        { status: 400 }
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        { error: 'date must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    // Calculate IRS deduction server-side
    const irs_deduction = Math.round(miles * IRS_RATE_PER_MILE * 100) / 100;

    const supabase = createServerSupabaseClient();

    const { data: trip, error } = await supabase
      .from('mileage_trips')
      .insert([
        {
          user_id: user.id,
          date,
          start_address: start_address || '',
          end_address: end_address || '',
          start_lat: start_lat ?? null,
          start_lng: start_lng ?? null,
          end_lat: end_lat ?? null,
          end_lng: end_lng ?? null,
          miles: Math.round(miles * 100) / 100,
          purpose: purpose || null,
          irs_deduction,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Insert mileage trip error:', error);
      return NextResponse.json({ error: 'Failed to create mileage trip' }, { status: 500 });
    }

    return NextResponse.json(trip, { status: 201 });
  } catch (err) {
    console.error('POST /api/mileage error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
