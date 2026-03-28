import { Button, Card, FieldLabel, Input, Pill } from "./ui";

type AccountDialogProps = {
  open: boolean;
  user?: {
    name: string;
    email: string;
    role: "ORGANIZER" | "STAFF" | "ATTENDEE";
  } | null;
  profileName: string;
  profileEmail: string;
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
  profileMessage: { tone: "success" | "error"; text: string } | null;
  passwordMessage: { tone: "success" | "error"; text: string } | null;
  isProfileSubmitting: boolean;
  isPasswordSubmitting: boolean;
  onProfileNameChange: (value: string) => void;
  onProfileEmailChange: (value: string) => void;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmNewPasswordChange: (value: string) => void;
  onProfileSubmit: () => void;
  onPasswordSubmit: () => void;
  onClose: () => void;
};

export function AccountDialog({
  open,
  user,
  profileName,
  profileEmail,
  currentPassword,
  newPassword,
  confirmNewPassword,
  profileMessage,
  passwordMessage,
  isProfileSubmitting,
  isPasswordSubmitting,
  onProfileNameChange,
  onProfileEmailChange,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmNewPasswordChange,
  onProfileSubmit,
  onPasswordSubmit,
  onClose,
}: AccountDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div className="w-full max-w-2xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Account settings">
        <Card
          className="rounded-3xl border border-slate-200 bg-white shadow-2xl"
          title="Account"
          subtitle="Update your account details."
          headerRight={<Pill tone="brand">{user?.role ?? "UNKNOWN"}</Pill>}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Profile</h3>
                  <p className="mt-1 text-sm text-slate-600">Name and sign-in email.</p>
                </div>
                <Pill tone="slate">{user?.role ?? "UNKNOWN"}</Pill>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <FieldLabel>Name</FieldLabel>
                  <Input
                    placeholder="Full name"
                    value={profileName}
                    onChange={(event) => onProfileNameChange(event.target.value)}
                  />
                </div>

                <div>
                  <FieldLabel>Email</FieldLabel>
                  <Input
                    type="email"
                    placeholder="name@utoronto.ca"
                    value={profileEmail}
                    onChange={(event) => onProfileEmailChange(event.target.value)}
                  />
                </div>
              </div>

              {profileMessage ? (
                <div
                  className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                    profileMessage.tone === "error"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {profileMessage.text}
                </div>
              ) : null}

              <div className="mt-4 flex justify-end">
                <Button onClick={onProfileSubmit} disabled={isProfileSubmitting}>
                  {isProfileSubmitting ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Password</h3>
                <p className="mt-1 text-sm text-slate-600">Change your password.</p>
              </div>

              <div className="mt-4 grid gap-3">
                <div>
                  <FieldLabel>Current Password</FieldLabel>
                  <Input
                    type="password"
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={(event) => onCurrentPasswordChange(event.target.value)}
                  />
                </div>

                <div>
                  <FieldLabel>New Password</FieldLabel>
                  <Input
                    type="password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(event) => onNewPasswordChange(event.target.value)}
                  />
                </div>

                <div>
                  <FieldLabel>Confirm New Password</FieldLabel>
                  <Input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmNewPassword}
                    onChange={(event) => onConfirmNewPasswordChange(event.target.value)}
                  />
                </div>
              </div>

              {passwordMessage ? (
                <div
                  className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                    passwordMessage.tone === "error"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {passwordMessage.text}
                </div>
              ) : null}

              <div className="mt-4 flex justify-end">
                <Button onClick={onPasswordSubmit} disabled={isPasswordSubmitting}>
                  {isPasswordSubmitting ? "Updating..." : "Change Password"}
                </Button>
              </div>
            </section>
          </div>

          <div className="mt-5 flex justify-end">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
