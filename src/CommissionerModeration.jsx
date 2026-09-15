import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";

const LEAGUE_MEMBERS = [
  "Alex", "Tommy", "CK", "JP", "Stephen", "Fedgi",
  "Matty B", "Will", "Enzo", "Maria", "Marco", "A Smokes",
];

export default function CommissionerModeration() {
  const [open, setOpen] = useState(false);
  const [activeRound, setActiveRound] = useState(null);
  const [lockedVoters, setLockedVoters] = useState([]);
  const [ballotVoters, setBallotVoters] = useState([]);
  const [selectedVoter, setSelectedVoter] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const loadState = async () => {
    const { data: round, error: roundError } = await supabase
      .from("ranking_rounds")
      .select("id, season, week, status, voting_locked")
      .eq("status", "active")
      .maybeSingle();
    if (roundError) throw roundError;
    setActiveRound(round || null);

    if (!round) {
      setLockedVoters([]);
      setBallotVoters([]);
      return;
    }

    const [{ data: locks, error: locksError }, { data: ballots, error: ballotsError }] = await Promise.all([
      supabase.from("round_voter_locks").select("voter_name").eq("round_id", round.id),
      supabase.from("tier_ballots").select("voter_name").eq("round_id", round.id),
    ]);
    if (locksError) throw locksError;
    if (ballotsError) throw ballotsError;

    setLockedVoters((locks || []).map((row) => row.voter_name));
    setBallotVoters((ballots || []).map((row) => row.voter_name));
  };

  useEffect(() => {
    if (!open) return;
    loadState().catch((e) => setMessage(e?.message || "Couldn't load moderation state."));
  }, [open]);

  const invokeAdmin = async (action, extra = {}) => {
    if (!code) throw new Error("Enter the commissioner code first.");
    if (!activeRound) throw new Error("There is no active ranking week.");

    const { data, error } = await supabase.functions.invoke("commissioner-tier-admin", {
      body: { code, action, round_id: activeRound.id, ...extra },
    });

    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || "Commissioner action failed.");
    return data;
  };

  const toggleWeekLock = async () => {
    if (!activeRound) return;
    const nextLocked = !activeRound.voting_locked;
    const prompt = nextLocked
      ? `Lock Week ${activeRound.week} voting? Nobody will be able to submit or edit ballots until you reopen it.`
      : `Reopen Week ${activeRound.week} voting? Managers will be able to submit and edit ballots again.`;
    if (!window.confirm(prompt)) return;

    setBusy("week");
    setMessage("");
    try {
      await invokeAdmin("set_week_lock", { locked: nextLocked });
      await loadState();
      setMessage(`Week ${activeRound.week} voting is now ${nextLocked ? "LOCKED" : "OPEN"}.`);
    } catch (e) {
      setMessage(e?.message || "Couldn't change the weekly lock.");
    } finally {
      setBusy("");
    }
  };

  const toggleVoterLock = async () => {
    if (!selectedVoter) return;
    const nextLocked = !lockedVoters.includes(selectedVoter);
    if (nextLocked) {
      const confirmed = window.confirm(
        `Lock ${selectedVoter} out of Week ${activeRound?.week} voting? Their existing ballot will stay in the results unless you delete it separately.`
      );
      if (!confirmed) return;
    }

    setBusy("voter");
    setMessage("");
    try {
      await invokeAdmin("set_voter_lock", { voter_name: selectedVoter, locked: nextLocked });
      await loadState();
      setMessage(`${selectedVoter} is now ${nextLocked ? "LOCKED OUT" : "ALLOWED TO VOTE"} for Week ${activeRound?.week}.`);
    } catch (e) {
      setMessage(e?.message || "Couldn't change that manager's lock.");
    } finally {
      setBusy("");
    }
  };

  const deleteBallot = async () => {
    if (!selectedVoter || !activeRound) return;
    if (!ballotVoters.includes(selectedVoter)) {
      setMessage(`${selectedVoter} does not have a Week ${activeRound.week} ballot to delete.`);
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedVoter}'s Week ${activeRound.week} ballot? It will immediately stop counting toward the community rankings. They can submit again unless you lock them out.`
    );
    if (!confirmed) return;

    setBusy("delete");
    setMessage("");
    try {
      await invokeAdmin("delete_ballot", { voter_name: selectedVoter });
      await loadState();
      setMessage(`${selectedVoter}'s Week ${activeRound.week} ballot was deleted. Refresh the results view to see the new rankings.`);
    } catch (e) {
      setMessage(e?.message || "Couldn't delete that ballot.");
    } finally {
      setBusy("");
    }
  };

  const gold = "#D4A73D";
  const cream = "#F3EDDD";
  const bg = "#0B2818";
  const line = "rgba(243,237,221,0.16)";
  const mono = { fontFamily: "'JetBrains Mono', monospace" };

  return (
    <>
      <button
        onClick={() => setOpen((value) => !value)}
        style={{ position: "fixed", right: 16, bottom: 16, zIndex: 1001, background: gold, color: "#12200f", border: "none", borderRadius: 999, padding: "11px 14px", fontWeight: 800, fontSize: 11, cursor: "pointer", boxShadow: "0 8px 28px rgba(0,0,0,.35)", ...mono }}
      >
        {open ? "CLOSE MODERATION" : "COMMISH MODERATION"}
      </button>

      {open && (
        <div style={{ position: "fixed", right: 16, bottom: 68, zIndex: 1000, width: "min(390px, calc(100vw - 32px))", maxHeight: "calc(100vh - 100px)", overflowY: "auto", boxSizing: "border-box", background: bg, color: cream, border: `1px solid ${gold}66`, borderRadius: 14, padding: 14, boxShadow: "0 18px 60px rgba(0,0,0,.5)", fontFamily: "'Inter', sans-serif" }}>
          <div style={{ ...mono, color: gold, fontSize: 10, letterSpacing: 1.5, marginBottom: 4 }}>COMMISSIONER MODERATION</div>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 10 }}>Week {activeRound?.week || "—"} Controls</div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: "rgba(243,237,221,.62)" }}>{ballotVoters.length}/12 ballots submitted</span>
            <span style={{ ...mono, fontSize: 9, color: activeRound?.voting_locked ? "#E63946" : "#7FB069" }}>{activeRound?.voting_locked ? "VOTING LOCKED" : "VOTING OPEN"}</span>
          </div>

          <input type="password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Commissioner code" autoComplete="off" style={{ width: "100%", boxSizing: "border-box", background: "#123723", border: `1px solid ${line}`, borderRadius: 8, padding: "10px 11px", color: cream, outline: "none", marginBottom: 10 }} />

          <section style={{ border: `1px solid ${line}`, borderRadius: 10, padding: 10, marginBottom: 10 }}>
            <div style={{ ...mono, fontSize: 10, marginBottom: 5 }}>WEEKLY LOCKOUT</div>
            <div style={{ fontSize: 12, lineHeight: 1.4, color: "rgba(243,237,221,.58)", marginBottom: 8 }}>Freeze the entire active week. Existing ballots stay intact and continue counting.</div>
            <button disabled={!code || Boolean(busy)} onClick={toggleWeekLock} style={buttonStyle(activeRound?.voting_locked ? "#7FB069" : "#E63946", line, mono, !code || Boolean(busy))}>
              {busy === "week" ? "WORKING..." : activeRound?.voting_locked ? `REOPEN WEEK ${activeRound.week}` : `LOCK WEEK ${activeRound?.week || ""}`}
            </button>
          </section>

          <section style={{ border: `1px solid ${line}`, borderRadius: 10, padding: 10 }}>
            <div style={{ ...mono, fontSize: 10, marginBottom: 5 }}>MANAGER MODERATION</div>
            <div style={{ fontSize: 12, lineHeight: 1.4, color: "rgba(243,237,221,.58)", marginBottom: 8 }}>Delete an unserious ballot or lock a manager slot out of voting for this week.</div>

            <select value={selectedVoter} onChange={(e) => setSelectedVoter(e.target.value)} style={{ width: "100%", boxSizing: "border-box", background: "#123723", border: `1px solid ${line}`, borderRadius: 8, padding: "9px 10px", color: selectedVoter ? cream : "rgba(243,237,221,.6)", marginBottom: 8 }}>
              <option value="">Select manager</option>
              {LEAGUE_MEMBERS.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>

            {selectedVoter && (
              <div style={{ ...mono, fontSize: 9, color: "rgba(243,237,221,.5)", marginBottom: 8 }}>BALLOT: {ballotVoters.includes(selectedVoter) ? "SUBMITTED" : "NONE"} · STATUS: {lockedVoters.includes(selectedVoter) ? "LOCKED OUT" : "CAN VOTE"}</div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button disabled={!code || !selectedVoter || Boolean(busy)} onClick={deleteBallot} style={buttonStyle("#E63946", line, mono, !code || !selectedVoter || Boolean(busy))}>{busy === "delete" ? "DELETING..." : "DELETE BALLOT"}</button>
              <button disabled={!code || !selectedVoter || Boolean(busy)} onClick={toggleVoterLock} style={buttonStyle(lockedVoters.includes(selectedVoter) ? "#7FB069" : "#F1913D", line, mono, !code || !selectedVoter || Boolean(busy))}>{busy === "voter" ? "WORKING..." : lockedVoters.includes(selectedVoter) ? "UNLOCK MANAGER" : "LOCK MANAGER"}</button>
            </div>
          </section>

          <button onClick={() => loadState().catch((e) => setMessage(e?.message || "Couldn't refresh."))} style={{ ...buttonStyle("rgba(243,237,221,.65)", line, mono, false), marginTop: 10 }}>REFRESH MODERATION STATE</button>

          {message && <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.4, color: "#F1913D" }}>{message}</div>}
          <div style={{ marginTop: 10, fontSize: 10, lineHeight: 1.4, color: "rgba(243,237,221,.36)" }}>Locks are enforced by the database, not just the page UI. Archived weeks cannot be moderated.</div>
        </div>
      )}
    </>
  );
}

function buttonStyle(color, line, mono, disabled) {
  return { background: "transparent", border: `1px solid ${line}`, color, borderRadius: 8, padding: "9px 10px", fontSize: 10, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1, ...mono };
}
