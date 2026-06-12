import { NgModule } from '@angular/core';
import { BrowserModule, provideClientHydration } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

import { AppComponent } from './app.component';
import { HomeComponent } from './home/home.component';
import { LogbookComponent } from './logbook/logbook.component';

import { FormsModule } from '@angular/forms';
import { UploadComponent } from './components/upload/upload.component';
import { DiffSummaryComponent } from './components/diff-summary/diff-summary.component';
import { StatCardComponent } from './components/stat-card/stat-card.component';
import { FunFactComponent } from './components/fun-fact/fun-fact.component';
import { ProgressChartComponent } from './components/progress-chart/progress-chart.component';
import { ToastComponent } from './components/toast/toast.component';
import { AuthHttpInterceptor } from './services/auth-http.interceptor';
import { ToastService } from './services/toast.service';

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    LogbookComponent,
    UploadComponent,
    DiffSummaryComponent,
    StatCardComponent,
    FunFactComponent,
    ProgressChartComponent,
    ToastComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthHttpInterceptor, multi: true },
    ToastService,
    provideClientHydration()
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
