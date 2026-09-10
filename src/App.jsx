import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient.js";

const TIERS = [
  { key: "S", label: "CHAMPIONSHIP", score: 6, color: "#E63946" },
  { key: "A", label: "PLAYOFF LOCK", score: 5, color: "#F1913D" },
  { key: "B", label: "BUBBLE TEAM", score: 4, color: "#E8C13B" },
  { key: "C", label: "MIDDLING", score: 3, color: "#7FB069" },
  { key: "D", label: "REBUILD", score: 2, color: "#5B8FB9" },
  { key: "F", label: "TANK MODE", score: 1, color: "#8069A6" },
];

const LEAGUE_MEMBERS = [
  "Alex",
  "Tommy",
  "CK",
  "JP",
  "Stephen",
  "Fedgi",
  "Matty B",
  "Will",
  "Enzo",
  "Maria",
  "Marco",
  "A Smokes",
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

function sanitizeAssignments(assignments, voterName) {
  const allowedTeams = new Set(LEAGUE_MEMBERS.filter((name) => name !== voterName));
  const clean = {};

  for (const [team, tier] of Object.entries(assignments || {})) {
    if (allowedTeams.has(team) && TIERS.some((t) => t.key === tier)) {
      clean[team] = tier;
    }
  }

  return clean;
}

export default function TierListApp() {
  useFonts();

  const [phase, setPhase] = useState("loading");
  const [rounds, setRounds] = useState([]);
  const [activeRound, setActiveRound] = useState(null);
  const [resultsRound, setResultsRound] = useState(null);
  const [voterName, setVoterName] = useState("");
  const [assignments, setAssignments] = useState({});
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [allVotes, setAllVotes] = useState({});
  const [resultsLoading, setResultsLoading] = useState(false);
  const [hasVotedBefore, setHasVotedBefore] = useState(false);
  const [expandedVoter, setExpandedVoter] = useState(null);
  const [commissionerOpen, setCommissionerOpen] = useState(false);
  const [commissionerCode, setCommissionerCode] = useState("");
  const [advancingWeek, setAdvancingWeek] = useState(false);
  const [commissionerMessage, setCommissionerMessage] = useState("");

  const bg = "#0B2818";
  const cream = "#F3EDDD";
  const gold = "#D4A73D";
  const line = "rgba(243,237,221,0.14)";
  const displayFont = { fontFamily: "'Anton', sans-serif", letterSpacing: "0.5px" };
  const monoFont = { fontFamily: "'JetBrains Mono', monospace" };

  const shell = {
    minHeight: "100vh",
    background: `radial-gradient(1200px 600px at 50% -10%, #123723 0%, ${bg} 60%)`,
    color: cream,
    fontFamily: "'Inter', sans-serif",
    padding: "28px 18px 60px",
    boxSizing: "border-box",
  };

  const loadRounds = async () => {
    const { data, error: roundsError } = await supabase
      .from("ranking_rounds")
      .select("id, season, week, status, created_at, archived_at")
      .order("week", { ascending: false });

    if (roundsError) throw roundsError;

    const list = data || [];
    const current = list.find((round) => round.status === "active") || null;
    setRounds(list);
    setActiveRound(current);
    setResultsRound((prev) => {
      if (prev) return list.find((round) => round.id === prev.id) || current || list[0] || null;
      return current || list[0] || null;
    });
    return { list, current };
  };

  useEffect(() => {
    (async () => {
      try {
        await loadRounds();
        setPhase("vote");
      } catch (e) {
        setError(`Couldn't load ranking week: ${e?.message || "Unknown error"}`);
        setPhase("vote");
      }
    })();
  }, []);

  const availableTeams = useMemo(
    () => (voterName ? LEAGUE_MEMBERS.filter((name) => name !== voterName) : []),
    [voterName]
  );

  const tryLoadExistingVote = async (name, round = activeRound) => {
    setError("");
    setSelectedTeam(null);
    if (!name || !round) {
      setAssignments({});
      setHasVotedBefore(false);
      return;
    }

    const { data, error: loadError } = await supabase
      .from("tier_ballots")
      .select("voter_name, assignments")
      .eq("round_id", round.id)
      .eq("voter_name", name)
      .maybeSingle();

    if (loadError) {
      setAssignments({});
      setHasVotedBefore(false);
      setError(`Couldn't load ballot: ${loadError.message}`);
      return;
    }

    if (data) {
      setAssignments(sanitizeAssignments(data.assignments, name));
      setHasVotedBefore(true);
      return;
    }

    setAssignments({});
    setHasVotedBefore(false);
  };

  const handleVoterChange = async (name) => {
    setVoterName(name);
    setError("");
    setSelectedTeam(null);
    await tryLoadExistingVote(name, activeRound);
  };

  const assignTeamToTier = (teamName, tierKey) => {
    if (!voterName || teamName === voterName) return;
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
    if (!activeRound) return setError("There isn't an active ranking week right now.");
    if (!voterName) return setError("Select your name first.");

    const cleanAssignments = sanitizeAssignments(assignments, voterName);
    if (Object.keys(cleanAssignments).length !== LEAGUE_MEMBERS.length - 1) {
      return setError(`Rank all ${LEAGUE_MEMBERS.length - 1} other managers before submitting.`);
    }

    setSaving(true);
    setError("");
    try {
      const { error: saveError } = await supabase.from("tier_ballots").upsert(
        {
          round_id: activeRound.id,
          voter_name: voterName,
          assignments: cleanAssignments,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "round_id,voter_name" }
      );
      if (saveError) throw saveError;
      setAssignments(cleanAssignments);
      setHasVotedBefore(true);
      setResultsRound(activeRound);
      await loadResults(activeRound);
      setPhase("results");
    } catch (e) {
      setError(`Couldn't submit: ${e?.message || "Try again."}`);
    } finally {
      setSaving(false);
    }
  };

  const loadResults = async (round = resultsRound || activeRound) => {
    if (!round) return;
    setResultsLoading(true);
    setError("");
    setExpandedVoter(null);

    const { data, error: resultsError } = await supabase
      .from("tier_ballots")
      .select("round_id, voter_name, assignments, updated_at")
      .eq("round_id", round.id)
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
        assignments: sanitizeAssignments(row.assignments, row.voter_name),
        ts: row.updated_at,
      };
    }
    setAllVotes(votes);
    setResultsLoading(false);
  };

  const goToResults = async () => {
    const round = resultsRound || activeRound;
    if (round) await loadResults(round);
    setPhase("results");
  };

  const handleResultsRoundChange = async (roundId) => {
    const round = rounds.find((item) => String(item.id) === String(roundId));
    if (!round) return;
    setResultsRound(round);
    await loadResults(round);
  };

  const goBackToBallot = async () => {
    setPhase("vote");
    setResultsRound(activeRound);
    setAllVotes({});
    setExpandedVoter(null);
    if (voterName) await tryLoadExistingVote(voterName, activeRound);
  };

  const advanceWeek = async () => {
    if (!activeRound || !commissionerCode) return;
    const nextWeek = activeRound.week + 1;
    const confirmed = window.confirm(
      `Start Week ${nextWeek}? Week ${activeRound.week} will be archived and become read-only.`
    );
    if (!confirmed) return;

    setAdvancingWeek(true);
    setCommissionerMessage("");
    try {
      const { data, error: functionError } = await supabase.functions.invoke("advance-tier-week", {
        body: { code: commissionerCode },
      });
      if (functionError) throw functionError;
      if (!data?.ok) throw new Error(data?.error || "Couldn't advance the week.");

      const { current } = await loadRounds();
      setVoterName("");
      setAssignments({});
      setHasVotedBefore(false);
      setSelectedTeam(null);
      setAllVotes({});
      setExpandedVoter(null);
      setCommissionerCode("");
      setCommissionerMessage(`Week ${data.round.week} is now open for voting.`);
      setResultsRound(data.round || current);
      setPhase("vote");
    } catch (e) {
      setCommissionerMessage(e?.message || "Couldn't advance the week.");
    } finally {
      setAdvancingWeek(false);
    }
  };

  const voteList = Object.values(allVotes);
  const stats = LEAGUE_MEMBERS.map((team) => {
    const scores = [];
    const tierCounts = {};
    voteList.forEach((vote) => {
      if (vote.voter === team) return;
      const tierKey = vote.assignments?.[team];
      const tierDef = TIERS.find((tier) => tier.key === tierKey);
      if (!tierDef) return;
      scores.push(tierDef.score);
      tierCounts[tierKey] = (tierCounts[tierKey] || 0) + 1;
    });
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { team, avg, votes: scores.length, tierCounts };
  }).sort((a, b) => b.avg - a.avg || a.team.localeCompare(b.team));

  const tierGroups = TIERS.map((tier) => ({
    tier,
    teams: stats.filter((item) => item.votes > 0 && Math.round(item.avg) === tier.score),
  }));
  const unvotedTeams = stats.filter((item) => item.votes === 0);
  const selectedResultsRound = resultsRound || activeRound;

  if (phase === "loading") {
    return (
      <div style={{ ...shell, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...monoFont, color: gold, fontSize: 14, letterSpacing: 2 }}>LOADING LEAGUE...</div>
      </div>
    );
  }

  if (phase === "vote") {
    const rankedCount = Object.keys(sanitizeAssignments(assignments, voterName)).length;
    const targetCount = LEAGUE_MEMBERS.length - 1;
    const unrankedTeams = availableTeams.filter((team) => !assignments[team]);

    return (
      <div style={shell}>
        <Header displayFont={displayFont} monoFont={monoFont} gold={gold} cream={cream} />
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <div>
              <div style={{ ...monoFont, fontSize: 10, color: gold, letterSpacing: 2 }}>SAUDI PRO FANTASY · {activeRound?.season || 2026}</div>
              <div style={{ ...displayFont, fontSize: 25, marginTop: 2 }}>WEEK {activeRound?.week || "—"} TIER LIST</div>
            </div>
            <button onClick={goToResults} style={outlineButton(line, cream, monoFont)}>VIEW RESULTS →</button>
          </div>

          <div style={{ padding: "10px 12px", border: `1px solid ${line}`, borderRadius: 10, background: "rgba(243,237,221,0.035)", marginBottom: 16, fontSize: 12, lineHeight: 1.5, color: "rgba(243,237,221,0.65)" }}>
            Rank the other 11 managers. <strong style={{ color: cream }}>Your own team is excluded</strong> from your ballot and can never affect your community score.
          </div>

          <select value={voterName} onChange={(e) => handleVoterChange(e.target.value)} aria-label="Select your name" style={{ width: "100%", background: "#123723", border: `1px solid ${line}`, borderRadius: 8, padding: "11px 12px", color: voterName ? cream : "rgba(243,237,221,0.6)", fontSize: 14, outline: "none", cursor: "pointer", marginBottom: 10 }}>
            <option value="">Select your name</option>
            {LEAGUE_MEMBERS.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>

          {hasVotedBefore && <div style={{ ...monoFont, fontSize: 11, color: "#7FB069", marginBottom: 10 }}>Loaded your Week {activeRound?.week} ballot — adjust and resubmit anytime while this week is open.</div>}

          {!voterName ? (
            <div style={{ border: `1px dashed ${line}`, borderRadius: 12, padding: "28px 16px", textAlign: "center", color: "rgba(243,237,221,0.5)", fontSize: 13 }}>Select your name to begin ranking the other 11 managers.</div>
          ) : (
            <>
              <div style={{ ...monoFont, fontSize: 11, color: gold, letterSpacing: 2, margin: "12px 0 6px" }}>TAP A TEAM, THEN TAP ITS TIER</div>
              <h2 style={{ ...displayFont, fontSize: 24, margin: "0 0 14px", color: cream }}>Build your tier list</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 12, background: "rgba(243,237,221,0.04)", border: `1px solid ${line}`, borderRadius: 12, marginBottom: 16, minHeight: 44 }}>
                {unrankedTeams.length === 0 ? <span style={{ fontSize: 13, color: "rgba(243,237,221,0.4)" }}>All 11 teams ranked ✓</span> : unrankedTeams.map((team) => <Chip key={team} label={team} active={selectedTeam === team} onClick={() => setSelectedTeam(selectedTeam === team ? null : team)} gold={gold} cream={cream} />)}
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                {TIERS.map((tier) => (
                  <div key={tier.key} onClick={() => selectedTeam && assignTeamToTier(selectedTeam, tier.key)} style={{ display: "flex", alignItems: "stretch", border: `1px solid ${line}`, borderRadius: 10, overflow: "hidden", cursor: selectedTeam ? "pointer" : "default", background: selectedTeam ? "rgba(243,237,221,0.03)" : "transparent" }}>
                    <div style={{ ...displayFont, width: 56, flexShrink: 0, background: tier.color, color: "#12200f", fontSize: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>{tier.key}</div>
                    <div style={{ flex: 1, padding: "8px 10px", minHeight: 52 }}>
                      <div style={{ ...monoFont, fontSize: 9, letterSpacing: 1.5, color: "rgba(243,237,221,0.4)", marginBottom: 4 }}>{tier.label}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {availableTeams.filter((team) => assignments[team] === tier.key).map((team) => <Chip key={team} label={team} small onClick={(e) => { e?.stopPropagation?.(); clearAssignment(team); }} gold={gold} cream={cream} removable />)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {error && <div style={{ color: "#F1913D", fontSize: 13, marginTop: 14 }}>{error}</div>}
              <button onClick={submitVote} disabled={saving} style={{ marginTop: 18, width: "100%", background: rankedCount === targetCount ? gold : "rgba(243,237,221,0.15)", border: "none", borderRadius: 10, padding: 14, color: rankedCount === targetCount ? "#12200f" : "rgba(243,237,221,0.5)", fontWeight: 700, fontSize: 15, cursor: saving ? "wait" : "pointer", letterSpacing: 0.5 }}>
                {saving ? "SUBMITTING..." : `SUBMIT BALLOT (${rankedCount}/${targetCount} RANKED)`}
              </button>
            </>
          )}
          {error && !voterName && <div style={{ color: "#F1913D", fontSize: 13, marginTop: 14 }}>{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={shell}>
      <Header displayFont={displayFont} monoFont={monoFont} gold={gold} cream={cream} />
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <div>
            <div style={{ ...monoFont, fontSize: 11, color: gold, letterSpacing: 2 }}>{voteList.length}/12 MANAGERS VOTED</div>
            <h2 style={{ ...displayFont, fontSize: 24, margin: "4px 0 0", color: cream }}>Week {selectedResultsRound?.week || "—"} community results</h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => loadResults(selectedResultsRound)} style={outlineButton(line, cream, monoFont)}>{resultsLoading ? "..." : "REFRESH"}</button>
            <button onClick={goBackToBallot} style={goldButton(gold, monoFont)}>MY BALLOT</button>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <select value={selectedResultsRound?.id || ""} onChange={(e) => handleResultsRoundChange(e.target.value)} style={{ width: "100%", background: "#123723", border: `1px solid ${line}`, borderRadius: 8, padding: "10px 12px", color: cream, fontSize: 13 }}>
            {rounds.map((round) => <option key={round.id} value={round.id}>2026 Week {round.week}{round.status === "active" ? " · ACTIVE" : " · ARCHIVED"}</option>)}
          </select>
        </div>

        {error && <div style={{ color: "#F1913D", fontSize: 13, marginBottom: 14 }}>{error}</div>}

        {resultsLoading ? (
          <div style={{ ...monoFont, color: gold, padding: "24px 0" }}>LOADING RESULTS...</div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {tierGroups.map(({ tier, teams }) => (
              <div key={tier.key} style={{ display: "flex", border: `1px solid ${line}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ ...displayFont, width: 56, flexShrink: 0, background: tier.color, color: "#12200f", fontSize: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>{tier.key}</div>
                <div style={{ flex: 1, padding: "8px 10px" }}>
                  <div style={{ ...monoFont, fontSize: 9, letterSpacing: 1.5, color: "rgba(243,237,221,0.4)", marginBottom: 6 }}>{tier.label}</div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {teams.length === 0 ? <span style={{ color: "rgba(243,237,221,0.25)" }}>—</span> : teams.map((item) => {
                      const rank = stats.findIndex((stat) => stat.team === item.team) + 1;
                      const distribution = TIERS.filter((t) => (item.tierCounts[t.key] || 0) > 0).map((t) => `${t.key}:${item.tierCounts[t.key]}`).join(" · ");
                      return (
                        <div key={item.team} style={{ background: "rgba(243,237,221,0.06)", border: `1px solid ${line}`, borderRadius: 8, padding: "7px 9px", display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                          <span style={{ ...monoFont, fontSize: 10, color: "rgba(243,237,221,0.4)" }}>#{rank}</span>
                          <span style={{ fontSize: 13 }}>{item.team}</span>
                          <span style={{ ...monoFont, fontSize: 10, color: gold }}>{item.avg.toFixed(2)}</span>
                          <span style={{ ...monoFont, fontSize: 9, color: "rgba(243,237,221,0.4)" }}>{item.votes}/11 votes · {distribution}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}

            {unvotedTeams.length > 0 && <div style={{ fontSize: 12, color: "rgba(243,237,221,0.4)", padding: "6px 4px" }}>Not ranked by anyone yet: {unvotedTeams.map((item) => item.team).join(", ")}</div>}
          </div>
        )}

        <div style={{ marginTop: 24, borderTop: `1px solid ${line}`, paddingTop: 14 }}>
          <div style={{ ...monoFont, fontSize: 10, letterSpacing: 1.5, color: "rgba(243,237,221,0.4)", marginBottom: 8 }}>WEEK {selectedResultsRound?.week || "—"} VOTERS — TAP A NAME TO SEE THEIR BALLOT</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {voteList.length === 0 ? <span style={{ fontSize: 12, color: "rgba(243,237,221,0.3)" }}>—</span> : voteList.map((vote) => {
              const isOpen = expandedVoter === vote.voter;
              return <button key={vote.voter} onClick={() => setExpandedVoter(isOpen ? null : vote.voter)} style={{ fontSize: 11, ...monoFont, background: isOpen ? gold : "rgba(243,237,221,0.05)", border: `1px solid ${isOpen ? gold : line}`, borderRadius: 6, padding: "4px 8px", color: isOpen ? "#12200f" : "rgba(243,237,221,0.6)", cursor: "pointer", fontWeight: isOpen ? 700 : 500 }}>{vote.voter}</button>;
            })}
          </div>

          {expandedVoter && (() => {
            const vote = voteList.find((item) => item.voter === expandedVoter);
            if (!vote) return null;
            return (
              <div style={{ border: `1px solid ${line}`, borderRadius: 10, padding: "10px 12px", background: "rgba(243,237,221,0.03)" }}>
                <div style={{ ...displayFont, fontSize: 16, color: gold, marginBottom: 8 }}>{vote.voter}'s Week {selectedResultsRound?.week} ballot</div>
                <div style={{ display: "grid", gap: 5 }}>
                  {TIERS.map((tier) => {
                    const teamsHere = LEAGUE_MEMBERS.filter((team) => team !== vote.voter && vote.assignments?.[team] === tier.key);
                    if (teamsHere.length === 0) return null;
                    return <div key={tier.key} style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ ...displayFont, fontSize: 13, width: 22, height: 22, borderRadius: 5, background: tier.color, color: "#12200f", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{tier.key}</span><span style={{ fontSize: 13, color: cream }}>{teamsHere.join(", ")}</span></div>;
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        <div style={{ marginTop: 28, borderTop: `1px solid ${line}`, paddingTop: 16 }}>
          <button onClick={() => { setCommissionerOpen((open) => !open); setCommissionerMessage(""); }} style={outlineButton(line, "rgba(243,237,221,0.6)", monoFont)}>COMMISSIONER CONTROLS</button>
          {commissionerOpen && (
            <div style={{ marginTop: 10, border: `1px solid ${line}`, borderRadius: 10, padding: 12, background: "rgba(243,237,221,0.03)" }}>
              <div style={{ ...monoFont, fontSize: 10, color: gold, letterSpacing: 1.2, marginBottom: 6 }}>ACTIVE ROUND · WEEK {activeRound?.week || "—"}</div>
              <div style={{ fontSize: 13, color: "rgba(243,237,221,0.65)", lineHeight: 1.5, marginBottom: 10 }}>Starting the next week archives Week {activeRound?.week || "—"} permanently and opens a fresh 0/12 voting round.</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input type="password" value={commissionerCode} onChange={(e) => setCommissionerCode(e.target.value)} placeholder="Commissioner code" autoComplete="off" style={{ flex: "1 1 180px", background: "#123723", border: `1px solid ${line}`, borderRadius: 8, padding: "10px 12px", color: cream, fontSize: 13, outline: "none" }} />
                <button disabled={!commissionerCode || advancingWeek} onClick={advanceWeek} style={{ ...goldButton(gold, monoFont), opacity: !commissionerCode || advancingWeek ? 0.45 : 1, cursor: advancingWeek ? "wait" : "pointer" }}>{advancingWeek ? "ADVANCING..." : `START WEEK ${(activeRound?.week || 0) + 1}`}</button>
              </div>
              {commissionerMessage && <div style={{ fontSize: 12, color: "#F1913D", marginTop: 9 }}>{commissionerMessage}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function outlineButton(line, color, monoFont) {
  return { background: "none", border: `1px solid ${line}`, color, borderRadius: 8, padding: "9px 12px", fontSize: 12, cursor: "pointer", ...monoFont };
}

function goldButton(gold, monoFont) {
  return { background: gold, border: "none", color: "#12200f", borderRadius: 8, padding: "9px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", ...monoFont };
}

function Header({ displayFont, monoFont, gold, cream }) {
  return <div style={{ maxWidth: 640, margin: "0 auto 24px", textAlign: "center" }}><div style={{ ...monoFont, fontSize: 10, letterSpacing: 3, color: gold, marginBottom: 6 }}>LEAGUE TIER BOARD · V2</div><h1 style={{ ...displayFont, fontSize: 34, margin: 0, color: cream, lineHeight: 1 }}>WHO'S REAL, WHO'S NOT</h1></div>;
}

function Chip({ label, active, onClick, gold, cream, small, removable }) {
  return <button onClick={onClick} style={{ background: active ? gold : "rgba(243,237,221,0.08)", color: active ? "#12200f" : cream, border: `1px solid ${active ? gold : "rgba(243,237,221,0.18)"}`, borderRadius: 999, padding: small ? "5px 10px" : "8px 14px", fontSize: small ? 12 : 13, fontWeight: active ? 700 : 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>{label}{removable && <span style={{ opacity: 0.5, fontSize: 11 }}>✕</span>}</button>;
}
