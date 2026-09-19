import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { AnimatePresence, motion } from 'framer-motion';
import { Shield } from 'lucide-react';

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => setIsSidebarCollapsed((isCollapsed) => !isCollapsed);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans select-none">

      {/* Desktop Sidebar */}
      <motion.div
        animate={{ width: isSidebarCollapsed ? 0 : 240 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="hidden md:block h-full overflow-hidden shrink-0"
      >
        <motion.div
          animate={{ x: isSidebarCollapsed ? '-100%' : 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-60 h-full"
        >
          <Sidebar isCollapsed={isSidebarCollapsed} onToggleSidebar={toggleSidebar} />
        </motion.div>
      </motion.div>

      {isSidebarCollapsed && (
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Expand sidebar"
          className="fixed left-3 top-4 z-40 hidden md:flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-neonPurple shadow-lg transition-transform duration-200 hover:scale-110"
        >
          <span className="relative flex items-center justify-center">
            <Shield className="h-8 w-8" />
            <span className="absolute text-[10px] font-black text-white leading-none">R</span>
          </span>
        </button>
      )}

      {/* Mobile Slide-over Sidebar Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-64 h-full"
            >
              <Sidebar onCloseMobile={() => setMobileMenuOpen(false)} />
            </motion.div>
            <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
          </div>
        )}
      </AnimatePresence>

      <div className="min-w-0 flex-1 flex flex-col relative overflow-hidden">
        <Topbar
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          isSidebarCollapsed={isSidebarCollapsed}
        />

        {/* Main Content Area */}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 relative">
          {/* Subtle background glow effect */}
          <div className="ambient-glow absolute top-0 left-1/4 z-0 w-96 h-96 bg-primary/5 rounded-full mix-blend-screen filter blur-[100px] pointer-events-none" />

          <div className="relative max-w-7xl mx-auto min-h-full w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
