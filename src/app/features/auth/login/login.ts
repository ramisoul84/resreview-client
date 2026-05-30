import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/toast/toast.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  loginForm: FormGroup;
  isLoading = false;
  submitted = false;
  showPassword = false;
  errorMessage: string = '';

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private authService:AuthService,
    private toast: ToastService,
  ) {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  ngOnInit(): void {
    this.errorMessage = '';
  }

  get f() { return this.loginForm.controls; }

  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';

    if (this.loginForm.invalid) {
      return;
    }

    this.isLoading = true;

    this.authService.login(this.loginForm.value).subscribe({
      next: (response) => {
        console.log(response);
        this.isLoading = false;
        this.router.navigate(['/canvas']);
      },
      error: (error) => {
        console.log(error);
        this.isLoading = false;
        const msg = error?.message || 'Invalid credentials';
        this.errorMessage = msg;
        this.toast.show(msg, 'error');
      }
    })

  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  // Optional: Social login methods
  loginWithGoogle(): void {
    // Implement Google OAuth
    console.log('Login with Google');
  }

  loginWithFacebook(): void {
    // Implement Facebook OAuth
    console.log('Login with Facebook');
  }
}
