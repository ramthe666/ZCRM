import { destroySession, errorResponse, json } from '@/lib/auth'

export async function POST() {
  try {
    await destroySession()
    return json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
