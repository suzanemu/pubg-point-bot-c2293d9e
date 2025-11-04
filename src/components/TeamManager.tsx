import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Trophy } from "lucide-react";
import { Tournament } from "@/types/tournament";

interface Team {
  id: string;
  name: string;
  logo_url?: string;
}

export default function TeamManager() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<string>("");
  const [newTeamName, setNewTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    fetchTournaments();
  }, []);

  useEffect(() => {
    if (selectedTournament) {
      fetchTeams();
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
    if (data && data.length > 0 && !selectedTournament) {
      setSelectedTournament(data[0].id);
    }
  };

  const fetchTeams = async () => {
    if (!selectedTournament) return;

    const { data: teamsData, error: teamsError } = await supabase
      .from("teams")
      .select("id, name, logo_url")
      .eq("tournament_id", selectedTournament);

    if (teamsError) {
      console.error("Error fetching teams:", teamsError);
      return;
    }

    setTeams(teamsData || []);
  };


  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTournament) {
      toast.error("Please select a tournament first");
      return;
    }

    if (!newTeamName.trim()) {
      toast.error("Please enter a team name");
      return;
    }

    setLoading(true);

    try {
      let logoUrl = null;

      // Upload logo if provided
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${selectedTournament}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('team-logos')
          .upload(filePath, logoFile);

        if (uploadError) {
          toast.error("Failed to upload logo");
          return;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('team-logos')
          .getPublicUrl(filePath);

        logoUrl = publicUrl;
      }

      // Create team
      const { error: teamError } = await supabase
        .from("teams")
        .insert({ 
          name: newTeamName.trim(), 
          tournament_id: selectedTournament,
          logo_url: logoUrl 
        });

      if (teamError) {
        toast.error("Failed to create team");
        return;
      }

      toast.success("Team created successfully!");
      setNewTeamName("");
      setLogoFile(null);
      fetchTeams();
    } catch (error) {
      console.error("Error adding team:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm("Are you sure you want to delete this team?")) {
      return;
    }

    const { error } = await supabase.from("teams").delete().eq("id", teamId);

    if (error) {
      toast.error("Failed to delete team");
      return;
    }

    toast.success("Team deleted");
    fetchTeams();
  };


  if (tournaments.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">
          Please create a tournament first before adding teams.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Select Tournament</h2>
        <Select value={selectedTournament} onValueChange={setSelectedTournament}>
          <SelectTrigger>
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
      </Card>

      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Add New Team</h2>
        <form onSubmit={handleAddTeam} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-name">Team Name</Label>
            <Input
              id="team-name"
              type="text"
              placeholder="Enter team name"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-logo">Team Logo (Optional)</Label>
            <Input
              id="team-logo"
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              Upload a team logo image (PNG, JPG, etc.)
            </p>
          </div>
          <Button type="submit" disabled={loading}>
            <Plus className="w-4 h-4 mr-2" />
            {loading ? "Creating..." : "Create Team"}
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Teams</h2>
        <div className="space-y-3">
          {teams.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No teams yet. Create your first team above.
            </p>
          ) : (
            teams.map((team) => (
              <div
                key={team.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1">
                  {team.logo_url ? (
                    <img 
                      src={team.logo_url} 
                      alt={`${team.name} logo`}
                      className="w-10 h-10 rounded object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-primary/20 flex items-center justify-center">
                      <Trophy className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold">{team.name}</h3>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDeleteTeam(team.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
