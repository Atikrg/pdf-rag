import AuthShell from "@/components/auth/AuthShell";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email on your account and we'll send you a link to choose a new password."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
