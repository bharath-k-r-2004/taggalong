import { useLocation, Link, Outlet } from 'react-router-dom'
import { Home, Search, MapPin, MessageSquare, User } from 'lucide-react'

export function Layout() {
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/search', label: 'Search', icon: Search },
    { path: '/trips', label: 'My Trips', icon: MapPin },
    { path: '/messages', label: 'Messages', icon: MessageSquare },
    { path: '/profile', label: 'Profile', icon: User }
  ]

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Main content: the current page (Home, Search, Profile...) renders here */}
      <div className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-secondary-200 flex justify-around md:hidden">
        {navItems.map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={`flex-1 flex flex-col items-center justify-center py-4 transition-colors ${
              isActive(path)
                ? 'text-primary-600 border-t-2 border-primary-600'
                : 'text-secondary-600 hover:text-primary-600'
            }`}
            title={label}
          >
            <Icon size={24} />
            <span className="text-xs mt-1">{label}</span>
          </Link>
        ))}
      </nav>

      {/* Desktop Sidebar */}
      <aside className="hidden md:block fixed left-0 top-0 h-screen w-64 bg-white border-r border-secondary-200 pt-8">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-primary-600">TagAlong</h1>
        </div>
        <nav className="mt-8">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center px-6 py-4 transition-colors ${
                isActive(path)
                  ? 'bg-primary-50 text-primary-600 border-r-4 border-primary-600'
                  : 'text-secondary-700 hover:bg-secondary-50'
              }`}
            >
              <Icon size={20} className="mr-3" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile top spacing */}
      <div className="md:ml-64" />
    </div>
  )
}
