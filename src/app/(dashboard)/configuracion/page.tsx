import { requireRole } from '@/lib/auth-guard'
import ConfiguracionClient from './ConfiguracionClient'

export default async function ConfiguracionPage() {
  await requireRole('admin')

  return <ConfiguracionClient />
}
