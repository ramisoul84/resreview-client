import { inject, Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";
import { HttpClient } from "@angular/common/http";
import { Product } from "../models/product";
import { Observable } from "rxjs";

@Injectable({
    providedIn: "root",
})
export class ProductService {
    private readonly API_URL = `${environment.apiUrl}/products`;
    http = inject(HttpClient);

    getProducts(): Observable<Product[]> {
        return this.http.get<Product[]>(`${this.API_URL}`);
    }

    createProduct(name: string): Observable<Product> {
        return this.http.post<Product>(`${this.API_URL}`, { name });
    }

    updateProduct(productId: string, name: string): Observable<{ message: string }> {
        return this.http.put<{ message: string }>(`${this.API_URL}/${productId}`, { name });
    }

    deleteProduct(productId: string): Observable<{ message: string }> {
        return this.http.delete<{ message: string }>(`${this.API_URL}/${productId}`);
    }
}
