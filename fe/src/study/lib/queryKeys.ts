export const studyKeys = {
  dashboard: ["study", "dashboard"] as const,
  list: (listId: string) => ["study", "list", listId] as const,
  manageLists: ["study", "manage", "lists"] as const,
};
