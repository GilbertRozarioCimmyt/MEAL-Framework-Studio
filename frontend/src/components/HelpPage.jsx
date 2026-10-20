/**
 * HelpPage — matches renderHelp() from app.html.
 */
export default function HelpPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Help / Guidance</h1>
      </div>

      <div className="stack">
        <div className="card">
          <h3>How this tool guides a project's MEAL framework</h3>
          <p className="prose" style={{ fontSize: 13.5, marginTop: 8 }}>
            Seven steps take a project from proposal to a validated Results Framework, Theory of Change,
            KPI set and Data Requirements document: <b>Project Type → Proposal Upload → Results Framework
            → Theory of Change → KPI Selection → Data Requirements → Final Review.</b>{" "}
            You can move backward at any time without losing work — everything is saved as you go.
          </p>
        </div>

        <div className="card">
          <h3>What the labels mean</h3>
          <div className="stack" style={{ marginTop: 8 }}>
            <div className="row">
              <span className="tag tag-extracted">Extracted</span>
              <span className="small">Stated explicitly in an uploaded document — the AI quotes its evidence.</span>
            </div>
            <div className="row">
              <span className="tag tag-inferred">AI Inferred / Suggested</span>
              <span className="small">A reasonable reading beyond the literal text, or an AI-proposed addition — never added without your explicit accept.</span>
            </div>
            <div className="row">
              <span className="tag tag-recommended">Recommended</span>
              <span className="small">AI-suggested from the institutional KPI library based on project type, proposal, Results Framework and Theory of Change.</span>
            </div>
            <div className="row">
              <span className="tag tag-useredited">User edited</span>
              <span className="small">Changed or written by a person.</span>
            </div>
            <div className="row">
              <span className="tag tag-validated">M&amp;E Validated</span>
              <span className="small">Approved through the formal KPI-suggestion validation workflow.</span>
            </div>
            <div className="row">
              <span className="tag tag-drafted">AI drafted — not in proposal</span>
              <span className="small">AI-drafted for a missing level — review each one before accepting.</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>The six CIMMYT project types</h3>
          <div className="stack" style={{ marginTop: 6 }}>
            {[
              { label: "Basic Research / Gene Editing", canon: "Upstream discovery science", focus: "Gene editing, molecular biology, trait discovery, functional genomics, bioinformatics, controlled environment studies." },
              { label: "Breeding", canon: "Breeding and varietal development", focus: "Genomic selection, breeding pipelines, varietal improvement, multi-location trials, seed readiness." },
              { label: "Seed Systems", canon: "Seed systems and deployment", focus: "Multiplication, adaptive testing, varietal dissemination, distribution networks." },
              { label: "Digital Innovation / Digital Components", canon: "Digital agriculture and AI", focus: "Advisory systems, interoperability, AI/LLM platforms, digital extension." },
              { label: "Systems Delivery", canon: "Applied agronomy and farming systems", focus: "Regenerative agriculture, conservation agriculture, nutrient management, water management." },
              { label: "Hub Model", canon: "System change and transformation", focus: "Agri-food system transformation, rural innovation hubs, livelihoods, climate resilience, policy integration, employment ecosystems." },
            ].map(pt => (
              <div key={pt.label} className="small">
                <b>{pt.label}</b>{" "}
                <span className="muted">— CIMMYT MEAL matrix: {pt.canon}.</span>{" "}
                {pt.focus}
              </div>
            ))}
          </div>
          <p className="hint" style={{ marginTop: 10 }}>
            Systems Delivery and Hub Model are related but distinct: Systems Delivery is a focused
            delivery intervention or service model, smaller in scope; Hub Model is the most integrated
            systems-level intervention, potentially spanning multiple services, actors, geographies
            and delivery pathways.
          </p>
        </div>

        <div className="card">
          <h3>KPI Selection — how it works</h3>
          <p className="small" style={{ marginTop: 6, lineHeight: 1.6 }}>
            <b>Which KPIs are mandatory</b> is decided in M&amp;E validation, not by this tool.
            KPI Selection here only builds the candidate set — Recommended (AI, from project type /
            proposal / Results Framework / Theory of Change) plus anything added manually from the
            library — with every KPI linked to the output(s)/outcome(s) it measures.
            The mandatory determination happens later, in the formal validation step.
          </p>
          <p className="small" style={{ marginTop: 6, lineHeight: 1.6 }}>
            <b>Tiers:</b>{" "}
            A · Core accountability (routinely measured) ·{" "}
            B · Management/optional (useful for adaptive management, not essential for accountability) ·{" "}
            C · Evaluation-only (needs a dedicated study design — not routine monitoring).
          </p>
        </div>

        <div className="card">
          <h3>Data currently loaded — and what isn't</h3>
          <ul style={{ paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
            <li><b>Full KPI Library</b> extracted from all 13 CIMMYT Toolbox pathway volumes and their Methodological Companions — the complete institutional indicator set.</li>
            <li><b>No controlled vocabulary / data-standards source</b> was supplied — every Data Requirements field is flagged "No approved term found" rather than guessing.</li>
            <li><b>AI assistance</b> is used at five points: proposal analysis, Theory of Change drafting, KPI recommendation, KPI natural-language search, and optional methodological-guidance text. AI never auto-approves a KPI suggestion and never silently edits an approved Results Framework or Theory of Change.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
