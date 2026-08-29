import { createFileRoute } from "@tanstack/react-router";
import { LoginScreen } from "@/components/login-screen";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search["redirect"] === "string" ? (search["redirect"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — NUMM National Unified Material Master" },
      {
        name: "description",
        content:
          "Secure sign-in to the National Unified Material Master (NUMM) workspace for CPSE material code standardisation and governance.",
      },
      { property: "og:title", content: "Sign in — NUMM National Unified Material Master" },
      {
        property: "og:description",
        content: "Authorised access to the NUMM material standardisation and governance workspace.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  return <LoginScreen redirect={redirect} />;
}
