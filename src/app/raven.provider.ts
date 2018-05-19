import { ErrorHandler } from '@angular/core';
import * as Raven from 'raven-js';
import { environment } from '../environments/environment';

Raven.config(
  'https://1023a2049bd0415ca4a6fc3d7272ca27@sentry.io/1209827'
).install();

export class RavenErrorHandler implements ErrorHandler {
  handleError(err: any): void {
    console.error('ERR', err);
    if (environment.production) {
      Raven.captureException(err);
    }
  }
}

export const RavenProvider = {
  provide: ErrorHandler,
  useClass: RavenErrorHandler
};
