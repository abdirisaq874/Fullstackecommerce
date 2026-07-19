import { Injectable } from '@nestjs/common';
import { createElement } from 'react';
import { render } from '@react-email/render';
import { EMAIL_TEMPLATES } from './templates/registry';

export interface RenderedEmail {
  html: string;
  text: string;
}

@Injectable()
export class MailRendererService {
  /** Render a registered template to HTML + plaintext (one component, two passes). */
  async render(templateName: string, data: Record<string, unknown>): Promise<RenderedEmail> {
    const Component = EMAIL_TEMPLATES[templateName];
    if (!Component) {
      throw new Error(`Email template not found: "${templateName}"`);
    }
    const element = createElement(Component, { data });
    const [html, text] = await Promise.all([
      render(element, { pretty: false }),
      render(element, { plainText: true }),
    ]);
    return { html, text };
  }
}
