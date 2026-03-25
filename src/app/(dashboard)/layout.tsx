import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AuthProvider } from '@/components/AuthProvider'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <AuthProvider initialUser={user}>
      <div className="min-h-screen bg-beige">
        <Sidebar />
        {/* Main content — offset by sidebar width */}
        <main className="lg:ml-[250px] transition-all duration-200">
          <div className="p-6 pt-16 lg:pt-8 lg:p-8 max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </AuthProvider>
  )
}
