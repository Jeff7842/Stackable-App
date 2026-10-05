import { Button, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-screen max-w-xl place-items-center bg-canvas px-4 text-ink">
      <EmptyState
        icon="solar:map-point-wave-linear"
        title="We could not find that page"
        description="The link may be old or mistyped."
        action={
          <Button as="a" href="/">
            Go home
          </Button>
        }
      />
    </main>
  );
}
