import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, LogOut, Loader2, Trophy, AlertCircle, Images } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import Standings from "./Standings";
import ScreenshotGallery from "./ScreenshotGallery";
import { Team, Tournament } from "@/types/tournament";

interface PlayerDashboardProps {
  userId: string;
}

const PlayerDashboard = ({ userId }: PlayerDashboardProps) => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [allTeams, setAllTeams] = useState<{ id: string; name: string; logo_url?: string }[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [teamUploadCounts, setTeamUploadCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchTournaments();
  }, []);

  useEffect(() => {
    if (selectedTournamentId) {
      fetchTeamsForTournament();
    }
  }, [selectedTournamentId]);

  useEffect(() => {
    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      if (selectedTournamentId) {
        fetchTeams();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [selectedTournamentId]);

  const fetchTournaments = async () => {
    const { data: tournamentsData } = await supabase
      .from("tournaments")
      .select("*")
      .order("created_at", { ascending: false });

    if (tournamentsData && tournamentsData.length > 0) {
      setTournaments(tournamentsData);
      // Auto-select first tournament if none selected
      if (!selectedTournamentId) {
        setSelectedTournamentId(tournamentsData[0].id);
      }
    }
  };

  const fetchTeamsForTournament = async () => {
    if (!selectedTournamentId) return;

    // Fetch all teams in selected tournament
    const { data: teamsData } = await supabase
      .from("teams")
      .select("id, name, logo_url")
      .eq("tournament_id", selectedTournamentId);
    
    if (teamsData) {
      setAllTeams(teamsData);
      // Reset team selection when tournament changes
      setSelectedTeamId("");
    }
    
    fetchTeams();
  };

  const fetchTeams = async () => {
    if (!selectedTournamentId) return;

    const { data, error } = await supabase
      .from("teams")
      .select("id, name, created_at")
      .eq("tournament_id", selectedTournamentId);

    if (error) {
      console.error("Error fetching teams:", error);
      return;
    }

    if (data) {
      // Fetch all match data
      const { data: allMatches } = await supabase
        .from("match_screenshots")
        .select("team_id, placement, kills, points");

      // Count uploads per team
      const uploadCounts: Record<string, number> = {};
      data.forEach((team) => {
        const teamMatches = allMatches?.filter((m) => m.team_id === team.id) || [];
        uploadCounts[team.id] = teamMatches.length;
      });
      setTeamUploadCounts(uploadCounts);

      const teamsData: Team[] = data.map((team) => {
        const teamMatches = allMatches?.filter((m) => m.team_id === team.id) || [];
        let totalPoints = 0;
        let totalKills = 0;
        let placementPoints = 0;
        const firstPlaceWins = teamMatches.filter((m) => m.placement === 1).length;

        teamMatches.forEach((match) => {
          totalKills += match.kills || 0;
          totalPoints += match.points || 0;
          
          // Calculate placement points
          const PLACEMENT_POINTS: Record<number, number> = {
            1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1,
            9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, 15: 0, 16: 0,
            17: 0, 18: 0, 19: 0, 20: 0, 21: 0, 22: 0, 23: 0, 24: 0,
            25: 0, 26: 0, 27: 0, 28: 0, 29: 0, 30: 0, 31: 0, 32: 0,
          };
          placementPoints += PLACEMENT_POINTS[match.placement || 0] || 0;
        });

        return {
          id: team.id,
          name: team.name,
          totalPoints,
          placementPoints,
          killPoints: totalKills, // 1 point per kill
          totalKills,
          matchesPlayed: teamMatches.length,
          firstPlaceWins,
        };
      });
      setTeams(teamsData);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length === 0) {
      return;
    }

    if (!selectedTeamId) {
      toast.error("Please select a team first");
      return;
    }

    // Check if team has reached 12 uploads limit
    const currentUploads = teamUploadCounts[selectedTeamId] || 0;
    if (currentUploads >= 12) {
      toast.error("This team has already uploaded the maximum 12 screenshots");
      return;
    }

    // Check if adding these files would exceed the limit
    if ((currentUploads + files.length) > 12) {
      const remaining = 12 - currentUploads;
      toast.error(`This team can only upload ${remaining} more screenshot${remaining > 1 ? 's' : ''}`);
      return;
    }

    if (files.length > 4) {
      toast.error("You can only upload up to 4 screenshots at once");
      return;
    }

    // Check all files are images
    const invalidFiles = files.filter(file => !file.type.startsWith("image/"));
    if (invalidFiles.length > 0) {
      toast.error("Please upload only image files");
      return;
    }

    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Processing ${i + 1} of ${files.length}...`);

        try {
          // Upload to storage
          const fileExt = file.name.split(".").pop();
          const fileName = `${userId}/${Date.now()}_${i}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from("match-screenshots")
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from("match-screenshots")
            .getPublicUrl(fileName);

          setAnalyzing(true);

          // Analyze screenshot with AI
          const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
            "analyze-screenshot",
            {
              body: { imageUrl: publicUrl },
            }
          );

          setAnalyzing(false);

          if (analysisError) {
            console.error("Analysis error:", analysisError);
            failCount++;
            continue;
          }

          const { placement, kills } = analysisData;

          if (placement === null || kills === null) {
            failCount++;
            continue;
          }

          // Calculate points based on PUBG Mobile scoring
          const PLACEMENT_POINTS: Record<number, number> = {
            1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1,
            9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, 15: 0, 16: 0,
            17: 0, 18: 0, 19: 0, 20: 0, 21: 0, 22: 0, 23: 0, 24: 0,
            25: 0, 26: 0, 27: 0, 28: 0, 29: 0, 30: 0, 31: 0, 32: 0,
          };
          const placementPoints = PLACEMENT_POINTS[placement] || 0;
          const points = placementPoints + kills;

          // Save to database
          const { error: dbError } = await supabase
            .from("match_screenshots")
            .insert({
              team_id: selectedTeamId,
              player_id: userId,
              day: selectedDay,
              screenshot_url: publicUrl,
              placement,
              kills,
              points,
              analyzed_at: new Date().toISOString(),
            });

          if (dbError) {
            console.error("Database error:", dbError);
            failCount++;
          } else {
            successCount++;
          }
        } catch (error) {
          console.error("Error processing file:", error);
          failCount++;
        }
      }

      // Show results
      if (successCount > 0) {
        toast.success(`Successfully uploaded ${successCount} screenshot${successCount > 1 ? 's' : ''}!`);
      }
      
      if (failCount > 0) {
        toast.error(`Failed to process ${failCount} screenshot${failCount > 1 ? 's' : ''}`);
      }
      
      // Reset form
      e.target.value = "";
      
      // Refresh data
      fetchTeams();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload screenshots");
    } finally {
      setUploading(false);
      setAnalyzing(false);
      setUploadProgress("");
    }
  };

  const canUploadMore = selectedTeamId && (teamUploadCounts[selectedTeamId] || 0) < 12;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Player Dashboard
            </h1>
            <p className="text-muted-foreground mt-2">Upload your match screenshots</p>
          </div>
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="border-border"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-muted">
            <TabsTrigger value="upload" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="gallery" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Images className="mr-2 h-4 w-4" />
              Gallery
            </TabsTrigger>
            <TabsTrigger value="standings" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Trophy className="mr-2 h-4 w-4" />
              Standings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-6 space-y-6">

        {/* Tournament Selection Card */}
        {tournaments.length > 0 ? (
          <Card className="p-6 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Trophy className="h-6 w-6 text-primary-glow" />
              Tournament Selection
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tournamentSelect">Select Tournament</Label>
                <Select value={selectedTournamentId} onValueChange={setSelectedTournamentId}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue placeholder="Choose a tournament" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50">
                    {tournaments.map((tournament) => (
                      <SelectItem key={tournament.id} value={tournament.id}>
                        {tournament.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedTournamentId && tournaments.find(t => t.id === selectedTournamentId) && (
                <div>
                  {tournaments.find(t => t.id === selectedTournamentId)?.description && (
                    <p className="text-sm text-muted-foreground">
                      {tournaments.find(t => t.id === selectedTournamentId)?.description}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>
        ) : (
          <Card className="p-8 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
            <div className="text-center space-y-4">
              <Trophy className="h-16 w-16 text-primary-glow mx-auto opacity-50" />
              <div>
                <h2 className="text-2xl font-bold mb-2">No Tournaments Available</h2>
                <p className="text-muted-foreground">
                  Please contact an administrator to create a tournament before uploading screenshots.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Upload Card */}
        {selectedTournamentId && (
          <Card className="p-6 border-primary/30">
            <h2 className="text-2xl font-bold mb-4">Upload Match Screenshot</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="teamSelect">Select Team</Label>
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger className="bg-background border-border max-w-xs">
                    <SelectValue placeholder="Choose a team" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-border z-50 shadow-lg">
                    {allTeams.map((team) => (
                      <SelectItem key={team.id} value={team.id} className="cursor-pointer">
                        <div className="flex items-center gap-2">
                          {team.logo_url && (
                            <img 
                              src={team.logo_url} 
                              alt={team.name}
                              className="w-5 h-5 rounded object-cover"
                            />
                          )}
                          <span>{team.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTeamId && (
                  <p className="text-xs text-muted-foreground">
                    Uploads: {teamUploadCounts[selectedTeamId] || 0}/12
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="daySelect">Select Day</Label>
                <Select value={selectedDay.toString()} onValueChange={(v) => setSelectedDay(parseInt(v))}>
                  <SelectTrigger className="bg-background border-border max-w-xs">
                    <SelectValue placeholder="Choose a day" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-border z-50 shadow-lg">
                    <SelectItem value="1" className="cursor-pointer">Day 1 (4 matches)</SelectItem>
                    <SelectItem value="2" className="cursor-pointer">Day 2 (4 matches)</SelectItem>
                    <SelectItem value="3" className="cursor-pointer">Day 3 (4 matches)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="screenshot">Upload Screenshots (Max 4)</Label>
                <div className="border-2 border-dashed border-primary/30 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                  <input
                    id="screenshot"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    disabled={!selectedTeamId || uploading || analyzing}
                    className="hidden"
                  />
                  <label
                    htmlFor="screenshot"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    {uploading || analyzing ? (
                      <>
                        <Loader2 className="h-12 w-12 text-primary animate-spin" />
                        <p className="text-lg font-semibold">
                          {uploadProgress || (uploading ? "Uploading..." : "Analyzing with AI...")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Please wait while we process your screenshots
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-12 w-12 text-primary" />
                        <p className="text-lg font-semibold">
                          Click to upload screenshots (up to 4)
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {canUploadMore 
                            ? "AI will automatically extract placement and kills from each"
                            : "You have uploaded all allowed matches"}
                        </p>
                      </>
                    )}
                  </label>
                </div>
              </div>
            </div>
          </Card>
        )}

          </TabsContent>

          <TabsContent value="gallery" className="mt-6">
            <ScreenshotGallery isAdmin={false} />
          </TabsContent>

          <TabsContent value="standings" className="mt-6">
            {teams.length > 0 ? <Standings teams={teams} /> : (
              <div className="text-center py-12 text-muted-foreground">
                <p>No data available yet</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default PlayerDashboard;
