import AuthShell from "@/components/auth/AuthShell";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Choose a new password"
      subtitle="This link works once and expires an hour after it was sent."
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
