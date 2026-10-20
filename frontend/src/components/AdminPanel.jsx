import { useState } from "react";
import AccessCodesTab from "./AccessCodesTab.jsx";
import AIUsageReport  from "./AIUsageReport.jsx";

const TABS = [
  { id: "access-codes", label: "Access codes" },
  { id: "ai-usage",     label: "AI usage & errors" },
];

export default function AdminPanel() {
  const [tab, setTab] = useState("access-codes");

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Administration</h1>
      </div>

      <div className="tab-bar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "access-codes" && <AccessCodesTab />}
      {tab === "ai-usage"     && <AIUsageReport />}
    </>
  );
}
