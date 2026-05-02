import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, FileText, Loader2, Send, ShieldAlert } from "lucide-react";
import PlayerSelectList from "@/components/contracts/PlayerSelectList";
import ContractTypeCards from "@/components/contracts/ContractTypeCards";
import ContractSummary from "@/components/contracts/ContractSummary";

export default function CreateContract() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const clubId = urlParams.get("club");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [club, setClub] = useState(null);
  const [players, setPlayers] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [myPlayer, setMyPlayer] = useState(null);
  const [isPresident, setIsPresident] = useState(false);

  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedType, setSelectedType] = useState("squad");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!clubId) return;
    loadData();
  }, [clubId]);

  async function loadData() {
    setLoading(true);
    const [user, clubArr] = await Promise.all([
      base44.auth.me(),
      base44.entities.Club.filter({ id: clubId }),
    ]);
    const clubData = clubArr[0];
    if (!clubData) { setLoading(false); return; }
    setClub(clubData);

    const [playerArr, contractArr] = await Promise.all([
      base44.entities.Player.filter({ club_id: clubId }),
      base44.entities.PlayerContract.filter({ team_id: clubId }),
    ]);
    setPlayers(playerArr);
    setContracts(contractArr);

    const me = playerArr.find(p => p.email === user.email);
    setMyPlayer(me);
    const pres = clubData.owner_email === user.email ||
      (me && me.club_roles?.includes("president"));
    setIsPresident(pres);
    setLoading(false);
  }

  async function handleSend() {
    if (!selectedPlayer || !selectedType) return;
    setSending(true);
    await base44.functions.invoke("contractActions", {
      action: "offer",
      team_id: clubId,
      user_id: selectedPlayer.id,
      contract_type: selectedType,
      offer_note: note,
    });
    setSending(false);
    navigate(`/clubs/${clubId}`);
  }

  const playerHasConflict = selectedPlayer
    ? contracts.some(c => c.user_id === selectedPlayer.id && (c.status === "active" || c.status === "pending"))
    : false;

  const conflictContract = selectedPlayer
    ? contracts.find(c => c.user_id === selectedPlayer.id && (c.status === "active" || c.status === "pending"))
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!club) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <p className="text-muted-foreground">Club not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  if (!isPresident) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <ShieldAlert className="w-10 h-10 text-destructive mx-auto mb-3" />
          <h2 className="font-heading text-xl uppercase text-foreground">Access Restricted</h2>
          <p className="text-sm text-muted-foreground mt-2">Only the club president can create contracts.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-2xl sm:text-3xl uppercase tracking-wide text-foreground">
            Create Contract
          </h1>
          <p className="text-sm text-muted-foreground truncate">{club.name}</p>
        </div>
        <FileText className="w-6 h-6 text-primary shrink-0" />
      </div>

      {/* Step 1: Player Selection */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3">
          1. Select Player
        </h3>
        <PlayerSelectList
          players={players}
          contracts={contracts}
          selectedId={selectedPlayer?.id}
          onSelect={setSelectedPlayer}
        />
      </section>

      {/* Conflict Warning */}
      {playerHasConflict && conflictContract && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-warning">
                {selectedPlayer.gamertag} already has a {conflictContract.status} contract
              </p>
              <p className="text-xs text-warning/80 mt-1">
                Type: {conflictContract.contract_type} — Status: {conflictContract.status}
                {conflictContract.start_date && ` — Started: ${new Date(conflictContract.start_date).toLocaleDateString()}`}
              </p>
              <p className="text-xs text-warning/80 mt-0.5">
                Only one active or pending contract per player is allowed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Contract Type */}
      {selectedPlayer && !playerHasConflict && (
        <section className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3">
            2. Choose Contract Type
          </h3>
          <ContractTypeCards selectedType={selectedType} onSelect={setSelectedType} />
        </section>
      )}

      {/* Step 3: Summary */}
      {selectedPlayer && !playerHasConflict && selectedType && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3">
            3. Review
          </h3>
          <ContractSummary player={selectedPlayer} contractType={selectedType} />
        </section>
      )}

      {/* Step 4: Note */}
      {selectedPlayer && !playerHasConflict && selectedType && (
        <section className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3">
            4. Note (optional)
          </h3>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="bg-secondary border-border"
            placeholder="Add a message for the player..."
            rows={3}
          />
        </section>
      )}

      {/* Actions */}
      {selectedPlayer && !playerHasConflict && selectedType && (
        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={() => navigate(-1)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 sm:flex-none bg-primary text-primary-foreground gap-2"
            onClick={handleSend}
            disabled={sending}
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {sending ? "Sending..." : "Send Contract Offer"}
          </Button>
        </div>
      )}
    </div>
  );
}