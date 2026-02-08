import type { EntityEntry } from "@/lib/types";

export interface Props {
  entities: EntityEntry[];
  onEntityClick?: (entityId: string) => void;
}

/**
 * Grid of entity cards for selecting which budget entity to explore.
 * Active entities are clickable, coming soon entities are grayed out.
 */
export default function EntityPicker({ entities, onEntityClick }: Props) {
  const handleClick = (entity: EntityEntry) => {
    if (entity.status === "active" && onEntityClick) {
      onEntityClick(entity.id);
    } else if (entity.status === "active") {
      // Navigate using standard anchor behavior
      window.location.href = `/entity/${entity.id}`;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {entities.map((entity) => {
        const isActive = entity.status === "active";
        const isComingSoon = entity.status === "coming_soon";

        return (
          <div
            key={entity.id}
            onClick={() => handleClick(entity)}
            className={`
              relative p-6 rounded-lg border-2 transition-all
              ${isActive
                ? "border-blue-500 cursor-pointer hover:shadow-lg hover:-translate-y-1"
                : "border-gray-300 opacity-60 cursor-not-allowed"
              }
            `}
            role={isActive ? "button" : undefined}
            tabIndex={isActive ? 0 : undefined}
            onKeyDown={(e) => {
              if (isActive && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                handleClick(entity);
              }
            }}
          >
            {/* Color indicator */}
            <div
              className="absolute top-4 right-4 w-3 h-3 rounded-full"
              style={{ backgroundColor: entity.color }}
              aria-hidden="true"
            />

            {/* Entity name */}
            <h3 className="text-xl font-bold mb-2">{entity.name}</h3>

            {/* Entity type */}
            <p className="text-sm text-gray-600 mb-3 capitalize">
              {entity.entity_type.replace(/_/g, " ")}
            </p>

            {/* Property tax share */}
            <div className="mb-3">
              <span className="text-2xl font-bold text-blue-600">
                {entity.property_tax_share_pct.toFixed(1)}%
              </span>
              <p className="text-xs text-gray-500">of property tax bill</p>
            </div>

            {/* Available years */}
            {isActive && (
              <div className="text-sm text-gray-600">
                {entity.available_years.length} year
                {entity.available_years.length !== 1 ? "s" : ""} available
              </div>
            )}

            {/* Coming soon badge */}
            {isComingSoon && (
              <div className="mt-3">
                <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                  Coming Soon
                </span>
              </div>
            )}

            {/* Active indicator */}
            {isActive && (
              <div className="mt-3 text-sm text-blue-600 font-semibold">
                Explore →
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
