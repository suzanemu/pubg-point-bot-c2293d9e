import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon, Users, Calendar, Trophy, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Screenshot {
  id: string;
  team_id: string;
  screenshot_url: string;
  placement: number | null;
  kills: number | null;
  points: number | null;
  day: number;
  created_at: string;
}

interface Team {
  id: string;
  name: string;
  logo_url: string | null;
}

interface Tournament {
  id: string;
  name: string;
}

interface ScreenshotGalleryProps {
  isAdmin: boolean;
}

const ScreenshotGallery = ({ isAdmin }: ScreenshotGalleryProps) => {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("all");
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<Screenshot | null>(null);

  useEffect(() => {
    fetchTournaments();
  }, []);

  useEffect(() => {
    if (selectedTournamentId) {
      fetchTeams();
      fetchScreenshots();
    }
  }, [selectedTournamentId, selectedTeamId, selectedDay]);

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
    if (data && data.length > 0) {
      setSelectedTournamentId(data[0].id);
    }
  };

  const fetchTeams = async () => {
    if (!selectedTournamentId) return;

    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("tournament_id", selectedTournamentId)
      .order("name");

    if (error) {
      console.error("Error fetching teams:", error);
      return;
    }

    setTeams(data || []);
  };

  const fetchScreenshots = async () => {
    if (!selectedTournamentId) return;

    setLoading(true);

    let query = supabase
      .from("match_screenshots")
      .select(`
        *,
        teams!inner(tournament_id)
      `)
      .eq("teams.tournament_id", selectedTournamentId)
      .order("day", { ascending: true })
      .order("created_at", { ascending: false });

    if (selectedTeamId !== "all") {
      query = query.eq("team_id", selectedTeamId);
    }

    if (selectedDay > 0) {
      query = query.eq("day", selectedDay);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching screenshots:", error);
      setLoading(false);
      return;
    }

    setScreenshots(data || []);
    setLoading(false);
  };

  const handleDeleteScreenshot = async (screenshotId: string, screenshotUrl: string) => {
    if (!isAdmin) return;

    try {
      // Extract file path from URL
      const urlParts = screenshotUrl.split("/");
      const filePath = urlParts.slice(urlParts.indexOf("match-screenshots") + 1).join("/");

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("match-screenshots")
        .remove([filePath]);

      if (storageError) {
        console.error("Error deleting from storage:", storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("match_screenshots")
        .delete()
        .eq("id", screenshotId);

      if (dbError) {
        toast.error("Failed to delete screenshot");
        return;
      }

      toast.success("Screenshot deleted");
      fetchScreenshots();
    } catch (error) {
      console.error("Error deleting screenshot:", error);
      toast.error("An error occurred");
    }
  };

  const getTeamName = (teamId: string) => {
    return teams.find((t) => t.id === teamId)?.name || "Unknown Team";
  };

  const groupByTeamAndDay = () => {
    const grouped: { [key: string]: { [key: number]: Screenshot[] } } = {};

    screenshots.forEach((screenshot) => {
      const teamName = getTeamName(screenshot.team_id);
      if (!grouped[teamName]) {
        grouped[teamName] = {};
      }
      if (!grouped[teamName][screenshot.day]) {
        grouped[teamName][screenshot.day] = [];
      }
      grouped[teamName][screenshot.day].push(screenshot);
    });

    return grouped;
  };

  const groupedScreenshots = groupByTeamAndDay();

  return (
    <div className="space-y-6">
      <Card className="p-6 border-primary/30">
        <div className="flex items-center gap-2 mb-4">
          <ImageIcon className="h-6 w-6 text-primary-glow" />
          <h2 className="text-2xl font-bold">Screenshot Gallery</h2>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="space-y-2">
            <Label>Tournament</Label>
            <Select value={selectedTournamentId} onValueChange={setSelectedTournamentId}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Select tournament" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border z-50">
                {tournaments.map((tournament) => (
                  <SelectItem key={tournament.id} value={tournament.id}>
                    {tournament.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Team Filter</Label>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border-border z-50">
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Day Filter</Label>
            <Select value={selectedDay.toString()} onValueChange={(v) => setSelectedDay(parseInt(v))}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border-border z-50">
                <SelectItem value="0">All Days</SelectItem>
                <SelectItem value="1">Day 1</SelectItem>
                <SelectItem value="2">Day 2</SelectItem>
                <SelectItem value="3">Day 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Screenshots organized by team and day */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading screenshots...</div>
        ) : Object.keys(groupedScreenshots).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No screenshots uploaded yet
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedScreenshots).map(([teamName, dayGroups]) => (
              <Card key={teamName} className="p-4 border-border bg-background/50">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-bold">{teamName}</h3>
                </div>

                <Tabs defaultValue={Object.keys(dayGroups)[0]} className="w-full">
                  <TabsList className="bg-muted">
                    {Object.keys(dayGroups)
                      .sort((a, b) => parseInt(a) - parseInt(b))
                      .map((day) => (
                        <TabsTrigger key={day} value={day}>
                          <Calendar className="h-4 w-4 mr-2" />
                          Day {day}
                        </TabsTrigger>
                      ))}
                  </TabsList>

                  {Object.entries(dayGroups).map(([day, screenshots]) => (
                    <TabsContent key={day} value={day} className="mt-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {screenshots.map((screenshot) => (
                          <div
                            key={screenshot.id}
                            className="relative group cursor-pointer"
                            onClick={() => setSelectedImage(screenshot)}
                          >
                            <div className="aspect-video rounded-lg overflow-hidden border border-border bg-muted">
                              <img
                                src={screenshot.screenshot_url}
                                alt={`Match screenshot`}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                              />
                            </div>
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                              <div className="text-center text-white space-y-1">
                                <div className="text-sm font-semibold">
                                  Placement: #{screenshot.placement || "N/A"}
                                </div>
                                <div className="text-sm">Kills: {screenshot.kills || 0}</div>
                                <div className="text-sm font-bold">
                                  Points: {screenshot.points || 0}
                                </div>
                              </div>
                            </div>
                            {isAdmin && (
                              <Button
                                size="icon"
                                variant="destructive"
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteScreenshot(screenshot.id, screenshot.screenshot_url);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* Image Preview Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Match Screenshot Details</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="space-y-4">
              <img
                src={selectedImage.screenshot_url}
                alt="Match screenshot"
                className="w-full rounded-lg border border-border"
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Team</Label>
                  <p className="text-lg font-semibold">{getTeamName(selectedImage.team_id)}</p>
                </div>
                <div>
                  <Label>Day</Label>
                  <p className="text-lg font-semibold">Day {selectedImage.day}</p>
                </div>
                <div>
                  <Label>Placement</Label>
                  <p className="text-lg font-semibold">
                    #{selectedImage.placement || "N/A"}
                  </p>
                </div>
                <div>
                  <Label>Kills</Label>
                  <p className="text-lg font-semibold">{selectedImage.kills || 0}</p>
                </div>
                <div>
                  <Label>Points</Label>
                  <p className="text-lg font-semibold text-primary">
                    {selectedImage.points || 0}
                  </p>
                </div>
                <div>
                  <Label>Uploaded</Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedImage.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScreenshotGallery;
