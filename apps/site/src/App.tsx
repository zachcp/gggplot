import React from "react";
import { docPages } from "./docs/pages.ts";
import type { DocPage } from "./docs/types.ts";
import { ExampleSection, Panel } from "./ExampleSection.tsx";
import { ModelInspectionSection } from "./ModelInspectionSection.tsx";
import { ChartCanvas3D } from "./ChartCanvas3D.tsx";
import { useViewportWidth } from "./hooks.ts";
import { styles } from "./styles.ts";

// Vite publishes the repository's normative architecture document as an asset,
// so the contributor reference remains reachable from the docs-site nav.
const architectureReference = new URL(
  "../../../docs/ARCHITECTURE.md",
  import.meta.url,
).href;

export function App() {
  const viewportWidth = useViewportWidth();
  const compact = viewportWidth < 820;
  // Kept as an explicit visual-gate probe: it verifies a chart failure stays
  // local while its surrounding docs/DSL/computed-data context remains usable.
  const forceChartFailure = new URLSearchParams(location.search).has(
    "forceChartFailure",
  );
  const [activeSlug, setActiveSlug] = React.useState(() =>
    docPages.some((page) => page.slug === location.hash.slice(1))
      ? location.hash.slice(1)
      : docPages[0].slug
  );
  const activePage = docPages.find((page) => page.slug === activeSlug) ??
    docPages[0];

  React.useEffect(() => {
    const onHashChange = () => {
      const slug = location.hash.slice(1);
      if (docPages.some((page) => page.slug === slug)) setActiveSlug(slug);
    };
    addEventListener("hashchange", onHashChange);
    return () => removeEventListener("hashchange", onHashChange);
  }, []);

  const openPage = (page: DocPage) => {
    setActiveSlug(page.slug);
    history.replaceState(null, "", `#${page.slug}`);
  };

  return (
    <div
      data-doc-route={activePage.slug}
      style={{ ...styles.page, ...(compact ? styles.pageCompact : {}) }}
    >
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>gggplot</h1>
          <p style={styles.lead}>
            A modular feature tour for the{" "}
            <strong>{"ggplot -> UseGPU Live"}</strong>{" "}
            pipeline: data, stats, aesthetics, RenderTree output, and live
            WebGPU rendering.
          </p>
        </div>
      </header>

      <div style={{ ...styles.shell, ...(compact ? styles.shellCompact : {}) }}>
        <nav
          style={{ ...styles.nav, ...(compact ? styles.navCompact : {}) }}
          aria-label="Feature modules"
          data-scroll-nav={compact ? "" : undefined}
        >
          <div
            style={{
              ...styles.navTitle,
              ...(compact ? styles.navTitleCompact : {}),
            }}
          >
            Feature tour
          </div>
          {docPages.map((page) => (
            <button
              key={page.slug}
              type="button"
              data-doc-route-link={page.slug}
              style={{
                ...styles.navButton,
                ...(compact ? styles.navButtonCompact : {}),
                ...(activePage.slug === page.slug
                  ? styles.navButtonActive
                  : {}),
              }}
              onClick={() => openPage(page)}
            >
              <span style={styles.navButtonTitle}>{page.title}</span>
              <span style={styles.navButtonMeta}>
                {page.examples.length}{" "}
                example{page.examples.length === 1 ? "" : "s"}
              </span>
            </button>
          ))}
          <a
            href={architectureReference}
            style={{ ...styles.navButton, ...styles.architectureLink }}
          >
            <span style={styles.navButtonTitle}>Architecture reference</span>
            <span style={styles.navButtonMeta}>contributor doc</span>
          </a>
        </nav>

        <main style={styles.content}>
          <section style={styles.pageIntro}>
            <div style={styles.kicker}>{activePage.section}</div>
            <h2 style={styles.pageTitle}>{activePage.title}</h2>
            <p style={styles.pageSummary}>{activePage.summary}</p>
          </section>

          {activePage.narrative?.map((section) => (
            <section key={section.heading} style={styles.narrative}>
              <h3 style={styles.narrativeTitle}>{section.heading}</h3>
              <p style={styles.bodyCopy}>{section.body}</p>
            </section>
          ))}

          {activePage.geomReferences?.map((reference) => (
            <section
              id={reference.constructor}
              key={reference.constructor}
              style={styles.referenceCard}
            >
              <div style={styles.referenceHeading}>
                <div>
                  <h3 style={styles.exampleTitle}>{reference.constructor}</h3>
                  <code style={styles.referenceCode}>
                    {`${reference.constructor}({ … })`}
                  </code>
                </div>
                <span style={styles.referenceBadge}>{reference.residency}</span>
              </div>
              <p style={styles.bodyCopy}>{reference.summary}</p>
              <table style={styles.referenceTable}>
                <tbody>
                  <tr>
                    <th style={styles.referenceKey}>Core geom</th>
                    <td>{reference.geom}</td>
                  </tr>
                  <tr>
                    <th style={styles.referenceKey}>Default stat</th>
                    <td>{reference.defaultStat}</td>
                  </tr>
                  <tr>
                    <th style={styles.referenceKey}>Default position</th>
                    <td>{reference.defaultPosition}</td>
                  </tr>
                  <tr>
                    <th style={styles.referenceKey}>Required aesthetics</th>
                    <td>{reference.requiredAesthetics.join(", ") || "none"}</td>
                  </tr>
                  <tr>
                    <th style={styles.referenceKey}>Optional aesthetics</th>
                    <td>{reference.optionalAesthetics.join(", ") || "none"}</td>
                  </tr>
                </tbody>
              </table>
              {Object.keys(reference.params).length > 0 && (
                <table style={styles.referenceTable}>
                  <thead>
                    <tr>
                      <th style={styles.referenceKey}>Parameter</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(reference.params).map((
                      [name, description],
                    ) => (
                      <tr key={name}>
                        <td>
                          <code>{name}</code>
                        </td>
                        <td>{description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={styles.referenceLinks}>
                Examples: {reference.exampleIds.map((id) => {
                  const page = docPages.find((candidate) =>
                    candidate.examples.some((example) => example.id === id)
                  );
                  return (
                    <a
                      key={id}
                      href={`#${page?.slug ?? "start"}`}
                      style={styles.referenceLink}
                    >
                      {id}
                    </a>
                  );
                })}
              </div>
            </section>
          ))}

          {activePage.examples.map((example, i) => (
            <ExampleSection
              key={example.id}
              index={i + 1}
              example={example}
              compact={compact}
              forceChartFailure={forceChartFailure}
            />
          ))}

          {(activePage.modelExamples ?? []).map((example) => (
            <ModelInspectionSection key={example.id} example={example} />
          ))}

          {(activePage.threeD ?? []).map((threeD) => (
            <section
              key={threeD.id}
              data-doc-example={threeD.id}
              style={styles.example}
            >
              <div style={styles.exampleHeader}>
                <div style={styles.exampleIndex}>3D</div>
                <div>
                  <h3 style={styles.exampleTitle}>{threeD.title}</h3>
                  <p style={styles.exampleDescription}>
                    {threeD.description}
                  </p>
                </div>
              </div>
              <div style={styles.detailGrid}>
                <Panel title="Lowered node">
                  <p style={styles.metaCopy}>{threeD.summary}</p>
                </Panel>
              </div>
              <section
                style={{
                  ...styles.grid,
                  ...(compact ? styles.gridCompact : {}),
                }}
              >
                <Panel title="ggplot 3D spec">
                  <pre style={styles.pre}>{threeD.dslSource}</pre>
                </Panel>
                <Panel title="live WebGPU render (3D)">
                  <ChartCanvas3D
                    spec={threeD.spec}
                    label={threeD.description}
                  />
                  <p style={styles.note}>
                    Requires a WebGPU browser. Drag to orbit, Shift-drag or
                    right-drag to pan, and scroll to zoom; Reset camera returns
                    to the initial view. Positions are data-space vec4; the
                    perspective camera projects them on the GPU.
                  </p>
                </Panel>
              </section>
              <details style={styles.details}>
                <summary style={styles.summary}>
                  Emitted UseGPU source
                </summary>
                <pre style={styles.pre}>{threeD.emitted}</pre>
              </details>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
