import { Component } from '@angular/core';
import { ToastService, ToastMessage } from '../../services/toast.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-toast',
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.scss']
})
export class ToastComponent {
  toasts$: Observable<ToastMessage[]>;

  constructor(public toastService: ToastService) {
    this.toasts$ = this.toastService.toasts$;
  }

  removeToast(id: number): void {
    this.toastService.remove(id);
  }
}
