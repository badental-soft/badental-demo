import { requireRole } from '@/lib/auth-guard'
import EmpleadosClient from './EmpleadosClient'

export default async function EmpleadosPage() {
  await requireRole('admin')

  return <EmpleadosClient />
}
