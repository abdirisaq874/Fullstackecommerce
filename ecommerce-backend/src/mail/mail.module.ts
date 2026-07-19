import { DynamicModule, Logger, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { EmailLog, EmailLogSchema } from './schemas/email-log.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { MailService } from './mail.service';
import { MailRendererService } from './mail-renderer.service';
import { StoreBrandingService } from './store-branding.service';
import { ResendAdapter } from './providers/resend.adapter';
import { NoopEmailAdapter } from './providers/noop.adapter';
import { EmailProviderAdapter } from './providers/email-provider.interface';
import { MailHandler } from './mail.handler';
import { ResendWebhookController } from './webhook/resend-webhook.controller';
import { StoresModule } from '../stores/stores.module';
import { QueuesModule } from '../shared/queues/queues.module';
import './templates'; // side-effect: register templates into EMAIL_TEMPLATES

const RESEND_KEY_RE = /^re_[A-Za-z0-9_-]+/;
const PLACEHOLDER_RE = /(dummy|placeholder|replace|changeme|unconfigured|your[-_]?key)/i;

/** Picks the transport: EMAIL_PROVIDER=noop, or resend when RESEND_API_KEY is real, else noop. */
const emailProviderFactory: Provider = {
  provide: EmailProviderAdapter,
  useFactory: (
    config: ConfigService,
    resend: ResendAdapter,
    noop: NoopEmailAdapter,
  ): EmailProviderAdapter => {
    const provider = config.get<string>('EMAIL_PROVIDER', 'resend');
    if (provider === 'noop') return noop;
    const key = config.get<string>('RESEND_API_KEY') || '';
    if (!RESEND_KEY_RE.test(key) || PLACEHOLDER_RE.test(key)) {
      Logger.warn(
        'RESEND_API_KEY missing or a placeholder → using noop email adapter (NO emails sent)',
        'MailModule',
      );
      return noop;
    }
    return resend;
  },
  inject: [ConfigService, ResendAdapter, NoopEmailAdapter],
};

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EmailLog.name, schema: EmailLogSchema },
      { name: User.name, schema: UserSchema },
    ]),
    StoresModule,
    QueuesModule,
  ],
  providers: [
    MailService,
    MailRendererService,
    StoreBrandingService,
    ResendAdapter,
    NoopEmailAdapter,
    emailProviderFactory,
  ],
  exports: [MailService, MailRendererService, StoreBrandingService, MongooseModule],
})
export class MailModule {
  /** API process: also mount the Resend delivery webhook. */
  static forApi(): DynamicModule {
    return { module: MailModule, controllers: [ResendWebhookController] };
  }

  /** Workers process: also run the mail consumer. */
  static forWorkers(): DynamicModule {
    return { module: MailModule, providers: [MailHandler] };
  }
}
