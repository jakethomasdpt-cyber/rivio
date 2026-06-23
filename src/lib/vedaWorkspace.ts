export const ALLOWED_VEDA_RIVIO_ORGANIZATION_NAME = 'Physical Therapy 365';

const ALLOWED_VEDA_WORKSPACE_SLUG = 'physicaltherapy365';

export function isPhysicalTherapy365Workspace(workspaceName: string | null | undefined): boolean {
  const normalized = (workspaceName || '')
    .toLowerCase()
    .replace(/\b(llc|pllc|inc|corp|corporation|company|co)\b/g, '')
    .replace(/[^a-z0-9]/g, '');

  return normalized === ALLOWED_VEDA_WORKSPACE_SLUG;
}
