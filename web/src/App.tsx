import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppBar } from './components/AppBar';
import { useAuth } from './auth';
import { Dashboard } from './pages/Dashboard';
import { Editor } from './pages/Editor';
import { NotFound } from './pages/NotFound';
import { Responses } from './pages/Responses';
import { Fill } from './pages/Fill';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { Spinner } from './components/ui';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

export function App() {
  const location = useLocation();
  const isFill = location.pathname.startsWith('/f/');
  const isAuthPage =
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/forgot-password';
  const isKnownRoute = location.pathname === '/' || location.pathname.startsWith('/forms');

  const showAppBar = !isFill && !isAuthPage && isKnownRoute;

  return (
    <div className="min-h-dvh">
      {showAppBar ? <AppBar /> : null}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/forms/:id"
          element={
            <RequireAuth>
              <Editor />
            </RequireAuth>
          }
        />
        <Route
          path="/forms/:id/responses"
          element={
            <RequireAuth>
              <Responses />
            </RequireAuth>
          }
        />
        <Route path="/f/:id" element={<Fill />} />
        <Route path="/f/:id/edit/:responseId" element={<Fill />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}
