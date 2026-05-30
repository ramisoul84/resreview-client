import { inject, Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";
import { HttpClient } from "@angular/common/http";
import { Annotation } from "../models/annotation";
import { Observable } from "rxjs";

@Injectable({
    providedIn: "root",
})
export class AnnotationService {
    private baseUrl = `${environment.apiUrl}/products`;

    http = inject(HttpClient);

    getAnnotations(productId: string, versionId: string): Observable<Annotation[]> {
        return this.http.get<Annotation[]>(`${this.baseUrl}/${productId}/versions/${versionId}/annotations`);
    }

    createAnnotation(productId: string, versionId: string, data: Partial<Annotation>): Observable<Annotation> {
        return this.http.post<Annotation>(`${this.baseUrl}/${productId}/versions/${versionId}/annotations`, data);
    }

    updateAnnotation(productId: string, versionId: string, annotationId: string, data: Partial<Annotation>): Observable<{ message: string }> {
        return this.http.put<{ message: string }>(`${this.baseUrl}/${productId}/versions/${versionId}/annotations/${annotationId}`, data);
    }

    deleteAnnotation(productId: string, versionId: string, annotationId: string): Observable<{ message: string }> {
        return this.http.delete<{ message: string }>(`${this.baseUrl}/${productId}/versions/${versionId}/annotations/${annotationId}`);
    }
}
