import { Link, Outlet, useLocation } from 'react-router-dom'
import { Home, MapPin, PlusCircle, Search, User } from 'lucide-react'

const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/search', label: 'Find', icon: Search },
  { path: '/create-ride', label: 'Offer', icon: PlusCircle },
  { path: '/trips', label: 'My Trips', icon: MapPin },
  { path: '/profile', label: 'Profile', icon: User }
]

export function Layout() {
  const location = useLocation()
  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  return (
    <div className="flex h-screen flex-col bg-secondary-50">
      {/* Main content: the current page renders here */}
      <main className="flex-1 overflow-y-auto pb-24 md:pb-8 md:pl-64">
        <Outlet />
      </main>

      {/* Bottom navigation (phones) */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 flex justify-around border-t border-secondary-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={`flex flex-1 flex-col items-center justify-center py-2.5 text-xs font-medium transition-colors ${
              isActive(path) ? 'text-primary-600' : 'text-secondary-500 hover:text-primary-600'
            }`}
          >
            <Icon size={22} strokeWidth={isActive(path) ? 2.5 : 2} />
            <span className="mt-0.5">{label}</span>
          </Link>
        ))}
      </nav>

      {/* Sidebar (computers) */}
      <aside className="fixed left-0 top-0 hidden h-screen w-64 border-r border-secondary-200 bg-white pt-8 md:block">
        <Link to="/" className="block px-6 py-4 text-2xl font-bold text-primary-600">
          TagAlong
        </Link>
        <nav className="mt-6">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center px-6 py-3.5 transition-colors ${
                isActive(path)
                  ? 'border-r-4 border-primary-600 bg-primary-50 font-semibold text-primary-700'
                  : 'text-secondary-700 hover:bg-secondary-50'
              }`}
            >
              <Icon size={20} className="mr-3" />
              {label === 'Find' ? 'Find a ride' : label === 'Offer' ? 'Post a ride' : label}
            </Link>
          ))}
        </nav>
      </aside>
    </div>
  )
}
