import 'server-only';
import { headers } from 'next/headers';
import { getAuth } from './auth';
export async function createAuthServerClient() {
  return { auth: { getUser: async () => {
    const session = await getAuth().api.getSession({ headers: await headers() });
    const user = session?.user;
    return { data: { user: user ? {
      id: user.id, email: user.email,
      user_metadata: { full_name: user.name, business_name: user.businessName },
    } : null }, error: null };
  } } };
}
