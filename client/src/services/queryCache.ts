import type { QueryClient } from "@tanstack/react-query";

export function invalidateUserQueries(
  client: QueryClient,
  userId: string | null | undefined,
  groups: readonly string[],
) {
  return client.invalidateQueries({
    predicate: ({ queryKey }) =>
      queryKey[1] === userId && groups.some((group) => group === queryKey[0]),
  });
}
