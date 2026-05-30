import { Routes } from '@angular/router';
import { MainLayout } from './layouts/main-layout/main-layout';
import { Canvas } from './features/canvas/canvas';
import { AuthLayout } from './layouts/auth-layout/auth-layout';
import { Roadmap } from './features/roadmap/roadmap';
import { Admin } from './features/admin/admin';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';


export const routes: Routes = [
    {
        path: '',
        component: MainLayout,
        canActivate: [authGuard],
        children: [
            { path: 'canvas', component: Canvas },
            { path: 'roadmap', component: Roadmap },
            { path: 'admin', component: Admin, canActivate: [adminGuard] },
        ]
    },
    {
        path: '',
        component: AuthLayout,
        children: [
            { path: 'login', component: Login },
            { path: 'register', component: Register },
        ]
    },
    { path: '', redirectTo: '/canvas', pathMatch: 'full' },
    { path: '**', redirectTo: '/canvas' }
];
