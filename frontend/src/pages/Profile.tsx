import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import {
  FaCalendarAlt,
  FaClipboardList,
  FaEnvelope,
  FaEdit,
  FaKey,
  FaTrashAlt,
  FaUser,
  FaUserEdit,
  FaCamera,
} from "react-icons/fa";
import { useAuth } from "../features/auth/auth-context";
import { authApi } from "../api/auth";
import { reportsApi } from "../api/reports";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { TextInput } from "../components/ui/Field";
import { useToast } from "../components/ui/Toast";
import { formatDate } from "../lib/format";
import { passwordRule } from "../lib/validators";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  phone: z.string().trim().max(20, "Phone is too long").optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

export function Profile() {
  const { user, updateStoredUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<"account" | "edit" | "reports">(
    "account",
  );
  const dashboardPath =
    user?.role === "ADMIN" ? "/admin/dashboard" : "/dashboard";

  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ["user", "reports", "profile"],
    queryFn: () => reportsApi.mine({ page: 1, limit: 6 }),
    enabled: activeTab === "reports",
  });

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? "", phone: user?.phone ?? "" },
  });

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  function openAvatarPicker() {
    avatarInputRef.current?.click();
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
  }

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
  });

  async function saveProfile(values: ProfileValues) {
    try {
      const res = await authApi.updateProfile({
        name: values.name,
        phone: values.phone || null,
      });
      updateStoredUser(res.user);
      profileForm.reset({ name: res.user.name, phone: res.user.phone ?? "" });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update profile",
      );
    }
  }

  async function changePassword(values: PasswordValues) {
    try {
      await authApi.updateProfile({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      passwordForm.reset();
      toast.success("Password changed");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not change password",
      );
    }
  }

  async function deleteAccount() {
    if (!user || deleteEmail !== user.email) return;
    setDeleting(true);
    try {
      await authApi.deleteAccount();
      toast.success("Account deactivated. Goodbye for now.");
      setDeleting(false);
      await logout();
      navigate("/");
    } catch (err) {
      setDeleting(false);
      toast.error(
        err instanceof Error ? err.message : "Could not delete your account",
      );
    }
  }

  if (!user) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-primary">
          Account settings
        </h1>
        <p className="mt-1 text-sm text-primary/60">
          Manage your profile details, sign-in credentials, and report history.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary text-xl font-bold text-white">
                {user.name.trim()[0]?.toUpperCase() ?? "?"}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-extrabold text-primary">
                  {user.name}
                </p>
                <Badge
                  tone={user.role === "ADMIN" ? "info" : "neutral"}
                  className="mt-1"
                >
                  {user.role === "ADMIN" ? "Administrator" : "Citizen"}
                </Badge>
              </div>
            </div>

            <div className="mt-6 space-y-3 border-t border-primary/5 pt-5">
              <p className="flex items-center gap-3 text-sm text-primary/70">
                <FaEnvelope className="shrink-0 text-primary/40" />
                <span className="truncate">{user.email}</span>
              </p>
              <p className="flex items-center gap-3 text-sm text-primary/70">
                <FaCalendarAlt className="shrink-0 text-primary/40" />
                Member since {formatDate(user.createdAt)}
              </p>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="relative">
                <div className="grid h-20 w-20 place-items-center rounded-full bg-primary text-3xl text-white overflow-hidden">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="avatar"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl">
                      {user.name.trim()[0]?.toUpperCase() ?? "?"}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={openAvatarPicker}
                  aria-label="Change avatar"
                  className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border border-white bg-white text-primary shadow-md"
                >
                  <FaCamera />
                </button>
              </div>
              <p className="text-sm font-semibold text-primary">{user.name}</p>
              <div className="grid w-full grid-cols-3 gap-2">
                {(
                  [
                    { key: "account", label: "Account", icon: <FaUser /> },
                    { key: "edit", label: "Edit", icon: <FaEdit /> },
                    {
                      key: "reports",
                      label: "Reports",
                      icon: <FaClipboardList />,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    aria-label={tab.label}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex h-12 items-center justify-center rounded-2xl border text-lg transition ${
                      activeTab === tab.key
                        ? "border-primary bg-primary text-white shadow-card"
                        : "border-primary/10 text-primary/70 hover:border-primary/20 hover:bg-primary/5 hover:text-primary"
                    }`}
                  >
                    {tab.icon}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={logout}
                className="mt-2 w-full rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger transition hover:bg-danger/20"
              >
                Logout
              </button>
              <input
                ref={avatarInputRef}
                onChange={handleAvatarChange}
                accept="image/*"
                type="file"
                className="hidden"
              />
            </div>
          </Card>
        </aside>

        <div className="space-y-6">
          {activeTab === "account" && (
            <Card className="p-6">
              <div className="flex items-center justify-between gap-6">
                <div>
                  <h2 className="text-lg font-bold text-primary">
                    Account overview
                  </h2>
                  <p className="mt-1 text-sm text-primary/60">
                    Your personal details and account information are stored
                    securely.
                  </p>
                </div>
                <Badge tone="info">
                  {user.role === "ADMIN" ? "Admin" : "Citizen"}
                </Badge>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div className="rounded-2xl border border-primary/5 bg-primary/5 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary/50">
                    Name
                  </p>
                  <p className="mt-2 text-sm font-semibold text-primary">
                    {user.name}
                  </p>
                </div>
                <div className="rounded-2xl border border-primary/5 bg-primary/5 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary/50">
                    Email
                  </p>
                  <p className="mt-2 text-sm font-semibold text-primary">
                    {user.email}
                  </p>
                </div>
                <div className="rounded-2xl border border-primary/5 bg-primary/5 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary/50">
                    Phone
                  </p>
                  <p className="mt-2 text-sm font-semibold text-primary">
                    {user.phone ?? "Not set"}
                  </p>
                </div>
                <div className="rounded-2xl border border-primary/5 bg-primary/5 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary/50">
                    Member since
                  </p>
                  <p className="mt-2 text-sm font-semibold text-primary">
                    {formatDate(user.createdAt)}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {activeTab === "edit" && (
            <>
              <Card className="p-6">
                <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
                  <FaUserEdit className="text-accent" /> Profile details
                </h2>
                <p className="mt-1 text-sm text-primary/60">
                  Your name appears on reports and receipts.
                </p>
                <div className="mt-4 flex items-center gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-full bg-primary">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="avatar preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-white text-xl">
                        {user.name.trim()[0]?.toUpperCase() ?? "?"}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-primary/70">Profile photo</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={openAvatarPicker}
                        className="rounded-md bg-accent px-3 py-1 text-sm font-semibold text-white"
                      >
                        Choose photo
                      </button>
                      {avatarPreview && (
                        <button
                          type="button"
                          onClick={() => {
                            setAvatarPreview(null);
                            setAvatarFile(null);
                          }}
                          className="rounded-md border px-3 py-1 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <form
                  onSubmit={profileForm.handleSubmit(saveProfile)}
                  className="mt-5 space-y-4"
                  noValidate
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="p-name" className="label-field">
                        Full name
                      </label>
                      <TextInput
                        id="p-name"
                        autoComplete="name"
                        placeholder="Jane Citizen"
                        {...profileForm.register("name")}
                      />
                      {profileForm.formState.errors.name && (
                        <p className="mt-1 text-xs text-danger">
                          {profileForm.formState.errors.name.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="p-phone" className="label-field">
                        Phone
                      </label>
                      <TextInput
                        id="p-phone"
                        autoComplete="tel"
                        placeholder="+977 98…"
                        {...profileForm.register("phone")}
                      />
                      {profileForm.formState.errors.phone && (
                        <p className="mt-1 text-xs text-danger">
                          {profileForm.formState.errors.phone.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    type="submit"
                    loading={profileForm.formState.isSubmitting}
                  >
                    Save changes
                  </Button>
                </form>
              </Card>

              <Card className="p-6">
                <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
                  <FaKey className="text-accent" /> Change password
                </h2>
                <p className="mt-1 text-sm text-primary/60">
                  Use at least 8 characters with upper/lowercase, a number and a
                  symbol.
                </p>
                <form
                  onSubmit={passwordForm.handleSubmit(changePassword)}
                  className="mt-5 space-y-4"
                  noValidate
                >
                  <div>
                    <label htmlFor="p-current" className="label-field">
                      Current password
                    </label>
                    <TextInput
                      id="p-current"
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      {...passwordForm.register("currentPassword")}
                    />
                    {passwordForm.formState.errors.currentPassword && (
                      <p className="mt-1 text-xs text-danger">
                        {passwordForm.formState.errors.currentPassword.message}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="p-new" className="label-field">
                        New password
                      </label>
                      <TextInput
                        id="p-new"
                        type="password"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        {...passwordForm.register("newPassword")}
                      />
                      {passwordForm.formState.errors.newPassword && (
                        <p className="mt-1 text-xs text-danger">
                          {passwordForm.formState.errors.newPassword.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="p-confirm" className="label-field">
                        Confirm new password
                      </label>
                      <TextInput
                        id="p-confirm"
                        type="password"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        {...passwordForm.register("confirmPassword")}
                      />
                      {passwordForm.formState.errors.confirmPassword && (
                        <p className="mt-1 text-xs text-danger">
                          {
                            passwordForm.formState.errors.confirmPassword
                              .message
                          }
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    type="submit"
                    loading={passwordForm.formState.isSubmitting}
                  >
                    Update password
                  </Button>
                </form>
              </Card>

              <Card className="border-danger/20 p-6">
                <h2 className="flex items-center gap-2 text-lg font-bold text-danger">
                  <FaTrashAlt /> Danger zone
                </h2>
                <p className="mt-1 text-sm text-primary/60">
                  Deactivating your account removes your sign-in access
                  permanently. Your submitted reports and history are kept on
                  record for government reference.
                </p>
                {!confirmingDelete ? (
                  <Button
                    type="button"
                    variant="danger"
                    className="mt-5"
                    onClick={() => setConfirmingDelete(true)}
                  >
                    Delete my account
                  </Button>
                ) : (
                  <div className="mt-5 space-y-4">
                    <div>
                      <label htmlFor="p-delete-email" className="label-field">
                        Type{" "}
                        <span className="font-semibold text-primary">
                          {user.email}
                        </span>{" "}
                        to confirm
                      </label>
                      <TextInput
                        id="p-delete-email"
                        type="email"
                        autoComplete="off"
                        placeholder={user.email}
                        value={deleteEmail}
                        onChange={(e) => setDeleteEmail(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        variant="danger"
                        loading={deleting}
                        disabled={deleteEmail !== user.email}
                        onClick={deleteAccount}
                      >
                        Yes, deactivate my account
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={deleting}
                        onClick={() => {
                          setConfirmingDelete(false);
                          setDeleteEmail("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </>
          )}

          {activeTab === "reports" && (
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-primary">My reports</h2>
                  <p className="mt-1 text-sm text-primary/60">
                    Review the latest reports you submitted to the municipality.
                  </p>
                </div>
                <Badge tone="info">
                  {reportsData?.pagination.total ?? 0} reports
                </Badge>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-primary/10 bg-primary/5 px-4 py-3 text-sm text-primary/70">
                <p>
                  Signed in as{" "}
                  <span className="font-semibold text-primary">
                    {user.name}
                  </span>
                </p>
                <Link
                  to={dashboardPath}
                  className="rounded-lg border border-primary/15 bg-white px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/5"
                >
                  Go to dashboard
                </Link>
              </div>

              <div className="mt-6 space-y-4">
                {reportsLoading ? (
                  <p className="text-sm text-primary/60">Loading reports…</p>
                ) : reportsData?.reports.length ? (
                  reportsData.reports.map((report) => (
                    <div
                      key={report.id}
                      className="rounded-3xl border border-primary/5 bg-primary/5 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-primary">
                            {report.title}
                          </p>
                          <p className="mt-1 text-xs text-primary/60">
                            {report.roadName} · {report.municipality} · Ward{" "}
                            {report.ward}
                          </p>
                        </div>
                        <Badge
                          tone={
                            report.status === "COMPLETED"
                              ? "success"
                              : report.status === "PENDING"
                                ? "warning"
                                : "info"
                          }
                        >
                          {report.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-primary/5 bg-primary/5 p-6 text-center">
                    <p className="text-sm font-semibold text-primary/70">
                      No reports found.
                    </p>
                    <p className="mt-1 text-xs text-primary/50">
                      Submit a new report from the dashboard to see it here.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </motion.div>
  );
}
