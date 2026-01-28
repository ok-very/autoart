import { Card, Stack, Text } from '@autoart/ui';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F2ED] p-4">
      <Card shadow="md" padding="lg">
        <Stack align="center" gap="md">
          <Text size="xl" weight="bold">404</Text>
          <Text color="dimmed">Poll not found</Text>
          <Text size="sm" color="muted">
            The poll you're looking for doesn't exist or has been closed.
          </Text>
        </Stack>
      </Card>
    </div>
  );
}
