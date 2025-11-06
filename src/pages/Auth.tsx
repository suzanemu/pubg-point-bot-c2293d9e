import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Upload, Shield } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [accessCode, setAccessCode] = useState("");

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });
  }, [navigate]);

  const handleAccessCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!accessCode.trim()) {
      toast.error("Please enter an access code");
      return;
    }

    setLoading(true);

    try {
      // Sign in anonymously first
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();

      if (authError) {
        toast.error("Authentication failed");
        return;
      }

      if (!authData.user) {
        toast.error("Authentication failed");
        return;
      }

      // Validate access code using secure server-side function
      const { data: codeData, error: codeError } = await supabase
        .rpc("validate_access_code", { input_code: accessCode.trim().toUpperCase() })
        .single();

      if (codeError || !codeData) {
        await supabase.auth.signOut();
        toast.error("Invalid access code");
        return;
      }

      // Create session
      const { error: sessionError } = await supabase
        .from("sessions")
        .insert({
          user_id: authData.user.id,
          code_used: accessCode.trim().toUpperCase(),
          role: codeData.role,
          team_id: codeData.team_id,
        });

      if (sessionError) {
        await supabase.auth.signOut();
        toast.error("Failed to create session");
        return;
      }

      toast.success(`Welcome ${codeData.role}!`);
      navigate("/");
    } catch (error) {
      console.error("Access code error:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerAccess = async () => {
    setLoading(true);

    try {
      // Sign in anonymously for players
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();

      if (authError) {
        toast.error("Authentication failed: " + authError.message);
        return;
      }

      if (!authData.user) {
        toast.error("Authentication failed - no user returned");
        return;
      }

      // Wait a moment for auth to settle
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create a player session without team_id (they'll select team when uploading)
      const { error: sessionError } = await supabase
        .from("sessions")
        .insert({
          user_id: authData.user.id,
          code_used: "PLAYER_DIRECT",
          role: "player",
          team_id: null,
        });

      if (sessionError) {
        console.error("Session creation error:", sessionError);
        await supabase.auth.signOut();
        toast.error("Failed to create session: " + sessionError.message);
        return;
      }

      toast.success("Welcome! Redirecting to dashboard...");
      
      // Wait a bit before navigation to ensure session is saved
      await new Promise(resolve => setTimeout(resolve, 500));
      navigate("/");
    } catch (error) {
      console.error("Player access error:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 border-primary/30">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
            PUBG MOBILE
          </h1>
          <p className="text-muted-foreground">Esports Point Tracker</p>
        </div>

        {/* Player Screenshot Submit Button */}
        <div className="mb-6">
          <Button
            onClick={handlePlayerAccess}
            disabled={loading}
            className="w-full bg-gradient-primary hover:shadow-glow h-14 text-lg"
          >
            <Upload className="mr-2 h-5 w-5" />
            Screenshot Submit
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Upload your match screenshots
          </p>
        </div>

        <div className="relative my-6">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
            OR
          </span>
        </div>

        {/* Admin Access Code Form */}
        <form onSubmit={handleAccessCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="access-code" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Admin Access Code
            </Label>
            <Input
              id="access-code"
              type="text"
              placeholder="Enter admin access code"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              required
              className="bg-input border-border uppercase text-center text-lg tracking-widest"
              maxLength={20}
            />
            <p className="text-xs text-muted-foreground text-center">
              For administrators only
            </p>
          </div>
          <Button
            type="submit"
            disabled={loading}
            variant="outline"
            className="w-full border-border"
          >
            {loading ? "Validating..." : "Admin Login"}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default Auth;
