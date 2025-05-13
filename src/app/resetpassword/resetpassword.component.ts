import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { EmailService } from '../services/email.service';
import { Router, ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-resetpassword',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './resetpassword.component.html',
  styleUrl: './resetpassword.component.scss',
})
export class ResetpasswordComponent {
  apiService = inject(ApiService);
  router = inject(Router);
  route = inject(ActivatedRoute);
  uid: string | null = null;
  token: string | null = null;
  message: string | null = null;
  contactData = {
    password: '',
    repeated_password: '',
  };

  passwordVisible = false;
  confirmPasswordVisible = false;

  constructor() {
    this.route.paramMap.subscribe((params) => {
      this.uid = params.get('uid');
      this.token = params.get('token');
    });
  }

  togglePasswordVisibility(field: string) {
    if (field === 'password') {
      this.passwordVisible = !this.passwordVisible;
    } else if (field === 'confirmPassword') {
      this.confirmPasswordVisible = !this.confirmPasswordVisible;
    }
  }

  async onSubmit(form: NgForm) {
    if (
      form.valid &&
      this.contactData.password === this.contactData.repeated_password &&
      this.uid &&
      this.token
    ) {
      try {
        const response = await firstValueFrom(
          this.apiService.post(
            {
              password: this.contactData.password,
            },
            `reset-password/${this.uid}/${this.token}/`
          )
        );
        setTimeout(() => this.router.navigate(['login']), 2000); 
      } catch (error: any) {
        this.message =
          error.message || 'Error when resetting the password.';
      }
    } else {
      this.message = 'Form invalid or passwords do not match.';
    }
  }
}
