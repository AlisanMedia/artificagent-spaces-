import type { PropertyCatalog } from "@/contracts/ports";
import type { Property, PropertyId, WorkspaceScope } from "@/domain/types";
import { SYNTHETIC_PROPERTIES } from "@/fixtures/properties";

/** A fixture filter, NOT authentication or a real multi-tenant security boundary. */
export class SyntheticPropertyCatalog implements PropertyCatalog {
  constructor(private readonly properties: readonly Property[] = SYNTHETIC_PROPERTIES) {}

  list(scope: WorkspaceScope): readonly Property[] {
    return this.properties.filter((property) => property.organizationId === scope.organizationId);
  }

  get(scope: WorkspaceScope, id: PropertyId): Property | undefined {
    return this.properties.find((property) => property.id === id && property.organizationId === scope.organizationId);
  }
}
