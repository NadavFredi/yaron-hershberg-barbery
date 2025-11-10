
import { ReactNode } from 'react';
import DashboardHeader from '@/components/admin/DashboardHeader';

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {


  return (
    <div className="min-h-screen bg-gray-50">

      <main className="w-full">
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;
