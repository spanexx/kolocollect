import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { ContributeFormComponent } from './components/contribute-form/contribute-form.component';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes), 
    provideHttpClient(),
    { provide: ContributeFormComponent, useClass: ContributeFormComponent } 

  ],

};
