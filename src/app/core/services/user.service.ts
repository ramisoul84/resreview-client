import { inject, Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";
import { HttpClient } from "@angular/common/http";
import { User } from "../models/user";

@Injectable({
    providedIn: "root",
})
export class UserService {
    private readonly API_URL = `${environment.apiUrl}/users`;
    http = inject(HttpClient);

    getUsers() {
        return this.http.get<User[]>(`${this.API_URL}`);
    }

    updateRole(userId: string, isAdmin: boolean) {
        return this.http.patch(`${this.API_URL}/${userId}/role`, { isAdmin });
    }

    updateProfile(userId: string, data: { name: string; color: string }) {
        return this.http.patch(`${this.API_URL}/profile`, data);
    }
}
