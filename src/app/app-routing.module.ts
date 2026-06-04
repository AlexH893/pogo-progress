import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';

import { LogbookComponent } from './logbook/logbook.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'logbook', component: LogbookComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
