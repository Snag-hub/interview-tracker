import { AuthForm } from "@/components/auth-form";

type SignInPageProps = {
  searchParams?: { next?: string };
};

export default function SignInPage({ searchParams }: SignInPageProps) {
  const next = searchParams?.next;

  return (
    <main className="shell flex flex-1 items-center justify-center px-6 py-12">
      <AuthForm mode="sign-in" nextPath={next} />
    </main>
  );
}
