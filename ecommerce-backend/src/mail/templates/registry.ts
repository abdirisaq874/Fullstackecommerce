import type { ComponentType } from 'react';

/** Every email template takes a single `data` prop (rendered server-side). */
export interface EmailTemplateProps {
  data: Record<string, any>;
}

export type EmailTemplateComponent = ComponentType<EmailTemplateProps>;

/**
 * Static template registry — maps template name → React component. A static map
 * (not dynamic import-by-path) so the compiled/bundled build always resolves
 * templates. Populated in the templates barrel; kept here to break the import
 * cycle (renderer → registry ← templates).
 */
export const EMAIL_TEMPLATES: Record<string, EmailTemplateComponent> = {};

export function registerTemplates(entries: Record<string, EmailTemplateComponent>): void {
  Object.assign(EMAIL_TEMPLATES, entries);
}
