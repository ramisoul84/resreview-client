import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

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
    private router: Router
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

    // Stop here if form is invalid
    if (this.loginForm.invalid) {
      return;
    }

    this.isLoading = true;

    // Simulate API call - Replace with actual authentication service
    setTimeout(() => {
      const { email, password } = this.loginForm.value;

      // Example validation - Replace with your actual authentication logic
      if (email === 'admin@example.com' && password === 'password123') {
        // Store auth token (implement your auth service)
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userEmail', email);

        // Navigate to dashboard or home page
        this.router.navigate(['/dashboard']);
      } else {
        this.errorMessage = 'Invalid email or password. Please try again.';
        this.isLoading = false;
      }
    }, 1500);
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
