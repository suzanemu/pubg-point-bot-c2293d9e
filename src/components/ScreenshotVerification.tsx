import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Edit, Loader2, Image as ImageIcon } from "lucide-react";
import { calculatePoints } from "@/types/tournament";

interface MatchScreenshot {
  id: string;
  team_id: string;
  team_name: string;
  day: number;
  placement: number | null;
  kills: number | null;
  points: number | null;
  screenshot_url: string;
  created_at: string;
}

interface ScreenshotVerificationProps {
  selectedTournament: string | null;
}

const ScreenshotVerification = ({ selectedTournament }: ScreenshotVerificationProps) => {
  const [screenshots, setScreenshots] = useState<MatchScreenshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewImageDialogOpen, setViewImageDialogOpen] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState<MatchScreenshot | null>(null);
  const [editPlacement, setEditPlacement] = useState<number>(1);
  const [editKills, setEditKills] = useState<number>(0);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (selectedTournament) {
      fetchScreenshots();
    }
  }, [selectedTournament]);

  const fetchScreenshots = async () => {
    if (!selectedTournament) return;

    setLoading(true);
    try {
      // Get all teams in the tournament
      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("id, name")
        .eq("tournament_id", selectedTournament);

      if (teamsError) throw teamsError;

      // Get all screenshots for these teams
      const teamIds = teamsData?.map(t => t.id) || [];
      
      if (teamIds.length === 0) {
        setScreenshots([]);
        setLoading(false);
        return;
      }

      const { data: screenshotsData, error: screenshotsError } = await supabase
        .from("match_screenshots")
        .select("*")
        .in("team_id", teamIds)
        .order("created_at", { ascending: false });

      if (screenshotsError) throw screenshotsError;

      // Combine team names with screenshots
      const enrichedScreenshots: MatchScreenshot[] = (screenshotsData || []).map(screenshot => {
        const team = teamsData?.find(t => t.id === screenshot.team_id);
        return {
          ...screenshot,
          team_name: team?.name || "Unknown Team"
        };
      });

      setScreenshots(enrichedScreenshots);
    } catch (error) {
      console.error("Error fetching screenshots:", error);
      toast.error("Failed to load screenshots");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (screenshot: MatchScreenshot) => {
    setSelectedScreenshot(screenshot);
    setEditPlacement(screenshot.placement || 1);
    setEditKills(screenshot.kills || 0);
    setEditDialogOpen(true);
  };

  const handleViewImage = (screenshot: MatchScreenshot) => {
    setSelectedScreenshot(screenshot);
    setViewImageDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedScreenshot) return;

    setUpdating(true);
    try {
      const newPoints = calculatePoints(editPlacement, editKills);

      const { error } = await supabase
        .from("match_screenshots")
        .update({
          placement: editPlacement,
          kills: editKills,
          points: newPoints,
        })
        .eq("id", selectedScreenshot.id);

      if (error) throw error;

      toast.success("Screenshot updated successfully");
      setEditDialogOpen(false);
      fetchScreenshots();
    } catch (error) {
      console.error("Error updating screenshot:", error);
      toast.error("Failed to update screenshot");
    } finally {
      setUpdating(false);
    }
  };

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage
      .from("match-screenshots")
      .getPublicUrl(path);
    return data.publicUrl;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (screenshots.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No screenshots uploaded yet</p>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {screenshots.map((screenshot) => (
            <Card key={screenshot.id} className="p-4">
              <div className="space-y-3">
                <div className="aspect-video relative bg-muted rounded-lg overflow-hidden cursor-pointer"
                     onClick={() => handleViewImage(screenshot)}>
                  <img
                    src={getPublicUrl(screenshot.screenshot_url)}
                    alt={`Day ${screenshot.day}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-white" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm truncate">{screenshot.team_name}</h3>
                    <span className="text-xs text-muted-foreground">Day {screenshot.day}</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center p-2 bg-background/50 rounded">
                      <p className="text-xs text-muted-foreground">Place</p>
                      <p className="font-bold">{screenshot.placement || "N/A"}</p>
                    </div>
                    <div className="text-center p-2 bg-background/50 rounded">
                      <p className="text-xs text-muted-foreground">Kills</p>
                      <p className="font-bold">{screenshot.kills || 0}</p>
                    </div>
                    <div className="text-center p-2 bg-background/50 rounded">
                      <p className="text-xs text-muted-foreground">Points</p>
                      <p className="font-bold text-primary">{screenshot.points || 0}</p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleEdit(screenshot)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Match Data</DialogTitle>
          </DialogHeader>
          
          {selectedScreenshot && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Team: {selectedScreenshot.team_name}</p>
                <p className="text-sm text-muted-foreground">Day: {selectedScreenshot.day}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="placement">Placement</Label>
                <Select
                  value={editPlacement.toString()}
                  onValueChange={(value) => setEditPlacement(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 18 }, (_, i) => i + 1).map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="kills">Kills</Label>
                <Input
                  id="kills"
                  type="number"
                  min="0"
                  value={editKills}
                  onChange={(e) => setEditKills(parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium">New Points: {calculatePoints(editPlacement, editKills)}</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updating}>
              {updating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Image Dialog */}
      <Dialog open={viewImageDialogOpen} onOpenChange={setViewImageDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {selectedScreenshot?.team_name} - Day {selectedScreenshot?.day}
            </DialogTitle>
          </DialogHeader>
          
          {selectedScreenshot && (
            <div className="space-y-4">
              <img
                src={getPublicUrl(selectedScreenshot.screenshot_url)}
                alt={`Day ${selectedScreenshot.day}`}
                className="w-full rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ScreenshotVerification;
