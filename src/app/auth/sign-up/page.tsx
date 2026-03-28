import { AuthForm } from "@/components/auth-form";

type SignUpPageProps = {
  searchParams?: { next?: string };
};

export default function SignUpPage({ searchParams }: SignUpPageProps) {
  const next = searchParams?.next;

  return (
    <main className="shell flex flex-1 items-center justify-center px-6 py-12">
      <AuthForm mode="sign-up" nextPath={next} />
    </main>
  );
}
