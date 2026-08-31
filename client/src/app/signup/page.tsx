import AuthShell from "@/components/auth/AuthShell";
import SignupForm from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Start chatting with your PDFs in seconds."
    >
      <SignupForm />
    </AuthShell>
  );
}