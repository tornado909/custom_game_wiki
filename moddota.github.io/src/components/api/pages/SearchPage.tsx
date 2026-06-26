import React, { useMemo, useState, useEffect } from "react";
import { fuzzyMatch } from "../../../utils/fuzzySearch";
import { ScrollableList } from "../Lists";
import { SearchBox, getSearchFromUrl, subscribeToSearchChange } from "../Search";
import { NavBar } from "../layout/NavBar";
import { allAbilities, AbilityItem } from "./AbilitiesPage";
import { allModifiers, renderItem as renderModifierItem } from "./ModifiersPage";

type SourceKey = "ability" | "modifier";

interface SourceMeta {
  label: string;
  color: string;
}

const SOURCES: Record<SourceKey, SourceMeta> = {
  ability: { label: "Ability", color: "#d97706" },
  modifier: { label: "Modifier", color: "#10b981" },
};

const SOURCE_KEYS = Object.keys(SOURCES) as SourceKey[];

type Entry =
  | { source: "ability"; name: string; kind: "ability"; ability: (typeof allAbilities)[number] }
  | { source: "modifier"; name: string; kind: "modifier"; modifier: { name: string; category: string } };

const ENTRIES: Entry[] = (() => {
  const out: Entry[] = [];
  for (const ability of allAbilities) {
    out.push({ source: "ability", name: ability.name, kind: "ability", ability });
  }
  for (const modifier of allModifiers) {
    out.push({ source: "modifier", name: modifier.name, kind: "modifier", modifier });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
})();

const COUNTS: Record<SourceKey, number> = (() => {
  const counts = Object.fromEntries(SOURCE_KEYS.map((key) => [key, 0])) as Record<SourceKey, number>;
  for (const entry of ENTRIES) counts[entry.source] += 1;
  return counts;
})();

const BY_SOURCE: Record<SourceKey, Entry[]> = (() => {
  const grouped = Object.fromEntries(SOURCE_KEYS.map((key) => [key, [] as Entry[]])) as Record<
    SourceKey,
    Entry[]
  >;
  for (const entry of ENTRIES) grouped[entry.source].push(entry);
  return grouped;
})();

const INTERLEAVED: Entry[] = (() => {
  const out: Entry[] = [];
  const lists = SOURCE_KEYS.map((key) => BY_SOURCE[key]);
  const max = Math.max(...lists.map((list) => list.length));
  for (let i = 0; i < max; i++) {
    for (const list of lists) {
      if (i < list.length) out.push(list[i]);
    }
  }
  return out;
})();

const MAX_RESULTS = 200;

function fuzzyFilter(pool: Entry[], query: string): Entry[] {
  const scored: { entry: Entry; score: number }[] = [];
  for (const entry of pool) {
    const score = fuzzyMatch(entry.name, query);
    if (isFinite(score)) scored.push({ entry, score });
  }
  scored.sort((a, b) => a.score - b.score || a.entry.name.localeCompare(b.entry.name));
  return scored.map((item) => item.entry);
}

function renderEntry(entry: Entry): React.ReactNode {
  if (entry.kind === "ability") return <AbilityItem ability={entry.ability} />;
  return renderModifierItem(entry.modifier);
}

export function SearchPage() {
  const [search, setSearch] = useState(() => getSearchFromUrl());
  const [selected, setSelected] = useState<SourceKey | null>(null);

  useEffect(() => subscribeToSearchChange(() => setSearch(getSearchFromUrl())), []);

  const allResults = useMemo(() => {
    const query = search.trim();
    if (selected) return query ? fuzzyFilter(BY_SOURCE[selected], query) : BY_SOURCE[selected];
    return query ? fuzzyFilter(ENTRIES, query) : INTERLEAVED;
  }, [search, selected]);

  const results = allResults.slice(0, MAX_RESULTS);

  const renderRow = (entry: Entry) => {
    const meta = SOURCES[entry.source];
    return (
      <div
        key={`${entry.source}-${entry.name}`}
        style={{ display: "flex", alignItems: "stretch", gap: 8, padding: "3px 6px" }}
      >
        <span style={{ flexShrink: 0, width: 3, borderRadius: 2, background: meta.color }} />
        <div style={{ flex: 1, minWidth: 0 }}>{renderEntry(entry)}</div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        .search-source-row:hover { filter: brightness(1.05); }
        @media (max-width: 1100px) { .api-sidebar { width: 200px !important; } }
        @media (max-width: 768px) {
          .api-sidebar { width: 100% !important; max-height: 38vh; border-bottom: 1px solid var(--color-group-border); }
          .api-page-content { flex-direction: column; }
        }
      `}</style>
      <NavBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }} className="api-page-content">
        <div style={{ width: 260, height: "100%", overflowY: "auto", padding: "2px 12px" }} className="api-sidebar">
          <SourceRow
            label="All types"
            color="var(--color-highlight)"
            count={ENTRIES.length}
            active={selected === null}
            onClick={() => setSelected(null)}
          />
          <div style={{ borderTop: "1px solid var(--color-group-border)", margin: "6px 0" }} />
          {SOURCE_KEYS.map((key) => (
            <SourceRow
              key={key}
              label={SOURCES[key].label}
              color={SOURCES[key].color}
              count={COUNTS[key]}
              active={selected === key}
              onClick={() => setSelected(key)}
            />
          ))}
        </div>

        <main style={{ flex: 1, display: "flex", flexFlow: "column", minHeight: 0, overflowY: "auto", padding: "0 0 0 12px" }}>
          <SearchBox baseUrl="/search" />
          <div style={{ fontSize: 12, color: "var(--color-text-faded, #999)", padding: "2px 8px 4px 8px" }}>
            {allResults.length} result{allResults.length === 1 ? "" : "s"}
            {allResults.length > MAX_RESULTS && ` — showing first ${MAX_RESULTS}, refine your search`}
          </div>
          {results.length > 0 ? (
            <ScrollableList data={results} render={renderRow} />
          ) : (
            <div style={{ marginTop: 60, textAlign: "center", fontSize: 28, color: "var(--color-text-faded)" }}>
              No results found
            </div>
          )}
        </main>
      </div>
    </>
  );
}

function SourceRow({
  label,
  color,
  count,
  active,
  onClick,
}: {
  label: string;
  color: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="search-source-row"
      style={{
        width: "100%",
        textAlign: "left",
        background: active ? "var(--color-sidebar-hover)" : "var(--color-sidebar)",
        borderBottom: active ? `3px solid ${color}` : "3px solid transparent",
        border: "none",
        borderRadius: 3,
        padding: "4px 6px",
        cursor: "pointer",
        color: "var(--color-text)",
        fontWeight: active ? 600 : "normal",
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        marginBottom: 3,
      }}
    >
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {label}
      <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-text-faded)", fontWeight: "normal" }}>
        {count}
      </span>
    </button>
  );
}
