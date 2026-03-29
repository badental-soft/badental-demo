'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from './AuthProvider'
import {
  LayoutDashboard,
  CalendarDays,
  Wallet,
  Package,
  Users,
  CheckSquare,
  Timer,
  LogOut,
  ChevronLeft,
  Menu,
  Settings,
  FlaskConical,
} from 'lucide-react'
import { useState } from 'react'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  roles: string[]
  disabled?: boolean
}

const adminNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={20} />, roles: ['admin'] },
  { label: 'Turnos', href: '/turnos', icon: <CalendarDays size={20} />, roles: ['admin'] },
  { label: 'Finanzas', href: '/finanzas', icon: <Wallet size={20} />, roles: ['admin'] },
  { label: 'Stock', href: '/stock', icon: <Package size={20} />, roles: ['admin', 'rolC'] },
  { label: 'Laboratorio', href: '/laboratorio', icon: <FlaskConical size={20} />, roles: ['admin'] },
  { label: 'Empleados', href: '/empleados', icon: <Users size={20} />, roles: ['admin'] },
  { label: 'Configuración', href: '/configuracion', icon: <Settings size={20} />, roles: ['admin'] },
]

const employeeNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={20} />, roles: ['rolA', 'rolB', 'rolC'] },
  { label: 'Turnos', href: '/turnos', icon: <CalendarDays size={20} />, roles: ['rolA', 'rolB', 'rolC'] },
  { label: 'Stock', href: '/stock', icon: <Package size={20} />, roles: ['rolB'] },
  { label: 'Laboratorio', href: '/laboratorio', icon: <FlaskConical size={20} />, roles: ['rolB', 'rolC'] },
  { label: 'Tareas', href: '/tareas', icon: <CheckSquare size={20} />, roles: ['rolA', 'rolB', 'rolC'] },
  { label: 'Horas', href: '/horas', icon: <Timer size={20} />, roles: ['rolA'] },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const isAdmin = user?.rol === 'admin'
  const navItems = isAdmin ? adminNavItems : employeeNavItems
  const filteredItems = navItems.filter((item) => user && item.roles.includes(user.rol))

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    rolA: 'Recepcionista Digital',
    rolB: 'Vendedor',
    rolC: 'Recepcionista',
  }

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-surface border border-border rounded-lg p-2 shadow-sm"
      >
        <Menu size={20} />
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-surface border-r border-border z-50 transition-all duration-200 flex flex-col
          ${collapsed ? 'w-[68px]' : 'w-[250px]'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className={`flex items-center gap-2 px-4 h-[60px] border-b border-border shrink-0 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-2.5 h-2.5 rounded-full bg-green-primary shrink-0" />
          {!collapsed && (
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-[11px] font-medium tracking-[0.15em] uppercase text-text-primary truncate">
                BA Dental
              </span>
              <span className="text-text-muted text-[11px]">|</span>
              <span className="text-[10px] text-text-secondary truncate">Gestión</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto hidden lg:flex text-text-muted hover:text-text-primary transition-colors"
          >
            <ChevronLeft size={16} className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <div className="space-y-0.5">
            {filteredItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

              if (item.disabled) {
                return (
                  <span
                    key={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium opacity-40 cursor-not-allowed select-none
                      ${collapsed ? 'justify-center' : ''}
                    `}
                    title={collapsed ? `${item.label} (próximamente)` : 'Próximamente'}
                  >
                    <span className="text-text-muted">{item.icon}</span>
                    {!collapsed && (
                      <>
                        {item.label}
                        <span className="ml-auto text-[9px] uppercase tracking-wider text-text-muted font-semibold">Pronto</span>
                      </>
                    )}
                  </span>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${isActive
                      ? 'bg-green-light text-green-primary'
                      : 'text-text-secondary hover:bg-beige hover:text-text-primary'
                    }
                    ${collapsed ? 'justify-center' : ''}
                  `}
                  title={collapsed ? item.label : undefined}
                >
                  <span className={isActive ? 'text-green-primary' : 'text-text-muted'}>
                    {item.icon}
                  </span>
                  {!collapsed && item.label}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* User footer */}
        <div className={`border-t border-border px-3 py-3 shrink-0 ${collapsed ? 'px-2' : ''}`}>
          {!collapsed && user && (
            <div className="mb-2 px-1">
              <p className="text-sm font-medium text-text-primary truncate">{user.nombre}</p>
              <p className="text-xs text-text-muted">{roleLabels[user.rol] || user.rol}</p>
            </div>
          )}
          <button
            onClick={signOut}
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-red-light hover:text-red transition-colors
              ${collapsed ? 'justify-center px-0' : ''}
            `}
            title={collapsed ? 'Cerrar sesión' : undefined}
          >
            <LogOut size={18} />
            {!collapsed && 'Cerrar sesión'}
          </button>
        </div>
      </aside>
    </>
  )
}
