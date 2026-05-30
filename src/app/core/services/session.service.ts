import { inject, Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";
import { HttpClient } from "@angular/common/http";
import { Session } from "../models/session";
import { Observable } from "rxjs";

@Injectable({
    providedIn: "root",
})
export class SessionService {
    private readonly API_URL = `${environment.apiUrl}/sessions`;
    http = inject(HttpClient);

    getSessions(): Observable<Session[]> {
        return this.http.get<Session[]>(`${this.API_URL}`);
    }

    createSession(name: string): Observable<Session> {
        return this.http.post<Session>(`${this.API_URL}`, { name });
    }
}
