import { useState } from 'react';
import Shell from './components/Shell';
import { StoreProvider, useStore } from './store';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PosPage from './pages/PosPage';
import OrdersPage from './pages/OrdersPage';
import KitchenPage from './pages/KitchenPage';
import TablesPage from './pages/TablesPage';
import ReservationsPage from './pages/ReservationsPage';
import CustomersPage from './pages/CustomersPage';
import MenuPage from './pages/MenuPage';
import CategoriesPage from './pages/CategoriesPage';
import InventoryPage from './pages/InventoryPage';
import RecipesPage from './pages/RecipesPage';
import SuppliersPage from './pages/SuppliersPage';
import PurchasesPage from './pages/PurchasesPage';
import DeliveryPage from './pages/DeliveryPage';
import ExpensesPage from './pages/ExpensesPage';
import EmployeesPage from './pages/EmployeesPage';
import AttendancePage from './pages/AttendancePage';
import PayrollPage from './pages/PayrollPage';
import AccountingPage from './pages/AccountingPage';
import ReportsPage from './pages/ReportsPage';
import ProfitPage from './pages/ProfitPage';
import DuesPage from './pages/DuesPage';
import DiscountsPage from './pages/DiscountsPage';
import QrMenuPage from './pages/QrMenuPage';
import SettingsPage from './pages/SettingsPage';
import RolesPage from './pages/RolesPage';
import PublicMenuPage from './pages/PublicMenuPage';

function Console() {
  const { user, ready } = useStore();
  const [view, setView] = useState('dashboard');
  const isPublicMenu = window.location.pathname.replace(/\/+$/, '').endsWith('/menu');

  if (isPublicMenu) return <PublicMenuPage />;

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b0e11]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#e7b943]/25 border-t-[#e7b943]" />
          <div className="text-[11px] uppercase tracking-[.24em] text-slate-600">Loading branch data</div>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const pages: Record<string, () => JSX.Element> = {
    dashboard: () => <DashboardPage onNavigate={setView} />,
    pos: () => <PosPage onNavigate={setView} />,
    orders: () => <OrdersPage />,
    kitchen: () => <KitchenPage />,
    tables: () => <TablesPage />,
    reservations: () => <ReservationsPage />,
    customers: () => <CustomersPage />,
    menu: () => <MenuPage />,
    categories: () => <CategoriesPage />,
    inventory: () => <InventoryPage />,
    recipes: () => <RecipesPage />,
    suppliers: () => <SuppliersPage />,
    purchases: () => <PurchasesPage />,
    delivery: () => <DeliveryPage />,
    expenses: () => <ExpensesPage />,
    employees: () => <EmployeesPage />,
    attendance: () => <AttendancePage />,
    payroll: () => <PayrollPage />,
    accounting: () => <AccountingPage />,
    reports: () => <ReportsPage />,
    profit: () => <ProfitPage />,
    dues: () => <DuesPage />,
    discounts: () => <DiscountsPage />,
    qr: () => <QrMenuPage />,
    settings: () => <SettingsPage />,
    roles: () => <RolesPage onNavigate={setView} />
  };

  return (
    <Shell view={view} onNavigate={setView}>
      {(pages[view] ?? pages.dashboard)()}
    </Shell>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Console />
    </StoreProvider>
  );
}
