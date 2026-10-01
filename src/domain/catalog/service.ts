// Catalogue read model — components/routes import from here (D-007).
import * as repo from './repo';

export const listVerifiedBrands = repo.listVerifiedBrands;
export const searchCatalogModels = repo.searchModels;
export const getCatalogModel = repo.getModelById;

export type { CatalogBrandRow, CatalogModelRow } from './types';
