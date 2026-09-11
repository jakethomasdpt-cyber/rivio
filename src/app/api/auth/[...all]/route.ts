import { getAuth } from '@/lib/auth';
import { NextRequest } from 'next/server';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) { return getAuth().handler(request); }
export async function POST(request: NextRequest) { return getAuth().handler(request); }
