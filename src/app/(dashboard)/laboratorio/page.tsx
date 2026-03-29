import { requireRole } from '@/lib/auth-guard'
import LaboratorioClient from './LaboratorioClient'

export default async function LaboratorioPage() {
  await requireRole('admin', 'rolB', 'rolC')
  return <LaboratorioClient />
}
