export const studyKeys = {
  dashboard: ["study", "dashboard"] as const,
  list: (listId: string) => ["study", "list", listId] as const,
  manageLists: ["study", "manage", "lists"] as const,
  caseSets: ["study", "cases"] as const,
  caseSet: (setId: string) => ["study", "cases", setId] as const,
  manageCaseSets: ["study", "manage", "cases"] as const,
  manageCaseSet: (setId: string) => ["study", "manage", "cases", setId] as const,
};
