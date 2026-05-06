import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function TournamentResultDialog({
  open, onClose, activeMatch, resultForm, setResultForm,
  myClubPlayers, playerStats, setPlayerStats,
  uploadingProof, setUploadingProof, uploadingVideo, setUploadingVideo,
  onSubmit,
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="leading-relaxed text-xl">Submit Match Result</DialogTitle>
        </DialogHeader>
        {activeMatch && (
          <div className="space-y-4 mt-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 text-center">
                <p className="leading-relaxed font-bold text-foreground">{activeMatch.home_club_name}</p>
                <Input type="number" min="0" max="99" value={resultForm.home_score}
                  onChange={e => setResultForm(f => ({ ...f, home_score: e.target.value }))}
                  className="bg-secondary border-border text-center text-2xl leading-relaxed font-bold mt-2" placeholder="0" />
              </div>
              <span className="leading-relaxed text-2xl text-muted-foreground font-bold">–</span>
              <div className="flex-1 text-center">
                <p className="leading-relaxed font-bold text-foreground">{activeMatch.away_club_name}</p>
                <Input type="number" min="0" max="99" value={resultForm.away_score}
                  onChange={e => setResultForm(f => ({ ...f, away_score: e.target.value }))}
                  className="bg-secondary border-border text-center text-2xl leading-relaxed font-bold mt-2" placeholder="0" />
              </div>
            </div>

            {myClubPlayers.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 leading-relaxed">Player Stats (optional)</p>
                {myClubPlayers.filter(p => p.dressing_room_seat != null).length === 0 && (
                  <p className="text-xs text-warning/80 mb-2">⚠️ No players have taken a dressing room seat yet.</p>
                )}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(myClubPlayers.filter(p => p.dressing_room_seat != null).length > 0
                    ? myClubPlayers.filter(p => p.dressing_room_seat != null)
                    : myClubPlayers
                  ).map(p => (
                    <div key={p.email} className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground w-24 truncate shrink-0">{p.gamertag}</span>
                      <Input type="number" min="0" max="20" placeholder="⚽ G" className="bg-secondary border-border text-center text-xs h-7 px-1"
                        value={playerStats[p.email]?.goals || ""}
                        onChange={e => setPlayerStats(s => ({ ...s, [p.email]: { ...s[p.email], goals: parseInt(e.target.value) || 0 } }))}
                      />
                      <Input type="number" min="0" max="20" placeholder="🎯 A" className="bg-secondary border-border text-center text-xs h-7 px-1"
                        value={playerStats[p.email]?.assists || ""}
                        onChange={e => setPlayerStats(s => ({ ...s, [p.email]: { ...s[p.email], assists: parseInt(e.target.value) || 0 } }))}
                      />
                      <Input type="number" min="1" max="10" step="0.1" placeholder="★" className="bg-secondary border-border text-center text-xs h-7 px-1"
                        value={playerStats[p.email]?.rating || ""}
                        onChange={e => setPlayerStats(s => ({ ...s, [p.email]: { ...s[p.email], rating: e.target.value } }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider leading-relaxed block mb-1">📸 Upload Proof Screenshot</label>
              <div className="flex items-center gap-2">
                <input type="file" accept="image/*" disabled={uploadingProof} className="flex-1 text-xs cursor-pointer"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setUploadingProof(true);
                      const { file_url } = await stageClient.integrations.Core.UploadFile({ file });
                      setResultForm(f => ({ ...f, proof_url: file_url }));
                      setUploadingProof(false);
                      e.target.value = "";
                    }
                  }}
                />
                {uploadingProof && <span className="text-xs text-muted-foreground">Uploading...</span>}
                {resultForm.proof_url && <span className="text-xs text-success">✓ Uploaded</span>}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider leading-relaxed block mb-1">🎬 Upload Proof Video</label>
              <div className="flex items-center gap-2">
                <input type="file" accept="video/*" disabled={uploadingVideo} className="flex-1 text-xs cursor-pointer"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setUploadingVideo(true);
                      const { file_url } = await stageClient.integrations.Core.UploadFile({ file });
                      setResultForm(f => ({ ...f, video_url: file_url }));
                      setUploadingVideo(false);
                      e.target.value = "";
                    }
                  }}
                />
                {uploadingVideo && <span className="text-xs text-muted-foreground">Uploading...</span>}
                {resultForm.video_url && <span className="text-xs text-success">✓ Uploaded</span>}
              </div>
            </div>
            <Button onClick={onSubmit} disabled={resultForm.home_score === "" || resultForm.away_score === ""}
              className="w-full bg-primary text-primary-foreground leading-relaxed">
              Confirm Result
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}