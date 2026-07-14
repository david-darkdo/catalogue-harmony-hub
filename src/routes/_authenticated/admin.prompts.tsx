import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/prompts")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/ai-templates" });
  },
  component: () => null,
});
