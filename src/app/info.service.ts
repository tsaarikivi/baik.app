import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class InfoService {
  constructor(private snackBar: MatSnackBar) {}

  open(): void {
    if (!this.isDismissed()) {
      timer(2400)
        .pipe(
          switchMap(() => {
            return this.snackBar
              .open(
                'Your location is never saved or sent anywhere. Cookies are sent from pageviews. Have a great ride!',
                'Cool!'
              )
              .onAction();
          })
        )
        .subscribe(() => this.dismiss());
    }
  }

  private dismiss(): void {
    if (typeof Storage !== 'undefined') {
      const timestamp = new Date().getTime().toString();
      window.localStorage.setItem('infoMessage', timestamp);
    }
  }

  private isDismissed(): boolean {
    if (typeof Storage !== 'undefined') {
      const dismissalValue = window.localStorage.getItem('infoMessage');
      const dismissed = !!dismissalValue;
      return dismissed;
    }
    return false;
  }
}
