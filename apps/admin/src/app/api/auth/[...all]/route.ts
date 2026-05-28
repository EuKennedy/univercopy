import { toNextJsHandler } from 'better-auth/next-js'

import { auth } from '@/lib/auth'

// Único endpoint /api/auth/* — Better Auth lida com /sign-in, /sign-up,
// /sign-out, /magic-link/*, /organization/*, etc. Veja docs do plugin
// para a lista completa de subpaths.
export const { GET, POST } = toNextJsHandler(auth)
