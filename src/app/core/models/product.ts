export interface Product {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
}

export interface ProductWithVersions extends Product {
  versions: import('./version').Version[];
}
