import AuthShell from "@/components/auth/AuthShell";
import { AuthHeader, BackHomeLink } from "@/components/auth/AuthParts";
import SignInForm from "@/components/auth/SignInForm";
import { SIGNIN_ASIDE } from "@/components/auth/asides";

export default function SignInPage() {
  return (
    <AuthShell aside={SIGNIN_ASIDE}>
      <AuthHeader
        eyebrow="Giriş"
        title={
          <>
            Tekrar <em>hoş geldiniz.</em>
          </>
        }
        desc="Yönetim panelinize giriş yapın."
      />
      <SignInForm />
      <BackHomeLink />
    </AuthShell>
  );
}
