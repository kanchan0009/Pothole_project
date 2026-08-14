import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';


export function PublicLayout() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className={`flex-1 ${!isHome ? 'mx-4' : ''}`}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
