import { AuthForm } from "@/components/auth-form";

type SignUpPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { next } = await searchParams;

  return (
    <main className="shell flex flex-1 items-center justify-center px-6 py-12">
      <AuthForm mode="sign-up" nextPath={next} />
    </main>
  );
}
