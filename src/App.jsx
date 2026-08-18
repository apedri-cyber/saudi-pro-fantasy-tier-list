import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient.js";

const TIERS = [
  { key: "S", label: "CHAMPIONSHIP",  score: 6, color: "#E63946" },
  { key: "A", label: "PLAYOFF LOCK",  score: 5, color: "#F1913D" },
  { key: "B", label: "BUBBLE TEAM",   score: 4, color: "#E8C13B" },
  { key: "C", label: "MIDDLING",      score: 3, color: "#7FB069" },
  { key: "D", label: "REBUILD",       score: 2, color: "#5B8FB9" },
  { key: "F", label: "TANK MODE",     score: 1, color: "#8069A6" },
];

const LEAGUE_MEMBERS = [
  "Alex", "Tommy", "CK", "JP", "Stephen", "Fedgi",
  "Matty B", "Will", "Enzo", "Maria", "Marco", "A Smokes",
];

const FONT_LINK_ID = "tier-fonts";

function useFonts() {
  useEffect(() => {
    if (document.getElementById(FONT_LINK_ID)) return;
    const link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap";
    document.head.appendChild(link);
  }, []);
}

export default function TierListApp() {
  useFonts();
  const [phase, setPhase] = useState("loading"); // loading | setup | vote | results
  const [teams, setTeams] = useState([]);
  const [voterName, setVoterName] = useState("");
  const [assignments, setAssignments] = useState({});
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [allVotes, setAllVotes] = useState({});
  const [resultsLoading, setResultsLoading] = useState(false);
  const [hasVotedBefore, setHasVotedBefore] = useState(false);
  const [expandedVoter, setExpandedVoter] = useState(null);

  useEffect(() => {
    setTeams(LEAGUE_MEMBERS);
    setPhase("vote");
  }, []);

  const tryLoadExistingVote = async (name) => {
    setError("");
    const { data, error: loadError } = await supabase
      .from("tier_ballots")
      .select("voter_name, assignments")
      .eq("voter_name", name)
      .maybeSingle();

    if (loadError) {
      setAssignments({});
      setHasVotedBefore(false);
      setError(`Couldn't load ballot: ${loadError.message}`);
      return;
    }

    if (data) {
      setAssignments(data.assignments || {});
      setHasVotedBefore(true);
      return;
    }

    setAssignments({});
    setHasVotedBefore(false);
  };

  const handleVoterChange = async (name) => {
    setVoterName(name);
    setSelectedTeam(null);
    setError("");
    if (!name) {
      setAssignments({});
      setHasVotedBefore(false);
      return;
    }
    await tryLoadExistingVote(name);
  };

  const assignTeamToTier = (teamName, tierKey) => {
    setAssignments((prev) => ({ ...prev, [teamName]: tierKey }));
    setSelectedTeam(null);
  };

  const clearAssignment = (teamName) => {
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[teamName];
      return next;
    });
  };

  const submitVote = async () => {
    if (!voterName.trim()) {
      setError("Select your name first.");
      return;
    }
    if (Object.keys(assignments).length !== teams.length) {
      setError(`Rank all ${teams.length} teams before submitting.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { error: saveError } = await supabase
        .from("tier_ballots")
        .upsert(
          {
            voter_name: voterName,
            assignments,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "voter_name" }
        );

      if (saveError) throw saveError;

      setHasVotedBefore(true);
      await loadResults();
      setPhase("results");
    } catch (e) {
      setError(`Couldn't submit: ${e?.message || "Try again."}`);
    }
    setSaving(false);
  };

  const loadResults = async () => {
    setResultsLoading(true);
    setError("");

    const { data, error: resultsError } = await supabase
      .from("tier_ballots")
      .select("voter_name, assignments, updated_at")
      .order("updated_at", { ascending: true });

    if (resultsError) {
      setError(`Couldn't load results: ${resultsError.message}`);
      setResultsLoading(false);
      return;
    }

    const votes = {};
    for (const row of data || []) {
      votes[row.voter_name] = {
        voter: row.voter_name,
        assignments: row.assignments || {},
        ts: row.updated_at,
      };
    }

    setAllVotes(votes);
    setResultsLoading(false);
  };

  const goToResults = async () => {
    await loadResults();
    setPhase("results");
  };

  const bg = "#0B2818";
  const cream = "#F3EDDD";
  const gold = "#D4A73D";
  const line = "rgba(243,237,221,0.14)";

  const shell = {
    minHeight: "100vh",
    background: `radial-gradient(1200px 600px at 50% -10%, #123723 0%, ${bg} 60%)`,
    color: cream,
    fontFamily: "'Inter', sans-serif",
    padding: "28px 18px 60px",
    boxSizing: "border-box",
  };

  const displayFont = { fontFamily: "'Anton', sans-serif", letterSpacing: "0.5px" };
  const monoFont = { fontFamily: "'JetBrains Mono', monospace" };

  if (phase === "loading") {
    return (
      <div style={{ ...shell, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...monoFont, color: gold, fontSize: 14, letterSpacing: 2 }}>LOADING LEAGUE...</div>
      </div>
    );
  }

  // ---------- VOTE ----------
  if (phase === "vote") {
    const rankedCount = Object.keys(assignments).length;
    return (
      <div style={shell}>
        <Header displayFont={displayFont} monoFont={monoFont} gold={gold} cream={cream} />
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              marginBottom: 18,
              flexWrap: "wrap",
            }}
          >
            <select
              value={voterName}
              onChange={(e) => handleVoterChange(e.target.value)}
              aria-label="Select your name"
              style={{
                flex: "1 1 180px",
                background: "#123723",
                border: `1px solid ${line}`,
                borderRadius: 8,
                padding: "10px 12px",
                color: voterName ? cream : "rgba(243,237,221,0.6)",
                fontSize: 14,
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="">Select your name</option>
              {LEAGUE_MEMBERS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <button
              onClick={goToResults}
              style={{
                background: "none",
                border: `1px solid ${line}`,
                color: cream,
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13,
                cursor: "pointer",
                ...monoFont,
              }}
            >
              VIEW RESULTS →
            </button>
          </div>

          {hasVotedBefore && (
            <div style={{ ...monoFont, fontSize: 11, color: "#7FB069", marginBottom: 10 }}>
              Loaded your previous ballot — adjust and resubmit anytime.
            </div>
          )}

          <div style={{ ...monoFont, fontSize: 11, color: gold, letterSpacing: 2, marginBottom: 6 }}>
            SAUDI PRO FANTASY / 2026 · POWER RANKINGS
          </div>
          <h2 style={{ ...displayFont, fontSize: 24, margin: "0 0 14px", color: cream }}>
            Build your tier list
          </h2>

          {/* Unranked pool */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              padding: 12,
              background: "rgba(243,237,221,0.04)",
              border: `1px solid ${line}`,
              borderRadius: 12,
              marginBottom: 16,
              minHeight: 44,
            }}
          >
            {teams.filter((t) => !assignments[t]).length === 0 ? (
              <span style={{ fontSize: 13, color: "rgba(243,237,221,0.4)" }}>All teams ranked ✓</span>
            ) : (
              teams
                .filter((t) => !assignments[t])
                .map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    active={selectedTeam === t}
                    onClick={() => setSelectedTeam(selectedTeam === t ? null : t)}
                    gold={gold}
                    cream={cream}
                  />
                ))
            )}
          </div>

          {/* Tier rows */}
          <div style={{ display: "grid", gap: 6 }}>
            {TIERS.map((tier) => (
              <div
                key={tier.key}
                onClick={() => selectedTeam && assignTeamToTier(selectedTeam, tier.key)}
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  border: `1px solid ${line}`,
                  borderRadius: 10,
                  overflow: "hidden",
                  cursor: selectedTeam ? "pointer" : "default",
                  background: selectedTeam ? "rgba(243,237,221,0.03)" : "transparent",
                  transition: "background 0.15s",
                }}
              >
                <div
                  style={{
                    ...displayFont,
                    width: 56,
                    flexShrink: 0,
                    background: tier.color,
                    color: "#12200f",
                    fontSize: 26,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {tier.key}
                </div>
                <div style={{ flex: 1, padding: "8px 10px" }}>
                  <div style={{ ...monoFont, fontSize: 9, letterSpacing: 1.5, color: "rgba(243,237,221,0.4)", marginBottom: 4 }}>
                    {tier.label}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {teams
                      .filter((t) => assignments[t] === tier.key)
                      .map((t) => (
                        <Chip
                          key={t}
                          label={t}
                          small
                          onClick={() => clearAssignment(t)}
                          gold={gold}
                          cream={cream}
                          removable
                        />
                      ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {error && <div style={{ color: "#F1913D", fontSize: 13, marginTop: 14 }}>{error}</div>}

          <button
            onClick={submitVote}
            disabled={saving}
            style={{
              marginTop: 18,
              width: "100%",
              background: rankedCount === teams.length ? gold : "rgba(243,237,221,0.15)",
              border: "none",
              borderRadius: 10,
              padding: "14px",
              color: rankedCount === teams.length ? "#12200f" : "rgba(243,237,221,0.5)",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
              letterSpacing: 0.5,
            }}
          >
            {saving
              ? "SUBMITTING..."
              : `SUBMIT BALLOT (${rankedCount}/${teams.length} RANKED)`}
          </button>
        </div>
      </div>
    );
  }

  // ---------- RESULTS ----------
  const voteList = Object.values(allVotes);
  const stats = teams.map((team) => {
    const scores = [];
    const tierCounts = {};
    voteList.forEach((v) => {
      const tKey = v.assignments && v.assignments[team];
      const tierDef = TIERS.find((t) => t.key === tKey);
      if (tierDef) {
        scores.push(tierDef.score);
        tierCounts[tKey] = (tierCounts[tKey] || 0) + 1;
      }
    });
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { team, avg, votes: scores.length, tierCounts };
  });
  stats.sort((a, b) => b.avg - a.avg);

  const tierGroups = TIERS.map((tier) => ({
    tier,
    teams: stats.filter((s) => {
      if (s.votes === 0) return false;
      const rounded = Math.round(s.avg);
      return rounded === tier.score;
    }),
  }));
  const unvoted = stats.filter((s) => s.votes === 0);

  return (
    <div style={shell}>
      <Header displayFont={displayFont} monoFont={monoFont} gold={gold} cream={cream} />
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ ...monoFont, fontSize: 11, color: gold, letterSpacing: 2 }}>
              {voteList.length} BALLOT{voteList.length === 1 ? "" : "S"} COUNTED
            </div>
            <h2 style={{ ...displayFont, fontSize: 24, margin: "4px 0 0", color: cream }}>
              Community results
            </h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={loadResults}
              style={{
                background: "none",
                border: `1px solid ${line}`,
                color: cream,
                borderRadius: 8,
                padding: "9px 12px",
                fontSize: 12,
                cursor: "pointer",
                ...monoFont,
              }}
            >
              {resultsLoading ? "..." : "REFRESH"}
            </button>
            <button
              onClick={() => setPhase("vote")}
              style={{
                background: gold,
                border: "none",
                color: "#12200f",
                borderRadius: 8,
                padding: "9px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                ...monoFont,
              }}
            >
              MY BALLOT
            </button>
          </div>
        </div>

        {voteList.length === 0 ? (
          <div style={{ fontSize: 14, color: "rgba(243,237,221,0.6)", padding: "20px 0" }}>
            No ballots yet. Be the first to rank the league.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ ...monoFont, fontSize: 10, letterSpacing: 1.5, color: "rgba(243,237,221,0.4)", marginBottom: 2 }}>
              RANKED BY AVERAGE SCORE · S=6 / A=5 / B=4 / C=3 / D=2 / F=1
            </div>
            {tierGroups.map(({ tier, teams: teamsInTier }) => (
              <div
                key={tier.key}
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  border: `1px solid ${line}`,
                  borderRadius: 10,
                  overflow: "hidden",
                  minHeight: 52,
                }}
              >
                <div
                  style={{
                    ...displayFont,
                    width: 56,
                    flexShrink: 0,
                    background: tier.color,
                    color: "#12200f",
                    fontSize: 26,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {tier.key}
                </div>
                <div style={{ flex: 1, padding: "8px 10px" }}>
                  <div style={{ ...monoFont, fontSize: 9, letterSpacing: 1.5, color: "rgba(243,237,221,0.4)", marginBottom: 4 }}>
                    {tier.label}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {teamsInTier.length === 0 ? (
                      <span style={{ fontSize: 12, color: "rgba(243,237,221,0.25)" }}>—</span>
                    ) : (
                      teamsInTier
                        .sort((a, b) => b.avg - a.avg)
                        .map((s) => {
                          const rank = stats.findIndex((x) => x.team === s.team) + 1;
                          const distribution = TIERS
                            .filter((t) => (s.tierCounts[t.key] || 0) > 0)
                            .map((t) => `${t.key}:${s.tierCounts[t.key]}`)
                            .join(" · ");
                          return (
                            <div
                              key={s.team}
                              style={{
                                background: "rgba(243,237,221,0.08)",
                                border: `1px solid ${line}`,
                                borderRadius: 10,
                                padding: "7px 10px",
                                fontSize: 13,
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <span style={{ ...monoFont, fontSize: 10, color: "rgba(243,237,221,0.4)" }}>#{rank}</span>
                              <span>{s.team}</span>
                              <span style={{ ...monoFont, fontSize: 10, color: gold }}>{s.avg.toFixed(1)}</span>
                              <span style={{ ...monoFont, fontSize: 9, color: "rgba(243,237,221,0.45)" }}>{distribution}</span>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>
            ))}
            {unvoted.length > 0 && (
              <div style={{ fontSize: 12, color: "rgba(243,237,221,0.4)", padding: "6px 4px" }}>
                Not yet ranked by anyone: {unvoted.map((s) => s.team).join(", ")}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 24, borderTop: `1px solid ${line}`, paddingTop: 14 }}>
          <div style={{ ...monoFont, fontSize: 10, letterSpacing: 1.5, color: "rgba(243,237,221,0.4)", marginBottom: 8 }}>
            VOTERS — TAP A NAME TO SEE THEIR BALLOT
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {voteList.length === 0 ? (
              <span style={{ fontSize: 12, color: "rgba(243,237,221,0.3)" }}>—</span>
            ) : (
              voteList.map((v, i) => {
                const isOpen = expandedVoter === v.voter;
                return (
                  <button
                    key={i}
                    onClick={() => setExpandedVoter(isOpen ? null : v.voter)}
                    style={{
                      fontSize: 11,
                      ...monoFont,
                      background: isOpen ? gold : "rgba(243,237,221,0.05)",
                      border: `1px solid ${isOpen ? gold : line}`,
                      borderRadius: 6,
                      padding: "4px 8px",
                      color: isOpen ? "#12200f" : "rgba(243,237,221,0.6)",
                      cursor: "pointer",
                      fontWeight: isOpen ? 700 : 500,
                    }}
                  >
                    {v.voter}
                  </button>
                );
              })
            )}
          </div>

          {expandedVoter &&
            (() => {
              const v = voteList.find((x) => x.voter === expandedVoter);
              if (!v) return null;
              return (
                <div
                  style={{
                    border: `1px solid ${line}`,
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: "rgba(243,237,221,0.03)",
                  }}
                >
                  <div style={{ ...displayFont, fontSize: 16, color: gold, marginBottom: 8 }}>
                    {v.voter}'s ballot
                  </div>
                  <div style={{ display: "grid", gap: 5 }}>
                    {TIERS.map((tier) => {
                      const teamsHere = teams.filter((t) => v.assignments && v.assignments[t] === tier.key);
                      if (teamsHere.length === 0) return null;
                      return (
                        <div key={tier.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              ...displayFont,
                              fontSize: 13,
                              width: 22,
                              height: 22,
                              borderRadius: 5,
                              background: tier.color,
                              color: "#12200f",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {tier.key}
                          </span>
                          <span style={{ fontSize: 13, color: cream }}>{teamsHere.join(", ")}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
        </div>
      </div>
    </div>
  );
}

function Header({ displayFont, monoFont, gold, cream }) {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto 24px", textAlign: "center" }}>
      <div style={{ ...monoFont, fontSize: 10, letterSpacing: 3, color: gold, marginBottom: 6 }}>
        LEAGUE TIER BOARD
      </div>
      <h1 style={{ ...displayFont, fontSize: 34, margin: 0, color: cream, lineHeight: 1 }}>
        WHO'S REAL, WHO'S NOT
      </h1>
    </div>
  );
}

function Chip({ label, active, onClick, gold, cream, small, removable }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? gold : "rgba(243,237,221,0.08)",
        color: active ? "#12200f" : cream,
        border: `1px solid ${active ? gold : "rgba(243,237,221,0.18)"}`,
        borderRadius: 999,
        padding: small ? "5px 10px" : "8px 14px",
        fontSize: small ? 12 : 13,
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      {label}
      {removable && <span style={{ opacity: 0.5, fontSize: 11 }}>✕</span>}
    </button>
  );
}