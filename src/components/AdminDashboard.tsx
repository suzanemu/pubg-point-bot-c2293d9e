import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Trophy, Users, Image, Images } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TeamManager from "./TeamManager";
import TournamentManager from "./TournamentManager";
import ScreenshotVerification from "./ScreenshotVerification";
import Standings from "./Standings";
import ScreenshotGallery from "./ScreenshotGallery";
import { Team, Tournament } from "@/types/tournament";

interface AdminDashboardProps {
  userId: string;
}

const AdminDashboard = ({ userId }: AdminDashboardProps) => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<string>("");

  useEffect(() => {
    fetchTournaments();
  }, []);

  useEffect(() => {
    if (selectedTournament) {
      fetchTeams();
      
      // Auto-refresh every 5 seconds
      const interval = setInterval(fetchTeams, 5000);
      
      return () => clearInterval(interval);
    }
  }, [selectedTournament]);

  const fetchTournaments = async () => {
    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tournaments:", error);
      return;
    }

    setTournaments(data || []);
    
    // If no tournaments exist, clear selection
    if (!data || data.length === 0) {
      setSelectedTournament("");
      return;
    }
    
    // If no tournament is selected OR the selected tournament was deleted, select the first one
    const selectedExists = data.some(t => t.id === selectedTournament);
    if (!selectedTournament || !selectedExists) {
      setSelectedTournament(data[0].id);
    }
  };

  const fetchTeams = async () => {
    if (!selectedTournament) return;

    const { data: teamsData, error: teamsError } = await supabase
      .from("teams")
      .select("id, name, created_at")
      .eq("tournament_id", selectedTournament);

    if (teamsError) {
      console.error("Error fetching teams:", teamsError);
      return;
    }

    if (teamsData) {
      // Fetch match data for each team
      const { data: matchData, error: matchError } = await supabase
        .from("match_screenshots")
        .select("team_id, placement, kills, points");

      if (matchError) {
        console.error("Error fetching match data:", matchError);
      }

      const teamsWithStats: Team[] = teamsData.map((team) => {
        const teamMatches = matchData?.filter((m) => m.team_id === team.id) || [];
        const totalPoints = teamMatches.reduce((sum, m) => sum + (m.points || 0), 0);
        const totalKills = teamMatches.reduce((sum, m) => sum + (m.kills || 0), 0);
        const firstPlaceWins = teamMatches.filter((m) => m.placement === 1).length;
        
        let placementPoints = 0;
        teamMatches.forEach((match) => {
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
          killPoints: totalKills,
          totalKills,
          matchesPlayed: teamMatches.length,
          firstPlaceWins,
        };
      });

      setTeams(teamsWithStats);
    }
  };


  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground mt-2">Manage teams and view standings</p>
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

        {/* Tournament Selection */}
        {tournaments.length > 0 && (
          <Select value={selectedTournament} onValueChange={setSelectedTournament}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Select a tournament" />
            </SelectTrigger>
            <SelectContent>
              {tournaments.map((tournament) => (
                <SelectItem key={tournament.id} value={tournament.id}>
                  {tournament.name} ({tournament.total_matches} matches)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Tabs */}
        <Tabs defaultValue="standings" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="standings">
              <Trophy className="mr-2 h-4 w-4" />
              Standings
            </TabsTrigger>
            <TabsTrigger value="screenshots">
              <Image className="mr-2 h-4 w-4" />
              Verify
            </TabsTrigger>
            <TabsTrigger value="gallery">
              <Images className="mr-2 h-4 w-4" />
              Gallery
            </TabsTrigger>
            <TabsTrigger value="teams">
              <Users className="mr-2 h-4 w-4" />
              Teams
            </TabsTrigger>
            <TabsTrigger value="tournaments">
              <Trophy className="mr-2 h-4 w-4" />
              Tournaments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="standings" className="mt-6">
            {teams.length > 0 && selectedTournament ? (
              <Standings teams={teams} />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>
                  {!selectedTournament
                    ? "Please create a tournament first."
                    : "No teams added yet. Go to Manage Teams to create teams."}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="screenshots" className="mt-6">
            {selectedTournament ? (
              <ScreenshotVerification selectedTournament={selectedTournament} />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>Please select a tournament first.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="gallery" className="mt-6">
            <ScreenshotGallery isAdmin={true} />
          </TabsContent>

          <TabsContent value="teams" className="mt-6">
            <TeamManager />
          </TabsContent>

          <TabsContent value="tournaments" className="mt-6">
            <TournamentManager onTournamentSelect={(id) => {
              setSelectedTournament(id || "");
              fetchTournaments();
            }} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
