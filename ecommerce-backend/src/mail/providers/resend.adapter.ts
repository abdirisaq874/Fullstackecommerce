import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
  EmailProviderAdapter,
  SendEmailParams,
  SendResult,
  PermanentEmailError,
  TransientEmailError,
} from './email-provider.interface';

function sanitizeTag(s: string): string {
  return (s || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 256);
}

const PERMANENT_ERRORS = new Set([
  'validation_error',
  'invalid_from_address',
  'invalid_to_address',
  'invalid_parameter',
  'missing_api_key',
  'invalid_api_key',
  'restricted_api_key',
]);

@Injectable()
export class ResendAdapter extends EmailProviderAdapter {
  readonly name = 'resend';
  private readonly client: Resend;

  constructor(config: ConfigService) {
    super();
    // Safe even with a bogus key — MailModule only routes here when the key is real.
    this.client = new Resend(config.get<string>('RESEND_API_KEY') || 'unconfigured');
  }

  async send(params: SendEmailParams): Promise<SendResult> {
    const { data, error } = await this.client.emails.send(
      {
        from: params.from,
        to: params.to,
        replyTo: params.replyTo,
        subject: params.subject,
        html: params.html,
        text: params.text,
        attachments: params.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
        tags: params.tags?.map((t) => ({ name: sanitizeTag(t.name), value: sanitizeTag(t.value) })),
        headers: params.headers,
      },
      params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined,
    );
    if (error) throw this.mapError(error);
    if (!data?.id) throw new TransientEmailError('Resend returned no message id');
    return { providerMessageId: data.id };
  }

  private mapError(err: { name?: string; message?: string }): Error {
    const msg = `${err.name ?? 'error'}: ${err.message ?? 'unknown'}`;
    return err.name && PERMANENT_ERRORS.has(err.name)
      ? new PermanentEmailError(msg)
      : new TransientEmailError(msg);
  }
}
