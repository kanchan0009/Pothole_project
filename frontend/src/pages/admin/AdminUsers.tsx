import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  FaChevronLeft,
  FaChevronRight,
  FaHardHat,
  FaMapMarkerAlt,
  FaPhone,
  FaSearch,
  FaUserCheck,
  FaUserShield,
  FaUserSlash,
} from 'react-icons/fa';
import { adminApi } from '../../api/admin';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SkeletonRow } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../../lib/format';
import type { AdminUser, Role } from '../../types';

const PAGE_SIZE = 10;

const ROLE_FILTERS: { value: '' | Role; label: string }[] = [
  { value: '', label: 'All roles' },
  { value: 'USER', label: 'Citizens' },
  { value: 'ADMIN', label: 'Admins' },
];

function initial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

export function AdminUsers() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [role, setRole] = useState<'' | Role>('');
  const [active, setActive] = useState<boolean | ''>('');
  const [isWorker, setIsWorker] = useState<boolean | ''>('');
  const [confirm, setConfirm] = useState<{ id: number } | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, role, active, isWorker]);

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      role: role || undefined,
      active: active === '' ? undefined : active,
      isWorker: isWorker === '' ? undefined : isWorker,
    }),
    [page, debouncedSearch, role, active, isWorker]
  );

  const { data, isFetching } = useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => adminApi.users(params),
    placeholderData: (prev) => prev,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'workers'] });
  };

  const mutate = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Parameters<typeof adminApi.updateUser>[1] }) =>
      adminApi.updateUser(id, body),
    onSuccess: (_data, vars) => {
      invalidate();
      if (vars.body.isActive === true) toast.success('User activated');
      else if (vars.body.isActive === false) toast.success('User deactivated');
      else if (vars.body.isWorker !== undefined) {
        toast.success(vars.body.isWorker ? 'Marked as maintenance worker' : 'Removed worker role');
      } else if (vars.body.role !== undefined) {
        toast.success(vars.body.role === 'ADMIN' ? 'Promoted to admin' : 'Demoted to citizen');
      } else if (vars.body.latitude !== undefined) {
        toast.success('Worker coordinates saved — Dijkstra routes recalculated');
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Update failed'),
  });

  const totalPages = data?.pagination.totalPages ?? 1;

  function handleDeactivate(user: AdminUser) {
    // First click arms the confirm; second click on the same row performs it.
    if (confirm?.id !== user.id) {
      setConfirm({ id: user.id });
      return;
    }
    setConfirm(null);
    mutate.mutate({ id: user.id, body: { isActive: false } });
  }

  const selectClass = 'input-field h-10 min-w-0 cursor-pointer pr-8 text-sm';

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-primary">User management</h1>
        <p className="mt-1 text-sm text-primary/60">
          Manage citizens, admins and maintenance workers. Deactivated users cannot sign in.
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-5 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative sm:col-span-2">
            <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-primary/35" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="input-field h-10 pl-9 text-sm"
            />
          </div>
          <select value={role} onChange={(e) => setRole(e.target.value as '' | Role)} className={selectClass}>
            {ROLE_FILTERS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <select
            value={active === '' ? '' : active ? 'active' : 'inactive'}
            onChange={(e) =>
              setActive(e.target.value === '' ? '' : e.target.value === 'active')
            }
            className={selectClass}
          >
            <option value="">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          <select
            value={isWorker === '' ? '' : isWorker ? 'workers' : 'citizens'}
            onChange={(e) =>
              setIsWorker(e.target.value === '' ? '' : e.target.value === 'workers')
            }
            className={selectClass}
          >
            <option value="">Everyone</option>
            <option value="workers">Workers only</option>
            <option value="citizens">Non-workers</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="border-b border-primary/5 bg-primary/[0.03] text-[11px] font-bold uppercase tracking-wider text-primary/45">
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Worker</th>
                <th className="px-5 py-3">Reports</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Joined</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isFetching && !data ? (
                <tr>
                  <td colSpan={8}>
                    <div className="px-5 py-4">
                      <SkeletonRow lines={PAGE_SIZE} />
                    </div>
                  </td>
                </tr>
              ) : (
                (data?.users ?? []).map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    arming={confirm?.id === u.id}
                    busy={mutate.isPending}
                    onDeactivate={() => handleDeactivate(u)}
                    onWorker={() =>
                      mutate.mutate({ id: u.id, body: { isWorker: !u.isWorker } })
                    }
                    onRole={() =>
                      mutate.mutate({ id: u.id, body: { role: u.role === 'ADMIN' ? 'USER' : 'ADMIN' } })
                    }
                    onSaveCoords={(latitude, longitude) =>
                      mutate.mutate({ id: u.id, body: { latitude, longitude } })
                    }
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && data.users.length === 0 && (
          <p className="py-12 text-center text-sm text-primary/50">No users match these filters.</p>
        )}

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-primary/5 px-5 py-4">
          <p className="text-xs text-primary/50">
            {data ? `${data.pagination.total} total users` : 'Loading…'}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <FaChevronLeft /> Prev
            </Button>
            <span className="px-1 text-xs font-semibold text-primary/60">
              Page {page} of {totalPages}
            </span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next <FaChevronRight />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

interface RowProps {
  user: AdminUser;
  arming: boolean;
  busy: boolean;
  onDeactivate: () => void;
  onWorker: () => void;
  onRole: () => void;
  onSaveCoords: (latitude: number, longitude: number) => void;
}

function UserRow({ user, arming, busy, onDeactivate, onWorker, onRole, onSaveCoords }: RowProps) {
  const iconBtn =
    'grid h-8 w-8 place-items-center rounded-lg border border-primary/10 text-sm text-primary/55 transition hover:border-accent hover:text-accent disabled:opacity-50';

  // Worker coordinate editor — saving re-plans the Dijkstra route to this crew.
  const [lat, setLat] = useState(user.latitude != null ? String(user.latitude) : '');
  const [lng, setLng] = useState(user.longitude != null ? String(user.longitude) : '');

  function saveCoords() {
    const la = Number(lat);
    const ln = Number(lng);
    if (Number.isNaN(la) || Number.isNaN(ln) || la < -90 || la > 90 || ln < -180 || ln > 180) {
      return; // invalid input — ignore; the inputs stay for correction
    }
    onSaveCoords(la, ln);
  }

  return (
    <tr className="border-b border-primary/5 last:border-0 hover:bg-primary/[0.02]">
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-white">
            {initial(user.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-primary">{user.name}</p>
            <p className="truncate text-[11px] text-primary/45">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-3">
        {user.phone ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-primary/70">
            <FaPhone className="text-[10px] text-primary/40" /> {user.phone}
          </span>
        ) : (
          <span className="text-sm text-primary/30">—</span>
        )}
      </td>
      <td className="px-5 py-3">
        <Badge tone={user.role === 'ADMIN' ? 'info' : 'neutral'}>
          {user.role === 'ADMIN' ? 'Admin' : 'Citizen'}
        </Badge>
      </td>
      <td className="px-5 py-3">
        {user.isWorker ? (
          <div className="space-y-1.5">
            <Badge tone="success">Worker</Badge>
            <div className="flex items-center gap-1">
              <input
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="lat"
                title="Latitude"
                className="input-field h-7 w-16 px-1.5 text-[11px]"
              />
              <input
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="lng"
                title="Longitude"
                className="input-field h-7 w-16 px-1.5 text-[11px]"
              />
              <button className={iconBtn} onClick={saveCoords} title="Save coordinates" disabled={busy}>
                <FaMapMarkerAlt />
              </button>
            </div>
          </div>
        ) : (
          <span className="text-sm text-primary/30">—</span>
        )}
      </td>
      <td className="px-5 py-3 text-sm font-bold text-primary">{user.reportCount}</td>
      <td className="px-5 py-3">
        <Badge tone={user.isActive ? 'success' : 'danger'}>{user.isActive ? 'Active' : 'Inactive'}</Badge>
      </td>
      <td className="px-5 py-3 text-xs font-medium text-primary/60">{formatDate(user.createdAt)}</td>
      <td className="px-5 py-3">
        <div className="flex items-center justify-end gap-1.5">
          <button className={iconBtn} onClick={onWorker} title={user.isWorker ? 'Remove worker role' : 'Mark as worker'} disabled={busy}>
            <FaHardHat />
          </button>
          <button
            className={iconBtn}
            onClick={onRole}
            title={user.role === 'ADMIN' ? 'Demote to citizen' : 'Promote to admin'}
            disabled={busy}
          >
            <FaUserShield />
          </button>
          {user.isActive ? (
            <button
              className={`${iconBtn} ${arming ? '!bg-danger !text-white !border-danger' : ''}`}
              onClick={onDeactivate}
              title={arming ? 'Click again to confirm' : 'Deactivate user'}
              disabled={busy}
            >
              <FaUserSlash />
            </button>
          ) : (
            <button className={iconBtn} onClick={onDeactivate} title="Activate user" disabled={busy}>
              <FaUserCheck />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
