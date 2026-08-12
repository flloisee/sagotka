import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Moon, Sun } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { IconButton } from './ui';
import { Logo } from './Logo';

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('sagotka-theme', next ? 'dark' : 'light');
  };
  return { dark, toggle };
}

export function AppBar() {
  const { dark, toggle } = useTheme();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await api.logout();
    } finally {
      setUser(null);
      setSigningOut(false);
      navigate('/login');
    }
  };

  return (
    <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between rounded-pill border border-rule bg-paper/80 px-3 py-2 shadow-card backdrop-blur-md sm:px-4">
        <Logo className="rounded-full px-2 py-1 transition-colors hover:bg-paper-3" />

        <div className="flex items-center gap-1.5">
          <button
            onClick={toggle}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="inline-flex size-9 items-center justify-center rounded-full text-neutral transition-colors hover:bg-paper-3 hover:text-ink"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <span className="hidden items-center rounded-full bg-paper-3 px-3 py-1.5 text-[13px] font-medium text-ink-2 md:flex">
            {user?.email}
          </span>
          <IconButton label="Sign out" onClick={signOut}>
            <LogOut className="size-4" />
          </IconButton>
        </div>
      </div>
    </header>
  );
}
