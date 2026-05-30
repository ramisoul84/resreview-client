import { inject, Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";
import { HttpClient } from "@angular/common/http";
import { Version } from "../models/version";
import { Observable } from "rxjs";

@Injectable({
    providedIn: "root",
})
export class VersionService {
    private baseUrl = `${environment.apiUrl}/products`;

    http = inject(HttpClient);

    getVersions(productId: string): Observable<Version[]> {
        return this.http.get<Version[]>(`${this.baseUrl}/${productId}/versions`);
    }

    createVersion(productId: string, label: string, name: string): Observable<Version> {
        return this.http.post<Version>(`${this.baseUrl}/${productId}/versions`, { label, name });
    }

    updateVersion(productId: string, versionId: string, label: string, name: string): Observable<{ message: string }> {
        return this.http.put<{ message: string }>(`${this.baseUrl}/${productId}/versions/${versionId}`, { label, name });
    }

    deleteVersion(productId: string, versionId: string): Observable<{ message: string }> {
        return this.http.delete<{ message: string }>(`${this.baseUrl}/${productId}/versions/${versionId}`);
    }

    uploadImage(productId: string, versionId: string, file: File): Observable<Version> {
        const formData = new FormData();
        formData.append("image", file);
        return this.http.post<Version>(
            `${this.baseUrl}/${productId}/versions/${versionId}/upload`,
            formData
        );
    }
}
